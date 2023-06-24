const program = require("commander");
const configUtil = require("./configure");
program
  .command("configure")
  .alias("co")
  .option("--github-token <github-token>", "GitHub token")
  .option("--openai-api-key <openai-api-key>", "OpenAI API key")
  .description("Adds cofiguration parameters to the CLI")
  .action(async (cmd) => {
    await configUtil.run(cmd);
  });
