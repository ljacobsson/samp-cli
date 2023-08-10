#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const program = require("commander");
const package = require("./package.json");
const fs = require("fs");
const path = require("path");
const axios = require("axios").default;

const commands = fs.readdirSync(path.join(__dirname, "src", "commands"));
for (const command of commands) {
  require(`./src/commands/${command}`);
}

program.version(package.version, "-v, --vers", "output the current version");

(async () => {
  try {
    const now = new Date();
    const latestVersion = await axios.get("https://api.github.com/repos/ljacobsson/samp-cli/releases/latest", { timeout: 300 })
    if (latestVersion.data.tag_name !== package.version) {
      console.log(`\nUpdate available: ${latestVersion.data.tag_name}. You are using ${package.version}.\nRun "npm i -g samp-cli" to update.\n`);
    }
  } catch (error) {
  } finally {
    program.parse(process.argv);
  }
})();


if (process.argv.length < 3) {
  program.help();
}

// nodejs<15 compatability
String.prototype.replaceAll = function (target, replacement) {
  return this.split(target).join(replacement);
};