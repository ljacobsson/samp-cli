const toml = require('toml');
const fs = require('fs');
const path = require('path');
const inputUtil = require("../../shared/inputUtil");
const YAML = require('yaml');
async function run(cmd) {
  if (!fs.existsSync(path.join(process.cwd(), 'samconfig.toml'))) {
    console.log("samconfig.toml not found");
    return;
  }

  const samconfig = toml.parse(fs.readFileSync(path.join(process.cwd(), 'samconfig.toml'), 'utf-8'));
  const samconfigYaml = YAML.stringify(samconfig);
  fs.writeFileSync(path.join(process.cwd(), 'samconfig.yaml'), samconfigYaml);
  deleteToml = await inputUtil.prompt("Conversion complete. Delete samconfig.toml? (Y/n)");
  if (deleteToml)
    fs.unlinkSync(path.join(process.cwd(), 'samconfig.toml'));
}

module.exports = {
  run,
};