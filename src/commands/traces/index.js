const program = require("commander");
const traces = require("@mhlabs/xray-cli/src/commands/traces/traces");
const samConfigParser = require("../../shared/samConfigParser");
program
  .command("traces")
  .alias("t")
  .description("Browses and renders AWS X-Ray traces in your account")
  .option("-s, --start <start>", "Start time (minutes ago)", 5)
  .option("-e, --end <end>", "End time (minutes ago)", 0)
  .option("-as, --absolute-start <start>", "Start time (ISO 8601)")
  .option("-ae, --absolute-end <end>", "End time (ISO 8601)")
  .option("-f, --filter-expression <filter>", "Filter expression. Must be inside double or single quotes (\"/')")
  .option("-p, --profile <profile>", "AWS profile to use")
  .option("-r, --region <region>", "AWS region to use")
  .action(async (cmd) => {
    const config = await samConfigParser.parse();
    cmd.region = cmd.region || config.region;
    cmd.profile = cmd.profile || config.profile || 'default';
  
    await traces.run(cmd);
  });
