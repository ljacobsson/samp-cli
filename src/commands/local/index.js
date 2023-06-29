const program = require("commander");
const local = require("./local");
program
  .command("local")
  .alias("l")
  .description("Sets up a debugging session where the Lambda invocations in the cloud gets executed on your local machine")
  .option("-s, --stack-name [stackName]", "The name of the deployed stack")
  .option("--force-restore", "Force restore of the original Lambda code", false)
  .option("-f, --functions [functions]", "Select which functions to be part of the debugging session. Comma separated list of logical IDs.", "ALL")
  .option("-d, --debug", "Configure debug for vscode. This only needs to be run once per project", false)
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .action(async (cmd) => {
    await local.run(cmd);
  });
