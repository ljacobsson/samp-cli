#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const program = require("commander");
const package = require("./package.json");
require("./src/commands/import");
require("./src/commands/explore");
require("./src/commands/source");
require("./src/commands/share");
require("./src/commands/init");
require("./src/commands/policy");

program.version(package.version, "-v, --vers", "output the current version");

program.parse(process.argv);
if (process.argv.length < 3) {
  program.help();
}
