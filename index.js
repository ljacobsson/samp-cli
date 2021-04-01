#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
process.env.AWS_SDK_LOAD_CONFIG = 1;
const program = require("commander");
const package = require("./package.json");
require("./src/commands/import");
require("./src/commands/explore");

program.version(package.version, "-v, --vers", "output the current version");

program.parse(process.argv);
if (process.argv.length < 3) {
  program.help();
}
