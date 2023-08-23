const program = require("commander");
const traces = require("@mhlabs/xray-cli/src/commands/traces/traces");
program
  .command("traces")
  .alias("t")
  .description("Browses and renders AWS X-Ray traces in your account")
  .option("-s, --start <start>", "Start time (minutes ago)", 5)
  .option("-e, --end <end>", "End time (minutes ago)", 0)
  .option("-as, --absolute-start <start>", "Start time (ISO 8601)")
  .option("-ae, --absolute-end <end>", "End time (ISO 8601)")
  .option("-f, --filter-expression <filter>", "Filter expression. Must be inside double or single quotes (\"/')")
  .option("-p, --profile <profile>", "AWS profile to use", "default")
  .option("-r, --region <region>", "AWS region to use")
  .action(async (cmd) => {
    await traces.run(cmd);
  });
