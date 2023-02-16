const inputUtil = require("../../shared/inputUtil");
const settingsUtil = require("../../shared/settingsUtil");

async function run(cmd) {
  let settings = settingsUtil.getConfigSource();
  for (prop in cmd) {
    settings[prop] = cmd[prop];
  }
  settingsUtil.saveConfigSource(settings);

}

module.exports = {
  run,
};
