const runner = require('./runner');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const inputUtil = require('../../shared/inputUtil');
const settingsUtil = require('../../shared/settingsUtil');
const glob = require('glob');
const { fromSSO } = require('@aws-sdk/credential-provider-sso');
const { CloudFormationClient, ListStackResourcesCommand } = require('@aws-sdk/client-cloudformation');
const samConfigParser = require('../../shared/samConfigParser');
const runtimeEnvFinder = require('./runtime-env-finder');
let env;
function setEnvVars(cmd) {
  process.env.SAMP_PROFILE = cmd.profile || process.env.AWS_PROFILE || '';
  process.env.SAMP_REGION = cmd.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '';
  process.env.SAMP_STACKNAME = process.env.SAMP_STACKNAME || cmd.stackName || '';
  process.env.SAMP_CDK_STACK_PATH = cmd.construct || process.env.SAMP_CDK_STACK_PATH || '';
}

async function run(cmd) {

  env = runtimeEnvFinder.determineRuntime();
  setEnvVars(cmd);
  if (cmd.mergePackageJsons) {
    await mergePackageJsons();
  }

  if (!validate(env)) {
    return;
  }

  await warn();

  if (cmd.forceRestore) {
    const samConfig = samConfigParser.parse();
    process.env.SAMP_SAMCONFIG = JSON.stringify(samConfig); // pass it as an env var since it could be run in a separate process
    await runner.stop();
    return;
  }

  if (cmd.debug) {
    await setupDebug(cmd);
    if (env.isNodeJS) {
      process.exit(0);
    }
  } else if (env.iac === "cdk" && (!cmd.stackName || !cmd.construct)) {
    {
      console.log("CDK usage: samp local --stack-name <stack-name> --construct <construct-name>");
      process.exit(0);
    }
  } else if (cmd.functions && cmd.functions !== true) {
    cmd.functions = cmd.functions.split(",").map(f => f.trim());
    process.env.includeFunctions = cmd.functions;
  }

  let initialised = false;
  if (env.iac === "cdk" && env.functionLanguage == "ts") {
    initialised = setupCDK_TS(initialised, cmd);
  }
  else if (env.iac === "sam" && env.functionLanguage == "ts") {
    initialised = setupSAM_TS(initialised);
  } else if (env.iac === "sam" && env.functionLanguage == "js") {
    setupSAM_JS();
  } else {
    await require(`./runtime-support/${env.functionLanguage}/iac-support/${env.iac}`).setup(initialised, cmd);
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

function setupSAM_JS() {
  const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon --ignore ./.samp-out/samp-requests/ ${__dirname}/runner.js run`, {});
  childProcess.stdout.on('data', (data) => print(data));
  childProcess.stderr.on('data', (data) => print(data));
}

function setupSAM_TS(initialised) {
  process.env.outDir = ".samp-out";
  let fileContent = fs.readFileSync("tsconfig.json", "utf8");
  // remove // comments
  fileContent = fileContent.replace(/\/\/.*/g, '');
  const tscProcess = exec(`${__dirname}/../../../node_modules/.bin/tsc-watch --module commonjs --sourceMap true --outDir ${process.env.outDir} --noEmit false`, {});
  tscProcess.stdout.on('data', (data) => {
    console.log("tsc: ", data.toString().replace(/\n$/, ''));
    if (data.toString().includes("Watching for file changes") && !initialised) {
      initialised = true;
      const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon --ignore ./.samp-out/samp-requests/ --watch .samp-out ${__dirname}/runner.js run`, {});
      childProcess.stdout.on('data', (data) => print(data));
      childProcess.stderr.on('data', (data) => print(data));
    }
  });
  return initialised;
}

