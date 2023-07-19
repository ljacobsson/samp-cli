const program = require("commander");
const convert = require("./convertToml");
program
  .command("convert-samconfig")
  .description("Converts samconfig.toml to samconfig.yaml")
  .alias("cs")
  .action(async (cmd) => {
    await convert.run(cmd);
  });
