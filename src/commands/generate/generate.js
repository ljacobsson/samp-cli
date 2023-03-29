const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const { Configuration, OpenAIApi } = require("openai");
const settingsUtil = require("../../shared/settingsUtil");
const fs = require("fs-extra");
var Spinner = require('cli-spinner').Spinner;
const baseFile = require("../../shared/baseFile.json");

var spinner = new Spinner('Waiting for ChatGPT... %s');
spinner.setSpinnerString('|/-\\');
async function run(cmd) {
  console.log("*** Note: This is an experimental feature and depends on the ChatGPT API. Make sure you review the output carefully before using it in production ***")
  const output = cmd.output.toLowerCase();
  if (output !== "sam" && !cmd.outputFile) {
    console.log(`You need to specify an output file with --output-file`);
    return;
  }
  const apiKey = settingsUtil.getConfigSource().openaiApiKey;
  if (!apiKey) {
    console.log(
      "You need to set your OpenAI API key. Use the 'sam-patterns configure' command to do this. You can get your API key from https://platform.openai.com/account/api-keys"
    );
    return;
  }
  let ownTemplate;
  if (output === "sam") {
    if (!fs.existsSync(cmd.template)) {
      console.log(
        `Can't find ${cmd.template}. Use -t option to specify template filename`
      );
      const create = await inputUtil.prompt(`Create ${cmd.template}?`);
      if (create) {
        fs.writeFileSync(cmd.template, parser.stringify("yaml", baseFile));
      } else {
        return;
      }
    }

    ownTemplate = parser.parse("own", fs.readFileSync(cmd.template));
    ownTemplate.Resources = ownTemplate.Resources || {};
  }
  const configuration = new Configuration({
    apiKey,
  });
  const openai = new OpenAIApi(configuration);
  let outputString;
  let language;
  switch (output.substring(0, 3)) {
    case "sam":
      outputString = "SAM JSON";
      break;
    case "cdk":
      outputString = "TypeScript CDK";
      break;
    case "lam":
      outputString = "Lambda";
      language = output.split("-")[1];
      if (language) {
        outputString += ` in ${language}`;
      }

      break;
    case "asl":
      outputString = "StepFunctions ASL YAML";
      break;
    default:
      console.log(`Invalid output format ${output}. Valid values are 'SAM', 'CDK', 'lambda-<language>' or 'ASL'`);
      return;
  }
  const prompt = `Generate this in AWS ${outputString}: ${cmd.query}. Only return code.`;

  const openAiRequest = {
    model: cmd.model,
    messages: [
      {
        role: "user",
        content: prompt,
      }
    ],
    temperature: 0.5,
    max_tokens: 2000
  };
  spinner.start();
  const response = await openai.createChatCompletion(openAiRequest);
  spinner.stop();
  let text = response.data.choices[0].message.content;
  // get the first JSON object in the text
  let obj;
  if (output === "sam") {
    try {
      obj = JSON.parse(text.replace(/\n/g, '').replace(/```/g, '').match(/{.*}/)[0]);
    } catch (e) {
      try {
        obj = parser.parse("yaml", text);
      } catch (e) {
        console.log(`Couldn't parse the output from ChatGPT. Try again. The output was: \n${text}\n\nThe error was: ${e}`);
        return;
      }
    }
    if (obj.Resources) {
      obj = obj.Resources;
    }

    console.log(`\n\nGenerated the following resources:\n\n${parser.stringify("yaml", obj)}`);
  } else {
    console.log(text);
    //check if text has a row starting with ``` followed by text. If so, remove that text
    const match = text.match(/```.+\n/);
    if (match && match[0]) {
      text = text.replace(match[0], '```\n');
    }
    if (text.match(/```/g)) {
      text = text.replace(/\n/g, "¶").match(/```.*```/)[0].split("¶").join('\n').replace(/```/g, '');
    }
    console.log(`\n\nGenerated the following ${language} code:\n\n${text}`);
  }
  const cont = await inputUtil.prompt(output === "sam" ? `Add to template?` : `Add to ${cmd.outputFile}?`);
  if (!cont) {
    return;
  }

  if (output !== "sam") {
    if (!cmd.outputFile) {
      console.log(`You need to specify an output file with --output-file`);
      return;
    }
    if (fs.existsSync(cmd.outputFile)) {
      const cont = await inputUtil.prompt(`Overwrite ${cmd.outputFile}?`);
      if (!cont) {
        return;
      }
    }
    fs.writeFileSync(cmd.outputFile, text);
    return;
  }

  for (const key in obj) {
    if (ownTemplate.Resources[key]) {
      console.log(
        `Resource ${key} already exists in ${cmd.template}. Renaming to ${key}_2.`
      );
      obj[`${key}_2`] = obj[key];
      delete obj[key];
    }
  }
  const newTemplate = {
    ...ownTemplate,
    Resources: {
      ...ownTemplate.Resources,
      ...obj
    }
  }
  fs.writeFileSync(cmd.template, parser.stringify("own", newTemplate));

  console.log(
    `${cmd.template} updated with ${cmd.query}. You'll want to sanity check the output to make sure it's correct.`
  );
}

module.exports = {
  run,
};
