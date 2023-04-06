const inputUtil = require("../../shared/inputUtil");
const parser = require("../../shared/parser");
const { Configuration, OpenAIApi } = require("openai");
const settingsUtil = require("../../shared/settingsUtil");
const fs = require("fs-extra");
var Spinner = require('cli-spinner').Spinner;
const baseFile = require("../../shared/baseFile.json");
const githubUtil = require("../../shared/githubUtil");
var spinner = new Spinner('Waiting for ChatGPT... %s');
spinner.setSpinnerString('|/-\\');
async function run(cmd) {
  const apiKey = settingsUtil.getConfigSource().openaiApiKey;
  if (!apiKey) {
    console.log(
      "You need to set your OpenAI API key. Use the 'sam-patterns configure' command to do this. You can get your API key from https://platform.openai.com/account/api-keys"
    );
    return;
  }

  let template
  if (!cmd.repositoryPath) {
    template = await fs.readFile(cmd.template, "utf8");

  } else {

    let path = "";
    let owner = "";
    let repo = "";
    if (cmd.repositoryPath.startsWith("https://github.com")) {
      if (cmd.repositoryPath.endsWith("/.yaml")) {
        cmd.template = cmd.repositoryPath.split("/").pop();
      }
      //https://github.com/aws-samples/serverless-patterns/tree/main/apigw-rest-stepfunction
      const httpPath = cmd.repositoryPath.replace("https://github.com/", "");
      const split = httpPath.split("/");
      owner = split[0];
      if (split.length > 1) {
        repo = split[1];
      }
      if (split.length > 3) {
        path = split[4];
      }
    } else {
      const split = cmd.repositoryPath.split("/");
      owner = split[0];
      repo = "";
      if (split.length > 1) {
        repo = split[1];
      }
      if (split.length > 2) {
        path = split[2];
      }
    }
    path += "/" + cmd.template;
    template = await githubUtil.getContent(owner, repo, path);
  }
  const configuration = new Configuration({
    apiKey,
  });
  const openai = new OpenAIApi(configuration);
  let easterEggPrompt = "";
  if (cmd["🥚"]) {
    const funWaysOfDescribingSOmethingBoring = [
      "as a romantic poem",
      "as a joke",
      "in the melody of God Save the Queen",
      "in the style of Ivor Cutler",
      "in the style of a 1980s computer game",
      "in the style of an angry teenager",
      "making heavy references to the Easter Bunny",
    ]
    easterEggPrompt =  funWaysOfDescribingSOmethingBoring[Math.floor(Math.random() * funWaysOfDescribingSOmethingBoring.length)];

    console.log("Alright, I'll do this " + easterEggPrompt);

    easterEggPrompt = " Do it " + easterEggPrompt;
  }
  const openAiRequest = {
    model: cmd.model,
    messages: [
      {
        role: "user",
        content: `In three sections, describe what the template does, if there are any security issues and how it can be improved: ${template}.${easterEggPrompt}`,
      }
    ],
    temperature: 0.5,
    max_tokens: 1000
  };
  spinner.start();
  const response = await openai.createChatCompletion(openAiRequest);
  spinner.stop();
  let text = response.data.choices[0].message.content;
  console.log(`\n\n${text}`);


}

module.exports = {
  run,
};
