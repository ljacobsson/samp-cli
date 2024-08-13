const program = require("commander");
const powertools = require("./powertools");
program
  .command("powertools")
  .alias("pt")
  .description("Adds Lambda Powertools to your project")
  .action(async (cmd) => {
    await powertools.run(cmd);
  });
