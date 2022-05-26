const program = require("commander");
const returnValues = require("./return-values");
program
  .command("return-values")
  .alias("rv")
  .description("Browses the return values and the intrinsic functions of a CloudFormation/SAM resource")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-c, --clipboard", "Send the return value's intrinsic function to the clipboard", false)
  .action(async (cmd) => {
    await returnValues.run(cmd);
  });
