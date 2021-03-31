#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const AWS = require("aws-sdk");
process.env.AWS_SDK_LOAD_CONFIG = 1;
const program = require("commander");
const package = require("./package.json");
require("./src/commands/import");

program.version(package.version, "-v, --vers", "output the current version");

program.parse(process.argv);
if (process.argv.length < 3) {
  program.help();
}
