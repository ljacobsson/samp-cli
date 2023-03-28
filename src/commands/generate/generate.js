const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const { Configuration, OpenAIApi } = require("openai");
const settingsUtil = require("../../shared/settingsUtil");
const fs = require("fs-extra");
var Spinner = require('cli-spinner').Spinner;

var spinner = new Spinner('Waiting for ChatGPT... %s');
spinner.setSpinnerString('|/-\\');
async function run(cmd) {
  const apiKey = settingsUtil.getConfigSource().openaiApiKey;
  if (!apiKey) {
    console.log(
      "You need to set your OpenAI API key. Use the 'sam-patterns configure' command to do this. You can get your API key from https://platform.openai.com/account/api-keys"
    );
  }
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

  const ownTemplate = parser.parse("own", fs.readFileSync(cmd.template));
  ownTemplate.Resources = ownTemplate.Resources || {};

  const configuration = new Configuration({
    apiKey,
  });
  const openai = new OpenAIApi(configuration);

  const prompt = `Generate this in AWS SAM JSON: ${cmd.query}`;

  const openAiRequest = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: prompt,
      }
    ],
    temperature: 0.5,
    max_tokens: 1000
  };
  spinner.start();
  const response = await openai.createChatCompletion(openAiRequest);
  spinner.stop();
  const text = response.data.choices[0].message.content;
  // get the first JSON object in the text
  let obj;
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

  console.log(`Generated the following resources: ${parser.stringify("yaml", obj)}`);
  const cont = await inputUtil.prompt(`Add to template?`);
  if (!cont) {
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
