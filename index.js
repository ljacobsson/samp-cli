#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const program = require("commander");
const package = require("./package.json");
const fs = require("fs");
const path = require("path");

const commands = fs.readdirSync(path.join(__dirname, "src", "commands"));
for (const command of commands) {
  require(`./src/commands/${command}`);
}

program.version(package.version, "-v, --vers", "output the current version");

program.parse(process.argv);
if (process.argv.length < 3) {
	program.help();
}

// nodejs<15 compatability
String.prototype.replaceAll = function (target, replacement) {
	return this.split(target).join(replacement);
};