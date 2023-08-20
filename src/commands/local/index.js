const program = require("commander");
const local = require("./local");
program
  .command("local")
  .alias("l")
  .description("Sets up a debugging session where the Lambda invocations in the cloud gets executed on your local machine")
  .option("-s, --stack-name [stackName]", "The name of the deployed stack")
  .option("--force-restore", "Force restore of the original Lambda code", false)
  .option("--merge-package-jsons", "For projects that use one project.json per function subfolder, this merges them into one to enable package resolution whilsh running this command", false)
  .option("-f, --functions [functions]", "Select which functions to be part of the debugging session. Comma separated list of logical IDs.")
  .option("-c --construct [construct]", "CDK only. Relative path to where the stack constructs are found. Default: ./lib/<the value of --stack-name>.ts")  
  .option("-i --ide [ide]", "IDE to configure for debugging. Default behaviour will attempt to figure it out automatically or prompt you to select one. Valid values: vscode, visualstudio, jetbrains (for WebStorm, Rider or PyCharm)")  
  .option("-d, --debug", "Configure debug for vscode. This only needs to be run once per project", false)
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .action(async (cmd) => {
    cmd.construct = cmd.construct || `./lib/${cmd.stackName}.ts`;
    await local.run(cmd);
  });
