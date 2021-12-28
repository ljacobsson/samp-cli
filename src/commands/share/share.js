const inputUtil = require("../../shared/inputUtil");
const githubUtil = require("../../shared/githubUtil");
const settingsUtil = require("../../shared/settingsUtil");
const lambdaHandlerParser = require("../../shared/lambdaHandlerParser");
const templateAnatomy = require("../../shared/templateAnatomy.json");
const baseTemplate = require("../../shared/baseFile.json");
const parser = require("../../shared/parser");
const flatten = require("flat");
const fs = require("fs");
const path = require("path");
const runtimes = require("../../shared/runtimes.json");

const { Separator } = require("inquirer");
const { unflatten } = require("flat");

const templateType = "SAM"; // so far only supports SAM
async function run(cmd) {
  if (!fs.existsSync(cmd.template)) {
    console.log(
      `Can't find ${cmd.template}. Use -t option to specify template filename`
    );
  }
  const template = parser.parse("own", fs.readFileSync(cmd.template));
  const choices = [];
  for (const block of Object.keys(templateAnatomy[templateType]).filter(
    (p) => templateAnatomy[templateType][p].sharable
  )) {
    if (!template[block]) continue;
    choices.push(new Separator(`*** ${block} ***`));
    for (const item of Object.keys(template[block] || [])) {
      choices.push({
        name: `${item} ${
          template[block][item].Type ? `[${template[block][item].Type}]` : ""
        }`,
        value: { block, item },
      });
    }
  }
  const items = await inputUtil.checkbox(
    "Select the resource(s) that make up your pattern",
    choices
  );
  let sharedTemplate = {};
  for (const item of items) {
    sharedTemplate[item.block] = sharedTemplate[item.block] || {};
    sharedTemplate[item.block][item.item] = template[item.block][item.item];
  }
  let item;
  const metadata = {
    PatternTransform: {
      Properties: [],
      Placeholders: [],
    },
  };
  let resources = Object.keys(sharedTemplate.Resources);
  let additionalFiles = [];
  const sharedFunctionHandlers = {};
  for (const resourceIndex in resources) {
    const resource = resources[resourceIndex];
    const words = resource.split(/(?=[A-Z])/);
    const list = ["No change needed"];
    let string = "";
    for (const word of words) {
      string += word;
      list.push(string);
    }
    const dynamic = await inputUtil.autocomplete(
      `Select dynamic value for ${resource}`,
      list
    );
    if (dynamic !== "No change needed") {
      const placeholderName = await inputUtil.text(
        `Name placeholder for ${dynamic}`,
        dynamic
      );
      const message = await inputUtil.text(
        "Set prompt for user:",
        `Set value for '${placeholderName}' placeholder`,
        `Set value for ${placeholderName}`
      );

      sharedTemplate = JSON.parse(
        JSON.stringify(sharedTemplate).replace(
          new RegExp(dynamic, "g"),
          placeholderName
        )
      );
      metadata.PatternTransform.Placeholders.push({
        Placeholder: placeholderName,
        message,
      });
      resources = resources.map((p) =>
        p.replace(new RegExp(dynamic, "g"), placeholderName)
      );
    }
    const resourceObj =
      template.Resources[resource] || sharedTemplate.Resources[resource];
    const props = resourceObj.Properties;
    if (
      resourceObj.Type === "AWS::Serverless::Function" &&
      runtimes.filter(
        (p) => p.name === (props.Runtime || template.Globals.Function.Runtime)
      )[0].sharable
    ) {
      const shareCode = await inputUtil.prompt(
        `Share function code? (${resource})`
      );
      if (shareCode) {
        sharedFunctionHandlers[resource] = lambdaHandlerParser.buildFileName(
          template.Globals,
          props
        );
      }
    }
  }
  const shareAdditionalFiles = await inputUtil.prompt(
    `Share supporting files? This could be configuration, library code, etc`
  );
  if (shareAdditionalFiles) {
    additionalFiles = await inputUtil.files("Select additional files to share");
  }

  const customizables = [];
  do {
    const flattened = flatten(sharedTemplate);
    const paths = yamleize(flattened, customizables);
    item = await inputUtil.list("Select item to modify", [
      ...paths,
      new Separator("---"),
      "Done",
      new Separator("---"),
    ]);
    if (item === "Done") break;
    const action = await inputUtil.autocomplete("Select action", [
      "Set default value",
      "Make customisable",
      "Delete",
    ]);
    if (action === "Delete") {
      delete flattened[item.path];
    }
    if (action === "Make customisable") {
      const message = await inputUtil.text("Prompt message");
      customizables.push(item.path);
      metadata.PatternTransform.Properties.push({
        JSONPath:
          "$." +
          item.path
            .split(".")
            .map((p) => (p.includes("-") ? `["${p}"]` : p))
            .join(".")
            .replace(/\.\[/g, "["),
        Message: message,
        InputType: typeof flattened[item.path],
      });
    }
    if (action === "Set default value") {
      flattened[item.path] = await inputUtil.text(
        "Set new value",
        flattened[item.path]
      );
    }
    sharedTemplate = unflatten(flattened);
  } while (true);

  sharedTemplate.Metadata = metadata;
  sharedTemplate = { ...baseTemplate, ...sharedTemplate };
  sharedTemplate = Object.keys(sharedTemplate)
    .sort(
      (a, b) =>
        templateAnatomy[templateType][a].order -
        templateAnatomy[templateType][b].order
    )
    .reduce((obj, key) => {
      obj[key] = sharedTemplate[key];
      return obj;
    }, {});
  const name = await inputUtil.text(
    "Pattern name:",
    Object.keys(sharedTemplate.Resources)
      .map((p) => resourceShortName(sharedTemplate.Resources[p].Type))
      .join("-")
  );

  const sources = settingsUtil.get();
  const repo = await inputUtil.autocomplete(
    "Select repository",
    sources.map((p) => {
      return { name: `${p.owner}/${p.repo}`, value: p };
    })
  );
  repo.branch = repo.branch || "main";
  try {
    await githubUtil.putContent(
      repo.owner,
      repo.repo,
      repo.branch,
      path
        .join(repo.root, name, repo.relativePath, repo.fileNames[0])
        .replace(/\\/g, "/"),
      parser.stringify("yaml", sharedTemplate),
      true
    );
    for (const funcCode of Object.keys(sharedFunctionHandlers)) {
      await pushCode(sharedFunctionHandlers[funcCode], sharedFunctionHandlers[funcCode], repo, name);
    }

    for (const additionalFile of additionalFiles) {
      await pushCode(additionalFile, additionalFile.replace(process.cwd(), ""), repo, name);
    }
    console.log(
      `Pattern pushed. Please consider describing the pattern in the README: https://github.com/${repo.owner}/${repo.repo}/edit/${repo.branch}${repo.root}${name}${repo.relativePath}README.md`
    );
  } catch (err) {
    console.log(err.message, err);
    console.log(
      "Make sure your GITHUB_TOKEN has sufficient permissions to push to this repository"
    );
  }
}

async function pushCode(file, relativeFilePath, repo, name) {
  console.log(file);
  const code = fs.readFileSync(file).toString();

  await githubUtil.putContent(
    repo.owner,
    repo.repo,
    repo.branch,
    path.join(repo.root, name, repo.relativePath, relativeFilePath),
    code
  );
}

function resourceShortName(type) {
  switch (type) {
    case "AWS::Serverless::Api":
      return "lambda";
    case "AWS::Serverless::Application":
      return "sar";
    case "AWS::Serverless::HttpApi":
      return "httpapi";
    case "AWS::Serverless::LayerVersion":
      return "layer";
    case "AWS::Serverless::SimpleTable":
      return "dynamodb";
    case "AWS::Serverless::StateMachine":
      return "stepfunctions";
    case "AWS::Serverless::Function":
      return "lambda";
    case "AWS::Events::Rule":
      return "eventbridge";
    default:
      return type.split("::")[1].toLowerCase();
  }
}

function yamleize(flattened, customizables) {
  const list = [];
  const usedPaths = [];
  for (const row of Object.keys(flattened)) {
    const split = row.split(".");
    const propertyName = split.slice(-1)[0];
    for (let i = 0; i < split.length - 1; i++) {
      const path = split.slice(0, i + 1).join(".");
      if (!usedPaths.includes(path)) {
        list.push(new Separator("  ".repeat(i) + split[i]));
        usedPaths.push(path);
      }
    }
    list.push({
      name:
        "  ".repeat(split.length - 1) +
        propertyName +
        ": " +
        flattened[row] +
        (customizables.includes(row) ? " [✎]" : ""),
      value: { path: row, value: flattened[row] },
    });
  }
  return list;
}

module.exports = {
  run,
  flattenAndIndent: yamleize,
};
