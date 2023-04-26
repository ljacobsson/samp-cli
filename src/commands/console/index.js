const program = require("commander");
const cons = require("./console");
program
  .command("console")
  .alias("c")
  .description("Opens the AWS console for a deployed resource in your SAM template.")
  .option("-t, --template-file [templateFile]", "Path to SAM template file", "template.yaml")
  .option("-s, --stack-name [stackName]", "The name of the deployed stack")
  .option("-p, --profile [profile]", "AWS profile to use", "default")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .action(async (cmd) => {
    await cons.run(cmd);
  });
