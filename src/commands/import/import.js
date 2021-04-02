const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const githubUtil = require("../../shared/githubUtil");
const { Octokit } = require("@octokit/rest");
const { Separator } = require("inquirer");
const fs = require("fs");
const github = new Octokit({
  auth: `token ${process.env.GITHUB_TOKEN}`,
});

const cfnDia = require("@mhlabs/cfn-diagram/graph/Vis");
async function run(cmd) {
  if (!fs.existsSync(cmd.template)) {
    console.log(
      `Can't find ${cmd.template}. Use -t option to specify template filename`
    );
    return;
  }
  const ownTemplate = parser.parse("own", fs.readFileSync(cmd.template));

  const patterns = await githubUtil.getPatterns();

  const pattern = await inputUtil.list("Select pattern", patterns);
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

  const template = parser.parse("import", templateString);

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
  for (const block of blocks) {
    ownTemplate[block.section] = ownTemplate[block.section] || {};

    if (ownTemplate[block.section][block.name]) {
      block.name = await inputUtil.text(
        `Naming conflict for ${block.name}. Please select a new name. Make sure to update it dependents to the new name`,
        `${block.name}_2`
      );
    }

    ownTemplate[block.section][block.name] =
      template[block.section][block.name];
    console.log(`Added ${block.name} under ${block.section}`);
  }

  fs.writeFileSync(cmd.template, parser.stringify("own", ownTemplate));

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
