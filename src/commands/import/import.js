const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const githubUtil = require("../../shared/githubUtil");
const { Separator } = require("inquirer");
const transformer = require("./transformer");
const baseFile = require("../../shared/baseFile.json");
const templateAnatomy = require("../../shared/templateAnatomy.json");
const lambdaHandlerParser = require("../../shared/lambdaHandlerParser");
const fs = require("fs");
const path = require("path");

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
        `${
          pattern.setting.root.length
            ? pattern.setting.root + "/"
            : pattern.setting.root
        }${pattern.pattern.name}${
          pattern.setting.relativePath
        }/${fileName}`.replace(/\/\//g, "/")
      );
    } catch (err) {}
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

  let template = parser.parse("import", templateString);
  setDefaultMetadata(template);
  template = await transformer.transform(template);
  const sections = {
    Parameters: template.Parameters,
    Globals: template.Globals,
    Resources: template.Resources,
    Outputs: template.Outputs,
  };
  const sectionList = [];
  for (const section of Object.keys(sections)) {
    if (sections[section]) {
      sectionList.push(new Separator(`*** ${section} ***`));
      sectionList.push(
        ...Object.keys(sections[section]).map((p) => {
          return { name: p, value: { name: p, section: section } };
        })
      );
    }
  }
  const blocks = await inputUtil.checkbox(
    "Select blocks to import",
    sectionList,
    sectionList
      .filter((p) => p.value && p.value.section !== "Outputs")
      .map((p) => p.value)
  );
  let getCode;
  for (const block of blocks) {
    ownTemplate[block.section] = ownTemplate[block.section] || {};
    const name = block.name;
    if (ownTemplate[block.section][block.name]) {
      block.name = await inputUtil.text(
        `Naming conflict for ${block.name}. Please select a new name. Make sure to update it dependents to the new name`,
        `${block.name}_2`
      );
    }

    ownTemplate[block.section][block.name] = template[block.section][name];
    if (template[block.section][name].Type === "AWS::Serverless::Function") {
      const functionProps = {
        ...((template.Globals && template.Globals.Function) || {}),
        ...template[block.section][name].Properties,
      };
      getCode =
        getCode ||
        (await inputUtil.prompt(
          `Import function code (${functionProps.Runtime})?`
        ));
      if (getCode) {
        const lambdaFilePath = `${
          pattern.setting.root.length
            ? pattern.setting.root + "/"
            : pattern.setting.root
        }${pattern.pattern.name}${
          pattern.setting.relativePath
        }${lambdaHandlerParser.buildFileName(template.Globals, functionProps)}`;
        try {
          let lambdaFile = await githubUtil.getContent(
            pattern.setting.owner,
            pattern.setting.repo,
            lambdaFilePath
          );
          let lambdaDiskPath = lambdaFilePath.split("/").slice(1).join("/");
          const lambdaDir = lambdaDiskPath.split("/").slice(0, -1).join("/");
          fs.mkdirSync(lambdaDir, {
            recursive: true,
          });
          if (fs.existsSync(lambdaDiskPath)) {
            const newFileName = await inputUtil.text(
              `${lambdaDiskPath} already exists. Please enter another filename: ${lambdaDir}/`
            );
            lambdaDiskPath = `${lambdaDir}/${newFileName}`;
          }
          fs.writeFileSync(lambdaDiskPath, lambdaFile);
        } catch (err) {
          console.error("Failed to download function: " + err.message);    
        }
      }
    }

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
    `${cmd.template} updated with ${
      pattern.pattern.name
    } pattern. See ${pattern.setting.url.replace(
      "#PATTERN_NAME#",
      pattern.pattern.name
    )} for more information`
  );
}

module.exports = {
  run,
};
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
