const fs = require("fs");
const os = require("os");
const path = require("path");

const settingsPath = path.join(os.homedir(), ".sam-patterns-cli");
const settingsFilePath = path.join(settingsPath, "settings.json");

function savePatternSource(settings) {
  let settingsObj = {
    patternSources: [],
    initSources: [],
  };
  if (fs.existsSync(settingsFilePath)) {
    const file = fs.readFileSync(settingsFilePath);
    settingsObj = JSON.parse(file.toString());
  } else {
    try {
      fs.mkdirSync(settingsPath);
    } catch (err) {}
  }
  if (Array.isArray(settingsObj)) {
    settingsObj = { patternSources: settingsObj, initSources: [] };
  }
  settingsObj.patternSources.push(settings);

  fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObj, null, 2));
}

function saveInitSource(settings) {
  let settingsObj = {
    patternSources: [],
    initSources: [],
  };
  if (fs.existsSync(settingsFilePath)) {
    const file = fs.readFileSync(settingsFilePath);
    settingsObj = JSON.parse(file.toString());
  } else {
    try {
      fs.mkdirSync(settingsPath);
    } catch (err) {}
  }
  if (Array.isArray(settingsObj)) {
    settingsObj = { patternSources: settingsObj, initSources: [] };
  }
  settingsObj.initSources.push(settings);

  fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObj, null, 2));
}

function saveConfigSource(setting) {
  let settingsObj = {
    patternSources: [],
    initSources: [],
  };
  if (fs.existsSync(settingsFilePath)) {
    const file = fs.readFileSync(settingsFilePath);
    settingsObj = JSON.parse(file.toString());
  } else {
    try {
      fs.mkdirSync(settingsPath);
    } catch (err) {}
  }
  settingsObj.config = setting;

  fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObj, null, 2));
}

function getPatternSource() {
  if (!fs.existsSync(settingsFilePath)) {
    return [];
  }
  const file = fs.readFileSync(settingsFilePath);
  const obj = JSON.parse(file.toString());
  if (Array.isArray(obj)) {
    objV2 = { patternSources: obj, initSources: [] };
  } else {
    objV2 = obj;
  }
  return objV2.patternSources;
}

function getInitSource() {
  if (!fs.existsSync(settingsFilePath)) {
    return [];
  }
  const file = fs.readFileSync(settingsFilePath);
  const obj = JSON.parse(file.toString());
  if (Array.isArray(obj)) {
    objV2 = { patternSources: obj, initSources: [] };
  } else {
    objV2 = obj;
  }
  return objV2.initSources;
}

function getConfigSource() {
  if (!fs.existsSync(settingsFilePath)) {
    return {};
  }
  const file = fs.readFileSync(settingsFilePath);
  const obj = JSON.parse(file.toString());
  if (Array.isArray(obj)) {
    objV2 = { patternSources: [], initSources: [], config: obj };
  } else {
    objV2 = obj;
  }
  return objV2.config || {};
}

module.exports = {
  savePatternSource,
  saveInitSource,
  saveConfigSource,
  getPatternSource,
  getInitSource,
  getConfigSource,
};
