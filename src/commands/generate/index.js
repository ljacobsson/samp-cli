const program = require("commander");
const generate = require("./generate");
program
  .command("generate")
  .alias("g")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-q, --query [query]", "Question to ask ChatGPT. I.e \"a lambda function that's triggered by an S3 event\"")
  .option("-m, --model [model]", "OpenAI model to use. Valid values are 'gpt-3.5-turbo' and 'gpt-4'. Note that gpt-3.5-turbo is fine for most use cases and that gpt-4 is slower and more expensive", "gpt-3.5-turbo")
  .option("-o, --output [output]", "Output language. Valid values SAM or CDK. If CDK, set --output-file", "SAM")
  .option("-of, --output-file [output-file]", "Output file. Only applicable if --output is CDK")
  .description("Generates resources from a ChatGPT response")
  .action(async (cmd) => {
    await generate.run(cmd);
  });
