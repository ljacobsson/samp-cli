const program = require("commander");
const navigate = require("./navigate");
program
  .command("navigate")
  .alias("n")
  .description("Navigates the resources in your SAM template (currently vscode only)")
  .action(async (cmd) => {
    await navigate.run(cmd);
  });
