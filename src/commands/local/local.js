const runner = require('./runner');
const { exec } = require('child_process');
const fs = require('fs');
const { initial } = require('lodash');
async function run(cmd) {
  if (cmd.forceRestore) {
    await runner.stop();
    return;
  }

  if (cmd.debug) {
    setupDebug();
    console.log("Debug setup complete. You can now hit F5 to start debugging");
    return;
  }

  let initialised = false;
  if (fs.existsSync("tsconfig.json")) {
    const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
    if (tsconfig?.compilerOptions?.outDir) {
      console.log("Using outDir from tsconfig.json:", tsconfig.compilerOptions.outDir);
      process.env.outDir = tsconfig.compilerOptions.outDir;
    } else {
      console.error("Missing outDir in tsconfig.json");
      process.exit(1);
    }

    const tscProcess = exec(`${__dirname}/../../../node_modules/.bin/tsc-watch`, {});
    tscProcess.stdout.on('data', (data) => {
      console.log("tsc: ", data.toString().replace(/\n$/, ''));
      if (data.toString().includes("Watching for file changes") && !initialised) {
        initialised = true;
        const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon ${__dirname}/runner.js run`, {});
        childProcess.stdout.on('data', (data) => {
          if (!process.env.muteParentOutput) {
            console.log(data.toString().replace(/\n$/, ''));
          }
        });
      }
    });

  } else {
    const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon ${__dirname}/runner.js run`, {});
    childProcess.stdout.on('data', (data) => {
      if (!process.env.muteParentOutput) {
        console.log(data.toString().replace(/\n$/, ''));
      }
    });
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

function setupDebug() {
  const pwd = process.cwd();
  let launchJson;
  if (fs.existsSync(`${pwd}/.vscode/launch.json`)) {
    console.log("launch.json already exists");
    launchJson = JSON.parse(fs.readFileSync(`${pwd}/.vscode/launch.json`, "utf8"));
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
      "tasks": [ task ]
    };
  }
  if (!fs.existsSync(`${pwd}/.vscode`)) {
    fs.mkdirSync(`${pwd}/.vscode`);
  }

  fs.writeFileSync(`${pwd}/.vscode/launch.json`, JSON.stringify(launchJson, null, 2));
  fs.writeFileSync(`${pwd}/.vscode/tasks.json`, JSON.stringify(tasksJson, null, 2));
}

module.exports = {
  run
};

