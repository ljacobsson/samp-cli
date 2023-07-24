import { IoTClient, DetachPolicyCommand, UpdateCertificateCommand, DeleteCertificateCommand, CreateKeysAndCertificateCommand, DescribeEndpointCommand, CreatePolicyCommand, AttachPolicyCommand, GetPolicyCommand } from "@aws-sdk/client-iot";
import { LambdaClient, UpdateFunctionCodeCommand, GetFunctionCommand, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import fs from 'fs';
import path from 'path';
import mqtt from 'mqtt';
import { routeEvent } from "./event-router.js";
import os, { homedir } from 'os';
import { yamlParse } from 'yaml-cfn'
import { CloudFormationClient, ListStackResourcesCommand, GetTemplateCommand } from '@aws-sdk/client-cloudformation';
import ini from 'ini';
import getMac from 'getmac';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mac = getMac();
let envConfig = {};
let config = {};
let configEnv = 'default';
if (fs.existsSync(`samconfig.toml`)) {
  config = ini.parse(fs.readFileSync(`samconfig.toml`, 'utf-8'));
  configEnv = process.env.configEnv || 'default';
  envConfig = config[configEnv].deploy.parameters;
  envConfig.stack_name = envConfig.stack_name || config[configEnv].global.parameters.stack_name
} else {
  envConfig = {
    stack_name: process.env.SAMP_STACKNAME,
    region: process.env.SAMP_REGION,
    profile: process.env.SAMP_PROFILE
  }
}
console.log(`Using profile: ${envConfig.profile || 'default'}`);

let credentials;
try {
  credentials = await fromSSO({ profile: envConfig.profile || 'default' })();
} catch (e) {
}

const stsClient = new STSClient({ region: envConfig.region, credentials });
const accountId = (await stsClient.send(new GetCallerIdentityCommand({}))).Account;
const iotClient = new IoTClient({ region: envConfig.region, credentials });
const timer = new Date().getTime();
let certData, endpoint, stack, functions, template;
const policyName = "lambda-debug-policy";

const packageVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..','..', 'package.json'))).version;

const zipFilePath = path.join(os.homedir(), '.lambda-debug', `relay-${accountId}-${packageVersion}.zip`);

if (!fs.existsSync(".lambda-debug")) {
  const createKeysAndCertificate = async () => {

    const homeDir = os.homedir();
    const certPath = path.join(homeDir, '.lambda-debug', `certificate-${accountId}.json`);
    let response;
    if (fs.existsSync(certPath)) {
      response = JSON.parse(fs.readFileSync(certPath));
    } else {
      const createKeysAndCertificateCommand = new CreateKeysAndCertificateCommand({
        setAsActive: true,
      });
      response = await iotClient.send(createKeysAndCertificateCommand);
      fs.mkdirSync(path.join(homeDir, '.lambda-debug'), { recursive: true });
      fs.writeFileSync(certPath, JSON.stringify(response));
    }

    return response;
  };
  certData = await createKeysAndCertificate();

  const getIotEndpoint = async () => {
    const cachePath = path.join(os.homedir(), ".lambda-debug", `endpoint-${accountId}.txt`);
    if (fs.existsSync(cachePath)) {
      return fs.readFileSync(cachePath).toString(); q
    }
    const describeEndpointCommand = new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' });
    const response = await iotClient.send(describeEndpointCommand);
    fs.writeFileSync(cachePath, response.endpointAddress);
    return response.endpointAddress;
  };
  const privateKey = certData.keyPair.PrivateKey;

  // write certificates to relay folder
  const relayDir = path.join(__dirname, 'relay');
  fs.writeFileSync(path.join(relayDir, 'cert.pem'), certData.certificatePem);
  fs.writeFileSync(path.join(relayDir, 'key.pem'), privateKey);

  const policyDocument = {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "iot:*",
        "Resource": "*"
      }
    ]
  };

  const createPolicy = async () => {
    try {
      const getPolicyCommand = new GetPolicyCommand({
        policyName: policyName
      });
      await iotClient.send(getPolicyCommand);
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        const createPolicyCommand = new CreatePolicyCommand({
          policyName: policyName,
          policyDocument: JSON.stringify(policyDocument)
        });
        const response = await iotClient.send(createPolicyCommand);
        return response;
      } else {
        throw error;
      }
    }
  };
  const attachPolicy = async () => {
    const attachPolicyCommand = new AttachPolicyCommand({
      policyName: policyName,
      target: certData.certificateArn
    });

    await iotClient.send(attachPolicyCommand);
  };
  await createPolicy();
  await attachPolicy()

  // Load the endpoint from AWS IoT console
  endpoint = await getIotEndpoint();
  // Load your AWS IoT certificates
  certData.ca = fs.readFileSync(path.join(__dirname, 'AmazonRootCA1.pem')).toString(); // Download this from Amazon's website   
  const cfnClient = new CloudFormationClient({
    region: envConfig.region,
    credentials: credentials
  });

  console.log(`Loading necessary resources...`);

  const stackName = envConfig.stack_name;

  template = yamlParse(fs.readFileSync(findSAMTemplateFile('.')).toString());

  stack = await cfnClient.send(new ListStackResourcesCommand({ StackName: stackName }));

  functions = Object.keys(template.Resources).filter(key => template.Resources[key].Type === 'AWS::Serverless::Function');
  if (process.env.includeFunctions) {
    const includeFunctions = process.env.includeFunctions.split(',').map(f => f.trim());
    functions = functions.filter(f => includeFunctions.includes(f));
  } else if (process.env.excludedFunctions) {
    const excludeFunctions = process.env.excludeFunctions.split(',').map(f => f.trim());
    functions = functions.filter(f => !excludeFunctions.includes(f));
  }
  fs.writeFileSync(".lambda-debug", JSON.stringify({ functions, template, configEnv, envConfig, accountId }));

  // replace function code with stub-local.js
  const lambdaClient = new LambdaClient({
    region: envConfig.region,
    credentials
  });
  if (!fs.existsSync(zipFilePath)) {
    console.log(`Creating Lambda artifact zip`);
    fs.writeFileSync(path.join(__dirname, 'relay', 'config.json'), JSON.stringify({ mac: mac, endpoint: endpoint }));
    // install npm package sin relay folder
    const npm = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
    console.log(`Installing npm packages in relay lambda function folder`);
    const npmInstall = spawnSync(npm, ['install'], { cwd: path.join(__dirname, 'relay') });
    if (npmInstall.error) {
      console.log(`Error installing npm packages in relay folder: ${npmInstall.error}`);
      process.exit(1);
    }
    
    //create zip file of relay folder
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });
    archive.pipe(output);
    archive.directory(path.join(__dirname, 'relay'), false);
    await archive.finalize();
    console.log(`Zip created`)
  }
  const tasks = functions.map(async (func) => {
    await updateFunctions(func, lambdaClient);
  });

  await Promise.all(tasks);
  // Connect to the AWS IoT broker
} else {
  const config = JSON.parse(fs.readFileSync(".lambda-debug", 'utf-8'));
  stack = config.stack;
  endpoint = config.endpoint;
  certData = config.certData;
  functions = config.functions;
  template = config.template;
}
const functionSources = functions.map(key => { return { uri: template.Resources[key].Properties.CodeUri || template.Globals?.Function?.CodeUri, handler: template.Resources[key].Properties.Handler, name: key } }).reduce((map, obj) => {
  obj.uri = obj.uri || "";
  if (!obj.uri.endsWith("/")) {
    obj.uri = obj.uri + "/";
  }
  let baseDir = obj.uri;
  if (process.env.outDir) {
    if (!fs.existsSync(process.env.outDir)) {
      console.log(`outDir ${process.env.outDir} does not exist. Have you compiled?`);
      process.exit(1);
    }
    if (!process.env.outDir.endsWith("/")) {
      baseDir = process.env.outDir + "/" + obj.uri;
    }
  }
  const globals = template.Globals?.Function || {};
  const handlerFolders = (obj.handler || globals.Handler).split('/');
  const functionHandler = handlerFolders.pop();
  // remove folders if they don't exist on dsk
  handlerFolders.forEach((folder, index) => {
    if (!fs.existsSync(`${process.cwd()}/${baseDir}${handlerFolders.slice(0, index + 1).join('/')}`)) {
      handlerFolders.splice(index, 1);
    }
  });
  obj.handler = handlerFolders.join('/');
  const handler = (obj.handler + '/' + functionHandler.split('.')[0]).replace(/\/\//g, '/');
  const handlerMethod = functionHandler.split('.')[1];
  let jsExt = ".js";
  for (const ext of [".js", ".mjs", ".jsx"]) {
    if (fs.existsSync(`${process.cwd()}/${baseDir}${handler}${ext}`)) {
      jsExt = ext;
      break;
    }
  }
  const module = `file://${`${process.cwd()}/${baseDir}${handler}${jsExt}`.replace(/\/\//g, '/')}`.replace('.samp-out/./', '.samp-out/');
  map[obj.name] = {
    module,
    handler: handlerMethod
  };

  return map;
}, {});

for (const source of Object.values(functionSources)) {
  if (!fs.existsSync(fileURLToPath(source.module))) {
    console.log(`Function source ${source.module} does not exist. Have you compiled?`);
    process.exit(1);
  }
}

const connectOptions = {
  connectTimeout: 4000,
  ca: certData.ca,
  key: certData.keyPair.PrivateKey,
  cert: certData.certificatePem,
  keepalive: 60,
  client_id: 'mqtt-client-' + Math.floor((Math.random() * 1000000) + 1),
  protocol: 'mqtt',
  reconnectPeriod: 1000,
  clean: true,
  host: endpoint,
  debug: true,
  reconnectPeriod: 0,
};
const client = mqtt.connect(connectOptions);

client.on('error', function (err) {
  console.log('Connection Error: ' + err);
});

client.on('connect', async function () {
  console.log('Ready for requests...')
  fs.writeFileSync(".lambda-debug", JSON.stringify({ stack, endpoint, certData, functions, template, configEnv, envConfig, accountId }));
  client.subscribe('lambda-debug/event/' + mac);
});

client.on('message', async function (topic, message) {
  const obj = JSON.parse(message.toString());
  process.env = {...obj.envVars, LOCAL_DEBUG: true};
  const result = await routeEvent(obj.event, obj.context, stack, functionSources);
  client.publish(`lambda-debug/callback/${mac}/${obj.sessionId}`, JSON.stringify(result || {}));
});

client.on('close', function () {
  // delete certificates
  console.log('Disconnected from live debug session');
});

if (!envConfig.childProcess) {
  process.on('SIGINT', async function () {
    console.log("Caught interrupt signal");
    process.exit();
  });
}
process.on("exit", async (x) => {
  // delete certificates
  client.publish('lambda-debug/callback/' + mac, JSON.stringify({ event: 'lambda-debug-exit', context: {} }));
  client.end();
  await iotClient.send(new DetachPolicyCommand({
    policyName: policyName,
    target: certData.certificateArn
  }));
  await iotClient.send(new UpdateCertificateCommand({
    certificateId: certData.certificateId,
    newStatus: 'INACTIVE'
  }));
  await iotClient.send(new DeleteCertificateCommand({
    certificateId: certData.certificateId
  }));
  fs.unlinkSync(".lambda-debug");
}
);

async function updateFunctions(func, lambdaClient) {
  let updated = false;
  do {
    try {
      const functionName = stack.StackResourceSummaries.find(x => x.LogicalResourceId === func).PhysicalResourceId;
      console.log(`Updating function configuration: ${func}...`);

      // get function code
      const getFunctionCommand = new GetFunctionCommand({
        FunctionName: functionName,
      });

      const updateFunctionConfigurationCommand = new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        Timeout: parseInt(process.env.SAMP_TIMEOUT || 60),
        MemorySize: 256,
        Handler: 'relay.handler',
      });
      await lambdaClient.send(updateFunctionConfigurationCommand);

      // sleep 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updateFunctionCodeCommand = new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: fs.readFileSync(zipFilePath)
      });

      await lambdaClient.send(updateFunctionCodeCommand);
      console.log('Updated function configuration:', func);

    } catch (error) {
      if (error.name === "TooManyRequestsException") {
        console.log("Too many requests, sleeping for 1 second...");
      } else if (error.name === "ResourceConflictException") {
        console.log("Lambda is currently updating, sleeping for 1 second...");
      } else {
        console.log("Error updating function. Please make sure that your have deployed your stack and that your function exists in AWS");
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    updated = true;
  } while (!updated);
}

function debugInProgress() {
  return fs.existsSync(".lambda-debug");
}

function findSAMTemplateFile(directory) {
  if (fs.existsSync("./cdk.json")) {
    return ".samp-out/mock-template.yaml";
  }
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);

    // Check if the file extension is .json, .yml, or .yaml
    if (file.match(/\.(json|ya?ml)$/i)) {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check if the content of the file contains the specified string
      if (content.includes('AWS::Serverless-2016-10-31')) {
        console.log('SAM template file found:', file);
        return filePath;
      }
    }
  }

  console.log('Template file not found. Will not be able to route events locally.');
  return null;
}