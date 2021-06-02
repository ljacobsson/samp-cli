const program = require("commander");
const sourceUtil = require("./source");
program
  .command("source")
  .alias("s")
  .description("Adds a custom GitHub repository as a serverless patterns source")
  .action(async (cmd) => {
    await sourceUtil.run(cmd);
  });