function setupCDK_TS(initialised, cmd) {
  process.env.outDir = ".samp-out";
  process.env.SAMP_TEMPLATE_PATH = ".samp-out/mock-template.yaml";

  // build to get the stack construct as js    
  const tscProcess = exec(`${__dirname}/../../../node_modules/.bin/tsc-watch --module commonjs --outDir ${process.env.outDir} --noEmit false --inlineSourceMap false --sourceMap true`, {});
  tscProcess.stdout.on('data', (data) => {
    print(data);
    if (data.toString().includes("Watching for file changes") && !initialised) {

      const cdkWrapper = exec(`node ${__dirname}/runtime-support/${env.runtime}/cdk/cdk-wrapper.js .samp-out/${cmd.construct.replace(".ts", "")}.js`, {});
      cdkWrapper.stdout.on('data', (data) => {
        print(data);
      });
      cdkWrapper.stderr.on('data', (data) => {
        print(data);
      });
      cdkWrapper.on('exit', (code) => {
        initialised = true;
        const childProcess = exec(`${__dirname}/../../../node_modules/.bin/nodemon --ignore ./.samp-out/samp-requests/ --watch .samp-out ${__dirname}/runner.js run`, {});
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
  return initialised;
}

function print(data) {
  if (!process.env.muteParentOutput) {
    console.error(data.toString().replace(/\n$/, ''));
  }
}

async function setupDebug(cmd) {
  const env = runtimeEnvFinder.determineRuntime();
  let credentials;
  let targetConfig = samConfigParser.parse();
  let args = ["local"];
  let stack = cmd.stackName || targetConfig.stack_name;
  let region = cmd.region || targetConfig.region;
  let profile = cmd.profile || targetConfig.profile;
  let selectedFunctionsCsv = cmd.functions || targetConfig.selected_functions;
  let construct;
  if (env.iac === "cdk") {
    const constructs = require(`./runtime-support/${env.runtime}/cdk/cdk-construct-finder`).findConstructs();
    constructs.push("Enter manually");
    construct = await inputUtil.autocomplete("Which stack construct do you want to debug?", constructs);
    if (construct === "Enter manually") {
      construct = await inputUtil.text("Enter which stack construct do you want to debug");
    }
    cmd.construct = construct;
    const cdkTree = JSON.parse(fs.readFileSync("cdk.out/tree.json", "utf8"));
    const stacks = Object.keys(cdkTree.tree.children).filter(c => c !== "Tree");
    stacks.push("Enter manually");
    stack = await inputUtil.autocomplete("What's the name of the deployed stack?", stacks);
    if (stack === "Enter manually") {
      stack = await inputUtil.text("What's the name of the deployed stack?");
    }
    cmd.stackName = stack;
    process.env.SAMP_STACKNAME = stack;
    const regions = [
      "ap-south-1",
      "eu-north-1",
      "eu-west-3",
      "eu-west-2",
      "eu-west-1",
      "ap-northeast-3",
      "ap-northeast-2",
      "ap-northeast-1",
      "ca-central-1",
      "sa-east-1",
      "ap-southeast-1",
      "ap-southeast-2",
      "eu-central-1",
      "us-east-1",
      "us-east-2",
      "us-west-1",
      "us-west-2"
    ];
    region = region || await inputUtil.autocomplete("What's the region of the deployed stack?", regions);
    profile = profile || await inputUtil.text("AWS profile", process.env.AWS_PROFILE || "default");
    args.push("-s", stack, "--region", region, "--profile", profile, "--construct", construct);
  }

  try {
    credentials = await fromSSO({ profile: profile || 'default' })();
  } catch (e) {
  }

  const functions = [];
  let selectedFunctions = selectedFunctionsCsv;
  let name = "[SAMP] Debug Lambda functions"
  let functionNames;
  const cloudFormation = new CloudFormationClient({ credentials, region });

  if (cmd.functions === true || env.isNodeJS) {
    let token;
    do {
      try {
        const response = await cloudFormation.send(new ListStackResourcesCommand({ StackName: stack, NextToken: token }));
        functions.push(...response.StackResourceSummaries.filter(r => r.ResourceType === "AWS::Lambda::Function"));
        token = response.NextToken;
      } catch (e) {
        console.log(`Failed to list stack resources for stack '${stack}' in '${region}' using profile '${profile}'.`, e.message);
        process.exit(1);
      }
    } while (token);
    functionNames = functions.map(f => f.LogicalResourceId);
    selectedFunctions = await inputUtil.checkbox("Select functions to debug", functionNames);
    process.env.includeFunctions = selectedFunctions;

  }
  if (env.isNodeJS) {
    const selectedFunctionsText = selectedFunctions.length === functionNames.length ? "all functions" : selectedFunctions.join(",");
    name = await inputUtil.text("Enter a name for the configuration", "Debug " + selectedFunctionsText);
    selectedFunctionsCsv = selectedFunctions.join(",")
    args.push("--functions", selectedFunctionsCsv, "--profile", profile);
  }

  const runtime = env.isNodeJS ? "nodejs" : env.functionLanguage;
  if (!cmd.ide) {
    const isVsCode = process.env.TERM_PROGRAM === "vscode";
    const isJetBrains = process.env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
    if (isVsCode) cmd.ide = "vscode";
    if (isJetBrains) cmd.ide = "jetbrains";
  }

  let ide = cmd.ide || await inputUtil.autocomplete("Which IDE do you use?", [{ name: "VsCode", value: "vscode" }, { name: "Rider", value: "jetbrains" }, { name: "VisualStudio", value: "visualstudio" }, "Other"]);
  ide = ide.toLowerCase();
  if (ide === "other") {
    console.log("Can't create debug config for other IDEs yet. Please create the launch config manually.");
    return;
  }
  try {
    await require(`./runtime-support/${runtime}/ide-support/${ide}/setup.js`).copyConfig(name, args, { region, profile, stack, selectedFunctionsCsv, construct });
  } catch (e) {
    console.log(`Failed to setup debug config for ${ide} for runtime ${runtime}.`, e.message);
    process.exit(1);
  }
  if (env.isNodeJS) {
    console.log("Debug setup complete. You can now select the debug configuration from the dropdown and hit F5 to start debugging");
  } else {
    console.log("Debug setup complete. You can now run `samp local`, select the debug configuration from the dropdown and hit F5 to start debugging");
  }
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

function validate(env) {
  if (env.isNodeJS) {
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
}

module.exports = {
  run
};

