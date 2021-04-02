const program = require("commander");
const sourceUtil = require("./source");
program
  .command("source")
  .alias("s")
  .description("Imports a pattern from https://github.com/aws-samples/serverless-patterns/")
  .action(async (cmd) => {
    await sourceUtil.run(cmd);
  });
