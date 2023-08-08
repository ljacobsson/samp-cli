const fs = require("fs");
const commentJson = require('comment-json')

const pwd = process.cwd();
async function copyConfig(name, args) {
  let launchJson;
  if (fs.existsSync(`${pwd}/.vscode/launch.json`)) {
    let fileContent = fs.readFileSync(`${pwd}/.vscode/launch.json`, "utf8");
    launchJson = commentJson.parse(fileContent);
  } else {
    launchJson = {
      "version": "0.2.0",
      "configurations": []
    };
  }
  const launchConfig = require(`${__dirname}/launch.json`);

  launchConfig.configurations[0].name = name;
  launchConfig.configurations[0].args = args;

  if (!launchJson.configurations.find(c => c.name === name)) {
  launchJson.configurations.push(launchConfig.configurations[0]);
  } else {
    launchJson.configurations = launchJson.configurations.map(c => {
      if (c.name === name) {
        return launchConfig.configurations[0];
      }
      return c;
    });
  }

  if (!fs.existsSync(`${pwd}/.vscode`)) {
    fs.mkdirSync(`${pwd}/.vscode`);
  }
  fs.writeFileSync(`${pwd}/.vscode/launch.json`, commentJson.stringify(launchJson, null, 2));
}

module.exports = {
  copyConfig
};
