const program = require("commander");
const sync = require("@mhlabs/sfn-cli/src/commands/sync/sync");
const init = require("@mhlabs/sfn-cli/src/commands/init/init");
const inputUtil = require("../../shared/inputUtil");
const testState = require("./test-state");
program
  .command("stepfunctions")
  .alias("sfn")
  .arguments("<command>",)
  .usage("stepfunctions [init|sync] [options]")
  .description("Initiates a state machine or sets up a live sync between your local ASL and the cloud")
  .option("-t, --template-file [templateFile]", "Path to SAM template file", "template.yaml")
  .option("-s, --stack-name [stackName]", "[Only applicable when syncing] The name of the deployed stack")
  .option("-p, --profile [profile]", "[Only applicable when syncing] AWS profile to use")
  .option("-w, --watch", "[Only applicable for test-state] Watch for changes in the ASL file and test automatically")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")

  .action(async (cmd, opts) => {
    try {
    if (cmd === "init") {
      opts.logicalId = await inputUtil.text("Name of state machine resource", "StateMachine");
      opts.aslFile = await inputUtil.text("Path to output ASL definition file", "statemachine.yaml");
      opts.eventSource = await inputUtil.list("Event source for state machine", ["none", "eventbridge", "api", "schedule"]);
      await init.run(opts);
    } else if (cmd === "sync") {
      await sync.run(opts);
    } else if (cmd === "test-state") {
      await testState.run(opts);
    } else {
      console.log("Unknown command. Valid commands are: init, sync, test-state");
    }
  } catch (e) {
    console.log("\n" + e.message + "\nTo see the full stack trace, set environment variable SAMP_DEBUG=1 and run the command again.");
    if (process.env.SAMP_DEBUG) {
      console.log(e.stack);
    }
    process.exit(1);
  }
    return;
  });
