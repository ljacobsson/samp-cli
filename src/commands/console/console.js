const { CloudFormationClient, DescribeStackResourcesCommand } = require("@aws-sdk/client-cloudformation");
const { fromSSO } = require("@aws-sdk/credential-provider-sso");

const inputUtil = require('../../shared/inputUtil');
const parser = require("../../shared/parser");
const fs = require("fs");
const ini = require('ini');
const link2aws = require('link2aws');
const open = import('open');
let region;
async function run(cmd) {
  const credentials = await fromSSO({ profile: cmd.profile })();
  if (fs.existsSync("samconfig.toml")) {
    const config = ini.parse(fs.readFileSync("samconfig.toml", "utf8"));
    const params = config?.default?.deploy?.parameters;
    if (params.stack_name) {
      console.log("Using stack name from config:", params.stack_name);
      cmd.stackName = params.stack_name;
    }
    if (params.profile) {
      console.log("Using AWS profile from config:", params.profile);
      cmd.profile = params.profile;
    }
    if (params.region) {
      console.log("Using AWS region from config:", params.region);
      cmd.region = params.region;
      region = params.region;
    }
  }
  if (!cmd.stackName) {
    console.error("Missing required option: --stack-name");
    process.exit(1);
  }

  const cloudFormation = new CloudFormationClient(credentials);

  const templateFile = cmd.templateFile;
  if (!fs.existsSync(templateFile)) {
    console.log(`File ${templateFile} does not exist`);
    return;
  }
  const template = parser.parse("yaml", fs.readFileSync(templateFile, "utf8"));

  const resources = Object.keys(template.Resources).sort().filter(key => template.Resources[key].Type?.includes("AWS::"));
  if (resources.length === 0) {
    console.log("No compatible resources found in template");
    return;
  }
  let resource;
  if (resources.length === 1) {
    resource = resources[0];
  }
  else {
    const choices = resources.map((sm, i) => { return { name: `${sm} [${template.Resources[sm].Type}]`, value: sm } });
    resource = await inputUtil.autocomplete("Select a resource", choices);
  }

  const physicalId = await getPhysicalId(cloudFormation, cmd.stackName, resource);
  try {
    const arn = createARN(template.Resources[resource].Type, physicalId);
    (await (open)).default(new link2aws.ARN(arn).consoleLink);
  } catch (e) {
    console.log(`Can't create a console link for resource type ${template.Resources[resource].Type}. Please create an issue: https://github.com/ljacobsson/sam-patterns-cli/issues/new`);
    return;
  }

}

async function getPhysicalId(cloudFormation, stackName, logicalId) {
  const params = {
    StackName: stackName,
    LogicalResourceId: logicalId
  };

  const response = await cloudFormation.send(new DescribeStackResourcesCommand(params));
  if (response.StackResources.length === 0) {
    throw new Error(`No stack resource found for ${logicalId}`);
  }
  return response.StackResources[0].PhysicalResourceId;
}

function createARN(resourceType, resourceName) {
  if (!resourceType.includes("::")) {
    console.log(`Can't create ARN for ${resourceType}`);
    return;
  }
  if (resourceName.startsWith("arn:")) {
    return resourceName;
  }
  let service = resourceType.split("::")[1].toLowerCase();
  const noResourceTypeArns = [
    "s3",
    "sqs",
    "sns",
  ]
  const type = noResourceTypeArns.includes(service) ? "" : resourceType.split("::")[2].toLowerCase();

  if (service === "sqs") {
    resourceName = resourceName.split("/").pop();
  }

  //map sam to cloudformation
  if (service === "serverless") {
    switch (type) {
      case "function":
        service = "lambda";
        break;
      case "api":
        service = "apigateway";
        break;
      case "table":
        service = "dynamodb";
        break;
      case "statemachine":
        service = "states";
        break;
    }
  }

  return `arn:aws:${service}:${region}::${type}:${resourceName}`;
}

module.exports = {
  run
};

