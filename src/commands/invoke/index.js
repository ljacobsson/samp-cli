const program = require("commander");
const cons = require("./invoke");
program
  .command("invoke")
  .alias("in")
  .description("Invokes a Lambda function or a StepFunctions state machine")
  .option("-s, --stack-name [stackName]", "The name of the deployed stack")
  .option("-pl, --payload [payload]", "The payload to send to the function. Could be stringified JSON, a file path to a JSON file or the name of a shared test event")
  .option("-p, --profile [profile]", "AWS profile to use", "default")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .action(async (cmd) => {
    await cons.run(cmd);
  });
