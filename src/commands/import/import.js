const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const githubUtil = require("../../shared/githubUtil");
const { Separator } = require("inquirer");
const transformer = require("./transformer");
const baseFile = require("../../shared/baseFile.json");
const templateAnatomy = require("../../shared/templateAnatomy.json");
const lambdaHandlerParser = require("../../shared/lambdaHandlerParser");
const fs = require("fs");
const _ = require("lodash");
const runtimes = require("../../shared/runtimes.json");
const templateType = "SAM"; // to allow for more template frameworks
async function run(cmd) {
  if (!fs.existsSync(cmd.template)) {
    console.log(
      `Can't find ${cmd.template}. Use -t option to specify template filename`
    );
    const create = await inputUtil.prompt(`Create ${cmd.template}?`);
    if (create) {
      fs.writeFileSync(cmd.template, parser.stringify("yaml", baseFile));
    } else {
      return;
    }
  }

  const ownTemplate = parser.parse("own", fs.readFileSync(cmd.template));
  ownTemplate.Resources = ownTemplate.Resources || {};

  const patterns = await githubUtil.getPatterns();

  const pattern = await inputUtil.autocomplete("Select pattern", patterns);
  let templateString;
  for (const fileName of pattern.setting.fileNames) {
    try {
      templateString = await githubUtil.getContent(
        pattern.setting.owner,
        pattern.setting.repo,
        `${pattern.setting.root.length
          ? pattern.setting.root + "/"
          : pattern.setting.root
          }${pattern.pattern.name}${pattern.setting.relativePath
          }/${fileName}`.replace(/\/\//g, "/")
      );
    } catch (err) { }
    if (templateString) {
      break;
    }
  }
  if (!templateString) {
    console.log(
      "Could not find template file. Tried " +
      pattern.setting.fileNames.join(", ")
    );
    return;
  }

  let templ = parser.parse("import", templateString);
  setDefaultMetadata(templ);
  let { template, selectedRuntime } = await transformer.transform(templ);
  const sections = {
    Parameters: template.Parameters,
    Globals: template.Globals,
    Resources: template.Resources,
    Outputs: template.Outputs,
  };
  const sectionList = [];
  for (const section of Object.keys(sections)) {
    if (sections[section]) {
      //   sectionList.push(new Separator(`*** ${section} ***`));
      sectionList.push(
        ...Object.keys(sections[section]).map((p) => {
          return { name: p, value: { name: p, section: section } };
        })
      );
    }
  }
  let blocks = await inputUtil.checkbox(
    "Select blocks to import",
    sectionList,
    sectionList
      .filter((p) => p.value && p.value.section !== "Outputs")
      .map((p) => p.value)
  );
  if (cmd.merge) {
    template = await mergeWithExistingResource(ownTemplate, blocks, template);
  }
  for (const block of blocks) {
    ownTemplate[block.section] = ownTemplate[block.section] || {};
    const name = block.name;
    if (ownTemplate[block.section][block.name]) {
      if (!cmd.merge) {
        block.name = await inputUtil.text(
          `Naming conflict for ${block.name}. Please select a new name. Make sure to update it dependents to the new name`,
          `${block.name}_2`
        );
      }
    }
    await handleFunctionActions(template, block, name, pattern, selectedRuntime);
    await handleStepFunctionsActions(template, block, name, pattern, cmd.aslFormat);
    ownTemplate[block.section][block.name] = _.merge(
      ownTemplate[block.section][block.name] || {},
      template[block.section][name]
    );

    console.log(`Added ${block.name} under ${block.section}`);
  }
  const orderedTemplate = Object.keys(ownTemplate)
    .sort(
      (a, b) =>
        templateAnatomy[templateType][a].order -
        templateAnatomy[templateType][b].order
    )
    .reduce((obj, key) => {
      obj[key] = ownTemplate[key];
      return obj;
    }, {});
  fs.writeFileSync(cmd.template, parser.stringify("own", orderedTemplate));

  console.log(
    `${cmd.template} updated with ${pattern.pattern.name
    } pattern. See ${pattern.setting.url.replace(
      "#PATTERN_NAME#",
      pattern.pattern.name
    )} for more information`
  );
}

module.exports = {
  run,
};
async function handleFunctionActions(template, block, name, pattern, selectedRuntime) {
  let getCode;
  if (template[block.section][name].Type === "AWS::Serverless::Function") {
    const functionProps = {
      ...((template.Globals && template.Globals.Function) || {}),
      ...template[block.section][name].Properties,
    };
    getCode =
      getCode ||
      (await inputUtil.prompt(
        `Import function code (${name})?`
      ));
    if (getCode) {
      const success = await importFunctionCode(pattern, template, functionProps, name, selectedRuntime);
      if (!success) {
        await importFunctionCode(pattern, template, functionProps, name, selectedRuntime, true);
      }
      template[block.section][name].Properties.Handler = `${name}.handler`;
    }
  }
}

async function handleStepFunctionsActions(template, block, name, pattern, aslFormat) {
  if (template[block.section][name].Type === "AWS::Serverless::StateMachine") {
    const props = template[block.section][name].Properties;
    if (props.DefinitionUri) {
      const definitionUri = await importASL(pattern, props, aslFormat);
      if (definitionUri) {
        template[block.section][name].Properties.DefinitionUri = definitionUri;
      }
    }
  } 
}

async function importASL(
  pattern,
  props,
  aslFormat
) {
  const aslFilePath = `${pattern.setting.root.length
    ? pattern.setting.root + "/"
    : pattern.setting.root
    }${pattern.pattern.name}${pattern.setting.relativePath
    }${props.DefinitionUri}`;
  try {
    let aslFile = await githubUtil.getContent(
      pattern.setting.owner,
      pattern.setting.repo,
      aslFilePath
    );

    let targetPath = props.DefinitionUri.split("/").slice(0, -1).join("/");
    fs.mkdirSync(targetPath, {
      recursive: true,
    });

    targetPath = aslFilePath;
    let skipImport = false;
    let newFileName = props.DefinitionUri;
    if (!aslFormat || aslFormat.toLowerCase() === "yaml" || aslFormat.toLowerCase() === "yml") {
      const parsed = parser.parse("asl", aslFile);
      aslFile = parser.stringify("yaml", parsed);
      newFileName = newFileName.replace(".json", ".yaml");
    } else {
      const parsed = parser.parse("asl", aslFile);
      aslFile = JSON.stringify(parsed, null, 2);
      newFileName = newFileName.replace(".yaml", ".json").replace("yml", "json");
    }
    if (fs.existsSync(newFileName)) {
      newFileName = await inputUtil.text(
        `${targetPath} already exists. Please enter another filename (leave empty to skip import): ${newFileName}/`
      );
      skipImport = newFileName.length === 0;
      targetPath = aslFilePath;
    }
    if (!skipImport) fs.writeFileSync(newFileName, aslFile);
    return newFileName;
  } catch (err) {
    console.error("Failed to download function code: " + err.message);
    return false;
  }
}

async function mergeWithExistingResource(ownTemplate, blocks, template) {
  const existingTypes = Object.keys(ownTemplate.Resources).map(
    (p) => ownTemplate.Resources[p].Type
  );
  const mergable = blocks
    .filter((p) => p.section === "Resources")
    .filter((p) => existingTypes.includes(template.Resources[p.name].Type))
    .map((p) => p.name);
  let mergeResources = [];
  if (mergable.length > 1) {
    mergeResources = await inputUtil.checkbox(
      "Select resource(s) to merge with existing resource(s)",
      mergable.map((p) => {
        return { name: `${p} (${template.Resources[p].Type})`, value: p };
      })
    );
  } else {
    mergeResources = mergable;
  }

  for (const mergeResource of mergeResources) {
    const compatibleResources = Object.keys(ownTemplate.Resources).filter(
      (p) =>
        ownTemplate.Resources[p].Type === template.Resources[mergeResource].Type
    );

    const selectedMerge = await inputUtil.list(
      "Select resources to merge",
      compatibleResources.map((p) => {
        return { name: `${mergeResource} -> ${p}`, value: p };
      })
    );

    template = JSON.parse(
      JSON.stringify(template).replaceAll(mergeResource, selectedMerge)
    );

    for (const block of blocks) {
      block.name = block.name.replace(mergeResource, selectedMerge);
    }
  }
  return template;
}

async function importFunctionCode(
  pattern,
  template,
  functionProps,
  resourceName,
  language,
  languageSpecificFolder
) {
  const lambdaFilePath = `${pattern.setting.root.length
    ? pattern.setting.root + "/"
    : pattern.setting.root
    }${pattern.pattern.name}${(languageSpecificFolder ? `/${language.languageName || language.name}` : "")}${pattern.setting.relativePath
    }${lambdaHandlerParser.buildFileName(template.Globals, functionProps, language)}`;
  try {
    let lambdaFile = await githubUtil.getContent(
      pattern.setting.owner,
      pattern.setting.repo,
      lambdaFilePath
    );
    let lambdaDiskPath = lambdaFilePath.split("/").slice(1).join("/");
    const lambdaDir = lambdaDiskPath.split("/").slice(languageSpecificFolder ? 1 : 0, -1).join("/");
    fs.mkdirSync(lambdaDir, {
      recursive: true,
    });

    let newFileName =
      resourceName +
      language.extension;
    lambdaDiskPath = `${lambdaDir}/${newFileName}`;
    let skipImport = false;
    if (fs.existsSync(lambdaDiskPath)) {
      newFileName = await inputUtil.text(
        `${lambdaDiskPath} already exists. Please enter another filename (leave empty to skip import): ${lambdaDir}/`
      );
      skipImport = newFileName.length === 0;
      lambdaDiskPath = `${lambdaDir}/${newFileName}`;
    }
    if (!skipImport) fs.writeFileSync(lambdaDiskPath, lambdaFile);
  } catch (err) {
    console.error("Failed to download function code: " + err.message);
    return false;
  }
  return true;
}

function setDefaultMetadata(template) {
  template.Metadata = template.Metadata || { PatternTransform: {} };
  template.Metadata.PatternTransform = template.Metadata.PatternTransform || {
    Properties: [],
  };
  template.Metadata.PatternTransform.Properties =
    template.Metadata.PatternTransform.Properties || [];
  template.Metadata.PatternTransform.Properties.unshift({
    JSONPath: "$.Globals.Function.Runtime",
    InputType: "runtime-select",
  });
  for (const resource of Object.keys(template.Resources).filter((p) =>
    ["AWS::Serverless::Function", "AWS::Lambda::Function"].includes(
      template.Resources[p].Type
    )
  )) {
    template.Metadata.PatternTransform.Properties.unshift({
      JSONPath: "$.Resources." + resource + ".Properties.Runtime",
      InputType: "runtime-select",
    });
  }
}
