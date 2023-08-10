const fs = require("fs");

const pwd = process.cwd();
function copyConfig(name) {
  const launchConfig = fs.readFileSync(`${__dirname}/config.xml`, "utf8");
  if (!fs.existsSync(`${pwd}/.run`)) {
    fs.mkdirSync(`${pwd}/.run`);
  }
  if (!fs.existsSync(`${pwd}/.idea`)) {
    fs.mkdirSync(`${pwd}/.idea`);
  }
  if (!fs.existsSync(`${pwd}/.idea/runConfigurations`)) {
    fs.mkdirSync(`${pwd}/.idea/runConfigurations`);
  }
  fs.writeFileSync(`${pwd}/.idea/runConfigurations/${name}.xml`, launchConfig);
}

module.exports = {
  copyConfig
};
