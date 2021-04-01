const program = require("commander");
const importUtil = require("./explore");
program
  .command("explore")
  .alias("e")
  .description("Explores and visualises patterns from https://github.com/aws-samples/serverless-patterns/")
  .action(async (cmd) => {
    await importUtil.run(cmd);
  });
