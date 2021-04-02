const fs = require("fs");
const os = require("os");
const path = require("path");

const settingsPath = path.join(os.homedir(), ".sam-patterns-cli");
const settingsFilePath = path.join(settingsPath, "settings.json");

function save(settings) {
  let settingsObj = [];
  if (fs.existsSync(settingsFilePath)) {
    const file = fs.readFileSync(settingsFilePath);
    settingsObj = JSON.parse(file.toString());
  } else {
    try {
      fs.mkdirSync(settingsPath);
    } catch (err) {}
  }
  settingsObj.push(settings);

  fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObj, null, 2));
}

function get() {
  if (!fs.existsSync(settingsFilePath)) {
    return [];
  }
  const file = fs.readFileSync(settingsFilePath);
  return JSON.parse(file.toString());
}

module.exports = {
  save,
  get,
};
