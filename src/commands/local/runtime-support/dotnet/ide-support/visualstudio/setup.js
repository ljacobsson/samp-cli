const fs = require("fs");
const JSON = require('comment-json')

const pwd = process.cwd();
function copyConfig(name) {
  launchSettings = {
  }
  try {
    launchSettings = JSON.parse(fs.readFileSync(`Properties/launchSettings.json`, "utf8"));
  } catch (error) {
  }

  launchSettings.profiles = launchSettings.profiles || {};

  launchSettings.profiles[name] = {
    "commandName": "Executable",
    "executablePath": "$(SolutionDir).samp-out\\bin\\Debug\\net6.0\\dotnet.exe",
    "workingDirectory": "$(SolutionDir).samp-out",
    "remoteDebugEnabled": false
  }

  if (!fs.existsSync(`${pwd}/Properties`)) {
    fs.mkdirSync(`${pwd}/Properties`);
  }

  fs.writeFileSync(`${pwd}/Properties/launchSettings.json`, JSON.stringify(launchSettings, null, 2));
}

module.exports = {
  copyConfig
};
