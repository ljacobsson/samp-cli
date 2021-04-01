const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const { Octokit } = require("@octokit/rest");
const open = require("open");
const fs = require("fs");
const github = new Octokit({
  auth: `token ${process.env.GITHUB_TOKEN}`,
});

const owner = "aws-samples";
const repo = "serverless-patterns";
const cfnDia = require("@mhlabs/cfn-diagram/graph/Vis");
async function run(cmd) {
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

  let cont = true;
  do {
    const pattern = await inputUtil.list("Select pattern", patterns);
    const templateString = await getContent(`/${pattern.name}/template.yaml`);
    const template = parser.parse("import", templateString);

    const readme = await getContent(`/${pattern.name}/README.md`);
    const summary = readme.split("\n").slice(0, 8).join("\n");
    console.log(summary);
    const action = await inputUtil.list("Learn more?", [
      `View on serverlessland.com`,
      `Visualise`,
      "Skip"
    ])
    if (action === "Visualise") {
      await cfnDia.renderTemplate(template, false, null, false, true);
    }
    if (action === "View on serverlessland.com") {
      open(`https://serverlessland.com/patterns/${pattern.name}`);
    }
    cont = await inputUtil.prompt("Continue?");
  } while (cont);
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
