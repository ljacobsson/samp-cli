const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const { Octokit } = require("@octokit/rest");
const { Separator } = require("inquirer");
const fs = require("fs");
const github = new Octokit({
  auth: `token ${process.env.GITHUB_TOKEN}`,
});

const owner = "aws-samples";
const repo = "serverless-patterns";
const cfnDia = require("@mhlabs/cfn-diagram/graph/Vis");
async function run(cmd) {
  if (!fs.existsSync(cmd.template)) {
    console.log(
      `Can't find ${cmd.template}. Use -t option to specify template filename`
    );
    return;
  }
  const ownTemplate = parser.parse("own", fs.readFileSync(cmd.template));

  const repoRoot = await github.repos.getContent({ owner, repo });
  const patterns = await repoRoot.data
    .filter(
      (p) =>
        p.type === "dir" &&
        /[a-zA-Z]/.test(p.name[0]) &&
        !p.name.endsWith("-cdk")
    )
    .map((p) => {
      return { name: p.name, value: p };
    });
  const pattern = await inputUtil.list("Select pattern", patterns);

  const templateString = await getContent(`/${pattern.name}/template.yaml`);
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
      sectionList.push(new Separator(`***${section}***`));
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
    sectionList.filter(p=>p.value && p.value.section !== "Outputs").map(p=>p.value)
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
    `${cmd.template} updated with ${pattern.name} pattern. See https://serverlessland.com/patterns/${pattern.name} for more information`
  );
}

module.exports = {
  run,
};
async function getContent(path) {
  const templateFile = await github.repos.getContent({
    owner,
    repo,
    path,
  });
  const templateString = Buffer.from(
    templateFile.data.content,
    "base64"
  ).toString();
  return templateString;
}
