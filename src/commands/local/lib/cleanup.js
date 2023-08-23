import fs from 'fs';
import { GetTemplateCommand, CloudFormationClient, ListStackResourcesCommand } from "@aws-sdk/client-cloudformation"
import { LambdaClient, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda"
import ini from 'ini';
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { type } from 'os';

console.log("Cleaning up...", process.env.SAMP_PROFILE);
let configEnv = 'default';
const cachePath = process.cwd() + "/.lambda-debug";
let conf;
if (fs.existsSync(cachePath)) {
  conf = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  configEnv = conf.configEnv || 'default';
  fs.unlinkSync(cachePath);
} else {
  conf = {};
  conf.envConfig = JSON.parse(process.env.SAMP_SAMCONFIG);
}

if (fs.existsSync(process.cwd() + "/.samp-out")) {
  console.log("Removing .samp-out directory");
  fs.rmSync(process.cwd() + "/.samp-out", { recursive: true, force: true });
}

const stackName = conf.envConfig.stack_name;
const region = conf.envConfig.region;
const profile = conf.envConfig.profile;
let credentials;
try {
  credentials = await fromSSO({ profile, region })();
} catch (e) {
}

const cfnClient = new CloudFormationClient({ region, credentials });
const lambdaClient = new LambdaClient({ region, credentials });
const templateResponse = await cfnClient.send(new GetTemplateCommand({ StackName: stackName, TemplateStage: "Processed" }));

const stackResources = [];
let token;
do {
  const response = await cfnClient.send(new ListStackResourcesCommand({ StackName: stackName, NextToken: token }));
  stackResources.push(...response.StackResourceSummaries);
  token = response.NextToken;
} while (token);

const template = JSON.parse(templateResponse.TemplateBody);

const functions = Object.keys(template.Resources).filter(key => template.Resources[key].Type === "AWS::Lambda::Function");;
console.log("Restoring functions...");
let resourceConflictCount = 0;
const updatePromises = functions.map(async functionName => {
  let updated = false;
  do {
    try {
      const func = template.Resources[functionName];
      const physicalId = stackResources.find(resource => resource.LogicalResourceId === functionName).PhysicalResourceId;

      await lambdaClient.send(new UpdateFunctionConfigurationCommand({
        FunctionName: physicalId,
        Timeout: func.Properties.Timeout,
        MemorySize: func.Properties.MemorySize,
        Handler: func.Properties.Handler,
        Runtime: func.Properties.Runtime,
      }));

      // Sleep 1 second to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 1000));
      let bucket = func.Properties.Code.S3Bucket;
      if (typeof bucket !== "string") {
        bucket = bucket["Fn::Sub"];
        bucket = bucket.replace("${AWS::AccountId}", conf.accountId);
        bucket = bucket.replace("${AWS::Region}", conf.envConfig.region);
      }
      if (func.Properties?.Code?.S3Key) {
        const params = {
          FunctionName: physicalId,
          Publish: true,
          S3Bucket: bucket,
          S3Key: func.Properties.Code.S3Key,
        };

        await lambdaClient.send(new UpdateFunctionCodeCommand(params));
      }
      updated = true;

    } catch (error) {
      if (error.name === "TooManyRequestsException") {
        console.log("Too many requests, sleeping for 1 second");
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (error.name === "ResourceConflictException") {
        resourceConflictCount++;
        if (resourceConflictCount < 10) {
          console.log("Resource conflict, retrying...");
        } else {
          console.log("Resource conflict, retrying... Hang in there - this may take a while");
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  } while (!updated);

});

// Wait for all promises to resolve
await Promise.all(updatePromises);
console.log("Finished restoring functions");


