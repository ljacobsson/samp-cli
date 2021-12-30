const nunjucks = require("nunjucks");
const inputUtil = require("../../shared/inputUtil");
const githubUtil = require("../../shared/githubUtil");
const runtimes = require("../../shared/runtimes.json");
const { Octokit } = require("@octokit/rest");
const fs = require("fs-extra");
const settingsUtil = require("../../shared/settingsUtil");

let github;
if (process.env.GITHUB_TOKEN) {
  github = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`,
  });
} else {
  github = new Octokit();
}

async function run(cmd) {
  if (cmd.addRepository) {
    await addRepo();
  }
  const sourceRepo = await getSourceRepos();

  let path = sourceRepo.path;
  do {
    const contents = await github.repos.getContent({
      owner: sourceRepo.org,
      repo: sourceRepo.repo,
      path: path,
    });
    if (contents.data.map((p) => p.name).includes("cookiecutter.json")) {
      // We have found a project
      break;
    }
    const runtimeNames = runtimes.map((p) => p.name);
    const selection = await inputUtil.autocomplete(
      "Please select",
      contents.data
        .filter(
          (p) =>
            (path !== "" && p.type === "dir") ||
            runtimeNames.filter((q) => p.name.startsWith(q)).length
        )
        .map((p) => {
          return {
            name: p.name.replace("cookiecutter-", "").replace("aws-sam-", ""),
            value: p,
          };
        })
    );
    path += `/${selection.name}`;
  } while (true);

  const tree = await github.git.getTree({
    owner: sourceRepo.org,
    repo: sourceRepo.repo,
    tree_sha: sourceRepo.branch || "master",
    recursive: true,
  });
  path = path.substring(1);
  const cookiecutterFile = await githubUtil.getContent(
    sourceRepo.org,
    sourceRepo.repo,
    `${path}/cookiecutter.json`,
    sourceRepo.branch
  );
  let cookiecutter = JSON.parse(
    cookiecutterFile.replaceAll("cookiecutter.", "cookiecutter_")
  );
  for (const key of Object.keys(cookiecutter)) {
    if (typeof cookiecutter[key] !== "string") {
      continue;
    }
    cookiecutter[key] = await inputUtil.text(
      capitalizeFirstLetter(key.replaceAll("_", " ")),
      nunjucks.renderString(cookiecutter[key], cookiecutter) ||
        nunjucks.renderString(
          cookiecutter[key].replace("cookiecutter_", ""),
          cookiecutter
        )
    );
  }

  for (const key of Object.keys(cookiecutter)) {
    if (!key.startsWith("cookiecutter.")) {
      cookiecutter[`cookiecutter_${key}`] = cookiecutter[key];
      delete cookiecutter[key];
    }
  }
  const filePromises = [];
  let aPath;
  for (const item of tree.data.tree
    .filter(
      (p) =>
        p.path.startsWith(`${path}/{{`) &&
        !p.path.endsWith("cookiecutter.json") &&
        !p.path.endsWith("setup.cfg")
    )
    .map((p) => p.path)) {
    filePromises.push(getFile(item, cookiecutter, path, sourceRepo));
    aPath = item;
  }
  await Promise.all(filePromises);
  console.log(`Your project has been generated under ./${nunjucks.renderString(replaceCookieDot(aPath), cookiecutter).replace(path, "").split("/")[1]}`);
}

function replaceCookieDot(aPath) {
  return aPath.replaceAll("cookiecutter.", "cookiecutter_");
}

async function getSourceRepos() {
  const initRepos = [
    ...settingsUtil.getInitSource(),
    { org: "aws", repo: "aws-sam-cli-app-templates", path: "" },
  ];

  const sourceRepo = await inputUtil.autocomplete(
    "Select repository",
    initRepos.map((p) => {
      return { name: `${p.org}/${p.repo}`, value: p };
    })
  );
  return sourceRepo;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function addRepo() {
  const org = await inputUtil.text("GitHub organisation", "my-org");
  const repo = await inputUtil.text("Repository", "my-repo");
  let path = await inputUtil.text("Path", "/");
  let branch = await inputUtil.text("Branch", "main");
  if (path === "/") {
    path = "";
  }
  if (path.startsWith("/")) {
    path = path.substring(1);
  }
  settingsUtil.saveInitSource({ org, repo, path, branch });
}

async function getFile(item, cookiecutter, path, sourceRepo) {
  const filePath = nunjucks.renderString(
    item.replaceAll("cookiecutter.", "cookiecutter_"),
    cookiecutter
  );
  let file;
  try {
    file = await githubUtil.getContent(
      sourceRepo.org,
      sourceRepo.repo,
      item,
      sourceRepo.branch
    );
  } catch (err) {
    // hack to identify directories
  }

  if (file) {
    let outputPath = filePath.replace(`${path}/`, "");
    fs.outputFileSync(
      outputPath,
      nunjucks.renderString(
        file.replaceAll("cookiecutter.", "cookiecutter_"),
        cookiecutter
      )
    );
  }
}

module.exports = {
  run,
};
