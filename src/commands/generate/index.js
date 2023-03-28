const program = require("commander");
const generate = require("./generate");
program
  .command("generate")
  .alias("g")
  .option("-t, --template [template]", "SAM template file", "template.yaml")
  .option("-q, --question [question]", "Question to ask ChatGPT. I.e \"a lambda function that's triggered by an S3 event\"")
  .description("Generates resources from a GPT question")
  .action(async (cmd) => {
    await generate.run(cmd);
  });
