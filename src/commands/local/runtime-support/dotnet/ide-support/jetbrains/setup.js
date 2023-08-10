const fs = require("fs");

const pwd = process.cwd();
function copyConfig(name) {
  const launchConfig = fs.readFileSync(`${__dirname}/config.xml`, "utf8");
  if (!fs.existsSync(`${pwd}/.run`)) {
    fs.mkdirSync(`${pwd}/.run`);
  }
  fs.writeFileSync(`${pwd}/.run/${name}.run.xml`, launchConfig);
}

module.exports = {
  copyConfig
};
