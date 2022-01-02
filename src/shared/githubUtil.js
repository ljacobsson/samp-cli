const { Octokit } = require("@octokit/rest");
const { Separator } = require("inquirer");
const { exclude } = require("inquirer/lib/objects/separator");
const settingsUtil = require("./settingsUtil");
let github;
if (process.env.GITHUB_TOKEN) {
  github = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`,
  });
} else {
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
    fileNames: ["template.yml", "template.yaml"],
    excludeRegex: /cdk/,
    url: "https://serverlessland.com/patterns/#PATTERN_NAME#",
  },
  ...settingsUtil.getPatternSource(),
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
    patternsList.push(
      new Separator(`*** ${setting.owner}/${setting.repo} ***`)
    );
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
          return { name: p.name, value: { pattern: p, setting } };
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

async function getContent(owner, repo, path, branch) {
  console.log(owner, repo, path, branch || "master");
  const templateFile = await github.repos.getContent({
    owner,
    repo,
    path,  
    ref: branch,
  });
  const templateString = Buffer.from(
    templateFile.data.content,
    "base64"
  ).toString();
  return templateString;
}

async function putContent(org, repo, branch, file, content, addReadme) {
  // gets commit's AND its tree's SHA
  if (file[0] === "/") file = file.substring(1);
  const split = file.split("/");
  const readmeStub = `# ${split.slice(-2)[0]}`;
  split.pop();
  let pathsForBlobs;
  if (addReadme) {
    const readmeFile = `${split.join("/")}/README.md`;
    filesBlobs = await Promise.all([
      createBlob(github, org, repo, content),
      createBlob(github, org, repo, readmeStub),
    ]);
    pathsForBlobs = [file, readmeFile];
  } else {
    filesBlobs = await Promise.all([createBlob(github, org, repo, content)]);
    pathsForBlobs = [file];
  }
  const currentCommit = await getCurrentCommit(github, org, repo, branch);
  const newTree = await createNewTree(
    github,
    org,
    repo,
    filesBlobs,
    pathsForBlobs,
    currentCommit.treeSha
  );
  const newCommit = await createNewCommit(
    github,
    org,
    repo,
    `Adding ${file}`,
    newTree.sha,
    currentCommit.commitSha
  );
  await setBranchToCommit(github, org, repo, branch, newCommit.sha);
}

const getCurrentCommit = async (github, org, repo, branch) => {
  const { data: refData } = await github.git.getRef({
    owner: org,
    repo: repo,
    ref: `heads/${branch}`,
  });
  const commitSha = refData.object.sha;
  const { data: commitData } = await github.git.getCommit({
    owner: org,
    repo: repo,
    commit_sha: commitSha,
  });
  return {
    commitSha,
    treeSha: commitData.tree.sha,
  };
};

const createBlob = async (github, org, repo, content) => {
  const blobData = await github.git.createBlob({
    owner: org,
    repo: repo,
    content,
    encoding: "utf-8",
  });
  return blobData.data;
};

const createNewTree = async (
  github,
  org,
  repo,
  blobs,
  paths,
  parentTreeSha
) => {
  const tree = blobs.map(({ sha }, index) => ({
    path: paths[index],
    mode: `100644`,
    type: `blob`,
    sha,
  }));
  const { data } = await github.git.createTree({
    owner: org,
    repo: repo,
    tree,
    base_tree: parentTreeSha,
  });
  return data;
};

const createNewCommit = async (
  github,
  org,
  repo,
  message,
  currentTreeSha,
  currentCommitSha
) =>
  (
    await github.git.createCommit({
      owner: org,
      repo: repo,
      message,
      tree: currentTreeSha,
      parents: [currentCommitSha],
    })
  ).data;

const setBranchToCommit = async (github, org, repo, branch, commitSha) =>
  await github.git.updateRef({
    owner: org,
    repo: repo,
    ref: `heads/${branch}`,
    sha: commitSha,
  });

module.exports = {
  getPatterns,
  getContent,
  putContent,
};
