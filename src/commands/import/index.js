const program = require("commander");
const importUtil = require("./import");
program
  .command("import")
  .alias("i")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-m, --merge", "Merge pattern with existing template resource(s)", false)
  .option("-a, --asl-format [asl-format]", "Output format for StepFunctions ASL definitions (YAML or JSON)", "YAML")
  .option("-f, --source-filter [source-filter]", "Filter text to match against source collection names. Optional", "")
  .description("Imports a pattern from https://github.com/aws-samples/serverless-patterns/")
  .action(async (cmd) => {
    await importUtil.run(cmd);
  });
