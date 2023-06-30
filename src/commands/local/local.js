const runner = require('./runner');
const { exec } = require('child_process');
const fs = require('fs');
const inputUtil = require('../../shared/inputUtil');
const settingsUtil = require('../../shared/settingsUtil');
async function run(cmd) {

  await warn();

  if (cmd.forceRestore) {
    await runner.stop();
    return;
  }

  if (cmd.debug) {
    setupDebug();
    console.log("Debug setup complete. You can now hit F5 to start debugging");
    return;
  }

  else if (cmd.functions && cmd.functions !== "ALL") {
    cmd.functions = cmd.functions.split(",").map(f => f.trim());
    process.env.includeFunctions = cmd.functions;
  }

  let initialised = false;
  if (fs.existsSync("tsconfig.json")) {
    let fileContent = fs.readFileSync("tsconfig.json", "utf8");
    // remove // comments
    fileContent = fileContent.replace(/\/\/.*/g, '');
    const tsconfig = JSON.parse(fileContent);
    process.env.outDir = tsconfig.compilerOptions.outDir || ".samp-out";
    const tscProcess = exec(`${__dirname}/../../../node_modules/.bin/tsc-watch --sourceMap true --outDir ${process.env.outDir} --noEmit false`, {});
    tscProcess.stdout.on('data', (data) => {
      console.log("tsc: ", data.toString().replace(/\n$/, ''));
      if (data.toString().includes("Watching for file changes") && !initialised) {
        initialised = true;
        const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon ${__dirname}/runner.js run`, {});
        childProcess.stdout.on('data', (data) => print(data));
        childProcess.stderr.on('data', (data) => print(data));
      }
    });

  } else {
    const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon ${__dirname}/runner.js run`, {});
    childProcess.stdout.on('data', (data) => print(data));
    childProcess.stderr.on('data', (data) => print(data));
  }

  // catch ctrl+c event and exit normally
  process.on('SIGINT', async () => {
    console.log('Ctrl-C...');
    await runner.stop();
  }
  );

  process.on('SIGTERM', async () => {
    console.log('SIGTERM...');
    await runner.stop();
  }
  );

  process.on('exit', async () => {
    console.log('exit...');
    await runner.stop();
  });
}

function print(data) {
  if (!process.env.muteParentOutput) {
    console.error(data.toString().replace(/\n$/, ''));
  }
}

function setupDebug() {
  const pwd = process.cwd();
  let launchJson;
  if (fs.existsSync(`${pwd}/.vscode/launch.json`)) {
    console.log("launch.json already exists");
    let fileContent = fs.readFileSync(`${pwd}/.vscode/launch.json`, "utf8");
    fileContent = fileContent.replace(/\/\/.*/g, '');
    launchJson = JSON.parse(fileContent);
  } else {
    launchJson = {
      "version": "0.2.0",
      "configurations": []
    };
  }

  const existingConfig = launchJson.configurations.find(c => c.name === "Debug Lambda Functions");
  if (existingConfig) {
    console.log("Debug config already exists");
  } else {

    launchJson.configurations.push({
      type: "node",
      request: "launch",
      name: "Debug Lambda Functions",
      runtimeExecutable: "samp",
      args: ["local"],
      env: {
        muteParentOutput: "true"
      },
      skipFiles: [
        "<node_internals>/**"
      ],
      postDebugTask: "samp-local-cleanup"
    });
  }

  const task = {
    label: "samp-local-cleanup",
    type: "shell",
    command: "samp local --force-restore",
  }
  let tasksJson;
  if (fs.existsSync(`${pwd}/.vscode/tasks.json`)) {
    console.log("tasks.json already exists");
    tasksJson = JSON.parse(fs.readFileSync(`${pwd}/.vscode/tasks.json`, "utf8"));
    const existingTask = tasksJson.tasks.find(t => t.label === "lambda-local-cleanup");
    if (existingTask) {
      console.log("Task already exists");
      return;
    } else {
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

  fs.writeFileSync(`${pwd}/.vscode/launch.json`, JSON.stringify(launchJson, null, 2));
  fs.writeFileSync(`${pwd}/.vscode/tasks.json`, JSON.stringify(tasksJson, null, 2));
}

async function warn() {
  const settings = settingsUtil.getConfigSource();
  if (!settings.sampLocalWarned) {
    console.log("Warning: This command will make changes to your deployed function configuration in AWS for the duration of your debugging session. Please ONLY run this against a development environment. To learn more about the changes made, please visit https://github.com/ljacobsson/samp-cli#how-does-it-work");
    const answer = await inputUtil.prompt("Warn again next time?");
    if (!answer) {
      settings.sampLocalWarned = true;
      console.log(settings);
      settingsUtil.saveConfigSource(settings)
    }
  }
}

module.exports = {
  run
};

