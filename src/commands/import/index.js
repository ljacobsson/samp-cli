const program = require("commander");
const importUtil = require("./import");
program
  .command("import")
  .alias("i")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .description("Imports a pattern from https://github.com/aws-samples/serverless-patterns/")
  .action(async (cmd) => {
    await importUtil.run(cmd);
  });
