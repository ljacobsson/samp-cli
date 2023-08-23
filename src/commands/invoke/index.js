const program = require("commander");
const cons = require("./invoke");
program
  .command("invoke")
  .alias("in")
  .description("Invokes a Lambda function or a StepFunctions state machine")
  .option("-s, --stack-name [stackName]", "The name of the deployed stack")
  .option("-r, --resource [resource]", "The resource (function name or state machine ARN) to invoke. If not specified, you will be prompted to select one")
  .option("-pl, --payload [payload]", "The payload to send to the function. Could be stringified JSON, a file path to a JSON file or the name of a shared test event")
  .option("-l, --latest", "Invokes the latest request that was sent to the function", false)
  .option("-p, --profile [profile]", "AWS profile to use", "default")
  .option("-sync", "--synchronous", "StepFuncitons only - wait for the state machine to finish and print the output", false)
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .action(async (cmd) => {
    await cons.run(cmd);
  });
