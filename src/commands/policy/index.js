const program = require("commander");
const iamPolicies = require("@mhlabs/iam-policies-cli/src/input-wizard")

program
  .command("policy")
  .alias("p")
  .description("Opens a wizard thet help you to create and attach a new IAM policy to a resource in your template")
  .option(
    "-t, --template <filename>",
    "Template file name",
    "template.yaml"
  )
  .option("-f, --format <JSON|YAML>", "Output format", "JSON")
  .option("-o, --output <console|clipboard>", "Policy output", "console")
  .action(async (cmd) => {
    await iamPolicies.start(cmd.template, cmd.format, cmd.output);
  });
