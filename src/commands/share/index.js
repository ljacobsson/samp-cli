const program = require("commander");
const shareUtil = require("./share");
program
  .command("share")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .description("Shares a pattern to a linked github repository")
  .action(async (cmd) => {
    await shareUtil.run(cmd);
  });
