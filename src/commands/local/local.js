const runner = require('./runner');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const inputUtil = require('../../shared/inputUtil');
const settingsUtil = require('../../shared/settingsUtil');
const glob = require('glob');
const { findConstructs } = require('./cdk-construct-finder');

function setEnvVars(cmd) {
  process.env.SAMP_PROFILE = cmd.profile || process.env.AWS_PROFILE;
  process.env.SAMP_REGION = cmd.region || process.env.AWS_REGION;
  process.env.SAMP_STACKNAME = process.env.SAMP_STACKNAME || cmd.stackName || process.env.stackName;
  process.env.SAMP_CDK_STACK_PATH = cmd.construct || process.env.SAMP_CDK_STACK_PATH;
}

async function run(cmd) {
  setEnvVars(cmd);
  if (cmd.mergePackageJsons) {
    await mergePackageJsons();
  }

  if (!validate()) {
    return;
  }

  await warn();

  if (cmd.forceRestore) {
    await runner.stop();
    return;
  }

  if (cmd.debug) {
    await setupDebug();
    console.log("Debug setup complete. You can now hit F5 to start debugging");
    return;
  }

  else if (cmd.functions && cmd.functions !== "ALL") {
    cmd.functions = cmd.functions.split(",").map(f => f.trim());
    process.env.includeFunctions = cmd.functions;
  }

  let initialised = false;
  if (fs.existsSync("cdk.json")) {
    process.env.outDir = ".samp-out";
    process.env.SAMP_TEMPLATE_PATH = ".samp-out/mock-template.yaml";

    // build to get the stack construct as js    
    const tscProcess = exec(`${__dirname}/../../../node_modules/.bin/tsc-watch --module commonjs --outDir ${process.env.outDir} --noEmit false --inlineSourceMap false --sourceMap true`, {});
    tscProcess.stdout.on('data', (data) => {
      print(data);
      if (data.toString().includes("Watching for file changes") && !initialised) {

        const cdkWrapper = exec(`node ${__dirname}/cdk-wrapper.js .samp-out/${cmd.construct.replace(".ts", "")}.js`, {});
        cdkWrapper.stdout.on('data', (data) => {
          print(data);
        });
        cdkWrapper.stderr.on('data', (data) => {
          print(data);
        });
        cdkWrapper.on('exit', (code) => {
          initialised = true;
          const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon --watch .samp-out ${__dirname}/runner.js run`, {});
          childProcess.stdout.on('data', (data) => print(data));
          childProcess.stderr.on('data', (data) => {
            print(data);
          });
        });
      }
    });
    tscProcess.stderr.on('data', (data) => {
      print(data);
    });

  }
  else if (fs.existsSync("tsconfig.json")) {
    process.env.outDir = ".samp-out";
    let fileContent = fs.readFileSync("tsconfig.json", "utf8");
    // remove // comments
    fileContent = fileContent.replace(/\/\/.*/g, '');
    const tscProcess = exec(`${__dirname}/../../../node_modules/.bin/tsc-watch --module commonjs --sourceMap true --outDir ${process.env.outDir} --noEmit false`, {});
    tscProcess.stdout.on('data', (data) => {
      console.log("tsc: ", data.toString().replace(/\n$/, ''));
      if (data.toString().includes("Watching for file changes") && !initialised) {
        initialised = true;
        const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon --watch .samp-out ${__dirname}/runner.js run`, {});
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

async function setupDebug() {
  let args = ["local"];
  let stack  = null;
  if (fs.existsSync(`cdk.json`)) {
    const constructs = findConstructs();
    constructs.push("Enter manually");
    let construct = await inputUtil.autocomplete("Which stack construct do you want to debug?", constructs);
    if (construct === "Enter manually") {
      construct = await inputUtil.text("Enter which stack construct do you want to debug?");
    }
    const cdkTree = JSON.parse(fs.readFileSync("cdk.out/tree.json", "utf8"));
    const stacks = Object.keys(cdkTree.tree.children).filter(c => c !== "Tree");
    stacks.push("Enter manually"); 
    stack = await inputUtil.autocomplete("What's the name of the deployed stack?", stacks);
    if (stack === "Enter manually") {
      stack = await inputUtil.autocomplete("What's the name of the deployed stack?");
    }
    const region = await inputUtil.text("What's the region of the deployed stack?", process.env.AWS_REGION || process.env.DEFAULT_AWS_REGION || "us-east-1");
    const profile = await inputUtil.text("AWS profile", process.env.AWS_PROFILE || "default");
    args.push("-s", stack, "--region", region, "--profile", profile, "--construct", construct);
  }

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
  const suffix = stack ? `-${stack}` : "";
  const existingConfig = launchJson.configurations.find(c => c.name === "Debug Lambda Functions" + suffix);
  if (existingConfig) {
    console.log("Debug config already exists");
  } else {

    launchJson.configurations.push({
      type: "node",
      request: "launch",
      name: "Debug Lambda Functions" + suffix,
      runtimeExecutable: "samp",
      args,
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
    console.log("Warning: This command will make changes to your deployed function configuration in AWS for the duration of your debugging session.\n\nPlease ONLY run this against a development environment.\n\nTo learn more about the changes made, please visit https://github.com/ljacobsson/samp-cli#how-does-it-work\n");
    const answer = await inputUtil.prompt("Warn again next time?");
    if (!answer) {
      settings.sampLocalWarned = true;      
      settingsUtil.saveConfigSource(settings)
    }
  }
}

function validate() {
  if (!fs.existsSync("package.json")) {
    console.log("Warning - no package.json found. This command expects a package.json file to exist in the project root directory. If you use one package.json per function sub-folder, please run 'samp local --merge-package-jsons' to create a package.json file in the project root directory followed by npm install");
    return true;
  }

  const package = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (package.dependencies && Object.keys(package.dependencies).length) {
    if (!fs.existsSync("node_modules")) {
      console.log("No node_modules found. Please run 'npm install' before running this command");
      return false;
    }
  }

  if (!fs.existsSync("samconfig.toml") && !fs.existsSync("cdk.json")) {
    console.log("No samconfig.toml found. Please make sure you have deployed your functions before running this command. You can deploy your functions by running 'sam deploy --guided'");
    return false;
  }

  if (fs.existsSync("cdk.json") && !fs.existsSync("cdk.out")) {
    console.log("No cdk.out found. Please make sure you have deployed your functions before running this command. You can deploy your functions by running 'cdk deploy'");
    return false;
  }

  return true;
}

async function mergePackageJsons() {
  if (fs.existsSync("package.json")) {
    console.log("package.json already exists. Please remove or rename it and run this command again");
    process.exit(1);
  }

  const packageJsonFiles = glob.sync('**/package.json', {
    ignore: ['**/node_modules/**']
  });

  const dependencies = {};

  for (const file of packageJsonFiles) {
    const filePath = path.resolve(file);
    const contents = fs.readFileSync(filePath, 'utf8');
    const packageJson = JSON.parse(contents);
    const packageDependencies = packageJson.dependencies || {};

    Object.assign(dependencies, packageDependencies);
  }

  const mergedPackageJson = {
    dependencies
  };

  const outputPath = path.resolve('package.json');
  fs.writeFileSync(outputPath, JSON.stringify(mergedPackageJson, null, 2));

  console.log(`Merged dependencies written to ${outputPath}`);
}

module.exports = {
  run
};
