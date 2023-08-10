const fs = require("fs");

const pwd = process.cwd();
function copyConfig(name, args) {
  let launchConfig = fs.readFileSync(`${__dirname}/config.xml`, "utf8");
  if (!fs.existsSync(`${pwd}/.run`)) {
    fs.mkdirSync(`${pwd}/.run`);
  }

  launchConfig = launchConfig.replace("#ARGS#", args.join(" "));
  launchConfig = launchConfig.replace("#NAME#", name);
  launchConfig = launchConfig.replace("#NODE_PATH#", process.execPath);
  launchConfig = launchConfig.replace("#SAMP_HOME#", process.argv[1]);
  
  fs.writeFileSync(`${pwd}/.run/${name}.run.xml`, launchConfig);
}

module.exports = {
  copyConfig
};
