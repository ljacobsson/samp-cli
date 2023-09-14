const fs = require("fs");
const commentJson = require('comment-json')
const runtimeEnvFinder = require('../../../../runtime-env-finder');


const pwd = process.cwd();
function copyConfig(name, args) {
  let env = runtimeEnvFinder.determineRuntime();
  let launchJson;
  if (fs.existsSync(`${pwd}/.vscode/launch.json`)) {
    let fileContent = fs.readFileSync(`${pwd}/.vscode/launch.json`, "utf8");
    launchJson = commentJson.parse(fileContent);
  } else {
    launchJson = {
      "version": "0.2.0",
      "configurations": []
    };
  }
  const launchConfig = require(`${__dirname}/launch.json`);
  const taskConfig = require(`${__dirname}/tasks.json`);

  launchConfig.configurations[0].name = name;
  launchConfig.configurations[0].args = args;  
  if (env.functionLanguage === "ts") {
    launchConfig.configurations[0].outFiles = [
      "${workspaceFolder}/.samp-out/**/*.js"
    ]
  }

  if (!launchJson.configurations.find(c => c.name === name)) {
  launchJson.configurations.push(launchConfig.configurations[0]);
  } else {
    launchJson.configurations = launchJson.configurations.map(c => {
      if (c.name === name) {
        return launchConfig.configurations[0];
      }
      return c;
    });
  }

  const task = taskConfig.tasks[0];
  if (process.env.SAMP_TEMPLATE_PATH) {
    task.command += ` --template ${process.env.SAMP_TEMPLATE_PATH}`;
  }
  let tasksJson;
  if (fs.existsSync(`${pwd}/.vscode/tasks.json`)) {
    tasksJson = commentJson.parse(fs.readFileSync(`${pwd}/.vscode/tasks.json`, "utf8"));
    const existingTask = tasksJson.tasks.find(t => t.label === "samp-local-cleanup");
    if (!existingTask) {
      tasksJson.tasks.push(task);
    }
  } else {
    tasksJson = {
      "version": "2.0.0",
      "tasks": [task]
    };
  }
  if (!fs.existsSync(`${pwd}/.vscode`)) {
    fs.mkdirSync(`${pwd}/.vscode`);
  }
  fs.writeFileSync(`${pwd}/.vscode/launch.json`, commentJson.stringify(launchJson, null, 2));
  fs.writeFileSync(`${pwd}/.vscode/tasks.json`, commentJson.stringify(tasksJson, null, 2));
}

module.exports = {
  copyConfig
};
