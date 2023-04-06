const program = require("commander");
const describe = require("./describe");
program
  .command("describe")
  .alias("d")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-r, --repository-path [repository]", "Github repository path, i.e \"aws-samples/serverless-patterns/apigw-sfn\"")
  .option("-m, --model [model]", "OpenAI model to use. Valid values are 'gpt-3.5-turbo' and 'gpt-4'. Note that gpt-3.5-turbo is fine for most use cases and that gpt-4 is slower and more expensive", "gpt-3.5-turbo")
  .description("Describes a SAM template using ChatGPT")
  .action(async (cmd) => {
    await describe.run(cmd);
  });
