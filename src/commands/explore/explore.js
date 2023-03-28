const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const open = require("open");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");

const githubUtil = require("../../shared/githubUtil");

async function run(cmd) {
  const patterns = await githubUtil.getPatterns();

  let cont = true;
  do {
    const pattern = await inputUtil.list("Select pattern", patterns);
    let templateString;
    for (const fileName of pattern.setting.fileNames) {
      templateString = undefined;
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
    try {
      const readme = await githubUtil.getContent(
        pattern.setting.owner,
        pattern.setting.repo,
        `/${pattern.pattern.name}${pattern.setting.relativePath}/README.md`.replace(
          /\/\//g,
          "/"
        )
      );
      const summary = readme.split("\n").slice(0, 8).join("\n");
      console.log(summary);
    } catch (err) {
      // README.md is not mandatory
    }
    const url = pattern.setting.url.replace("https://", "");
    const action = await inputUtil.list("Learn more?", [
      `View documentation`,
      "Skip",
    ]);
    if (action === "View documentation") {
      open(
        `${pattern.setting.url.replace(
          "#PATTERN_NAME#",
          pattern.pattern.name
        )}`.replace(/\/\//g, "/")
      );
    }
    cont = await inputUtil.prompt("Continue?");
  } while (cont);
}

module.exports = {
  run,
};
