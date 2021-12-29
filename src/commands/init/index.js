const program = require("commander");
const init = require("./init");
program
  .command("init")
  .description("Initialises a SAM project from a quick-start template. See https://github.com/aws/aws-sam-cli-app-templates for examples and structure.")
  .option("-r, --add-repository", "GitHub repository where your templates are located", false)
  .action(async (cmd) => {
    await init.run(cmd);
  });
