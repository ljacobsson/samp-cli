const ini = require('ini');
const fs = require('fs');
const path = require('path');
const inputUtil = require("../../shared/inputUtil");
const YAML = require('json-to-pretty-yaml');
async function run(cmd) {
  if (!fs.existsSync(path.join(process.cwd(), 'samconfig.toml'))) {
    console.log("samconfig.toml not found");
    return;
  }

  const samconfig = ini.parse(fs.readFileSync(path.join(process.cwd(), 'samconfig.toml'), 'utf-8'));
  const samconfigYaml = YAML.stringify(samconfig);
  fs.writeFileSync(path.join(process.cwd(), 'samconfig.yaml'), samconfigYaml);
  deleteToml = await inputUtil.prompt("Conversion complete. Delete samconfig.toml? (Y/n)");
  if (deleteToml)
    fs.unlinkSync(path.join(process.cwd(), 'samconfig.toml'));
}

module.exports = {
  run,
};