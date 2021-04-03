const { Octokit } = require("@octokit/rest");
const { Separator } = require("inquirer");
const { exclude } = require("inquirer/lib/objects/separator");
const settingsUtil = require("./settingsUtil");
let github;
if (process.env.GITHUB_TOKEN) {
  github = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`,
  });  
} else
{
  github = new Octokit();
}

const owner = "aws-samples";
const repo = "serverless-patterns";
const settings = [
  {
    owner: "aws-samples",
    repo: "serverless-patterns",
    root: "/",
    relativePath: "/",
    fileNames: ["template.yml","template.yaml"],
    excludeRegex: /cdk/,
    url: "https://serverlessland.com/patterns/#PATTERN_NAME#"
  },
  ...settingsUtil.get(),
];

function sanitize(setting) {
  if (setting.root.length && setting.root[0] === "/") {
    setting.root = setting.root.substring(1);
  }
}

async function getPatterns() {
  const patternsList = [];
  for (const setting of settings) {
    sanitize(setting);
    patternsList.push(new Separator(`*** ${setting.owner}/${setting.repo} ***`))
    try {
      const repoRoot = await github.repos.getContent({
        owner: setting.owner,
        repo: setting.repo,
        path: setting.root,
      });
      const patterns = await repoRoot.data
        .filter(
          (p) =>
            p.type === "dir" &&
            /[a-zA-Z]/.test(p.name[0]) &&
            (!setting.excludeRegex || !setting.excludeRegex.test(p.name))
        )
        .map((p) => {
          return { name: p.name, value: {pattern:p, setting} };
        });
      patternsList.push(...patterns);
    } catch (err) {
      console.log(
        `Could not find patterns for ${setting.owner}/${setting.repo}. Looked in https://github.com/${setting.owner}/${setting.repo}/tree/master/${setting.root}`
      );
      continue;
    }
  }
  return patternsList;
}

async function getContent(owner, repo, path) {
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

module.exports = {
  getPatterns,
  getContent,
};
