const cdk = require('aws-cdk-lib');
const fs = require('fs');
const { yamlDump } = require('yaml-cfn');
const path = require('path');

const baseDir = `${process.cwd()}/.samp-out`;

for (const file of getAllJsFiles(baseDir)) {
  if (file.endsWith('.js')) {
    let fileContents = fs.readFileSync(file, 'utf8');
    if (fileContents.includes('aws-cdk-lib')) {
      fileContents = fileContents.replace(/\.ts"/g, '.js"').replace(/\.ts'/g, ".js'").replace(/\.ts`/g, ".js`");
      fs.writeFileSync(file, fileContents);
    }
  }
}


const TargetStack = require(`${process.cwd()}/${process.argv[2]}`);
const className = Object.keys(TargetStack)[0];

const templatePath = `${process.cwd()}/cdk.out/${process.env.SAMP_STACKNAME}.template.json`;
const synthedTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const app = new cdk.App();
const stack = new TargetStack[className](null, process.env.SAMP_STACKNAME, {});

const resources = stack.node._children;
const mockTemplate = {
  AWSTemplateFormatVersion: "2010-09-09",
  Transform: ['AWS::Serverless-2016-10-31'], Resources: {}
};
for (const key of Object.keys(resources)) {
  const resource = resources[key];
  const fingerprintOptions = resource.node._children.Code?.node?._children?.Stage?.fingerprintOptions;
  const entry = fingerprintOptions?.bundling?.relativeEntryPath || (fingerprintOptions?.path ? `${fingerprintOptions?.path}/` : null);
  let logicalId = null;
  let handler
  if (entry) {
    for (const fn of Object.keys(synthedTemplate.Resources)) {
      const resource = synthedTemplate.Resources[fn];
      if (resource.Type === "AWS::Lambda::Function") {
        if (resource.Metadata?.['aws:cdk:path'].endsWith(`/${key}/Resource`)) {
          logicalId = fn;
          handler = resource.Properties.Handler;
          break;
        }
      }
    }

    mockTemplate.Resources[logicalId] = {
      Type: "AWS::Serverless::Function",
      Properties: {
        CodeUri: ".",
        Handler: `${entry.substring(0, entry.lastIndexOf("/"))}/${handler}`,
      }
    }
  }
}

fs.writeFileSync(".samp-out/mock-template.yaml", yamlDump(mockTemplate));
fs.writeFileSync(".samp-out/stack-dump.json", JSON.stringify(stack.node._children, getCircularReplacer(), 2));
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular Reference]";
      }
      seen.add(value);
    }
    return value;
  };
}

function getAllJsFiles(directory) {
  let fileArray = [];

  const files = fs.readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const fileStats = fs.statSync(filePath);

    if (fileStats.isDirectory()) {
      const nestedFiles = getAllJsFiles(filePath); // Recursively get files in subdirectory
      fileArray = fileArray.concat(nestedFiles);
    } else {
      if (filePath.endsWith('.js'))
        fileArray.push(filePath);
    }
  }

  return fileArray;
}
