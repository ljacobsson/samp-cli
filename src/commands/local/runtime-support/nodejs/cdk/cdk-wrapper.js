const fs = require('fs');
const { yamlDump } = require('yaml-cfn');
const cdkDir = `${process.cwd()}/cdk.out`;
const inputUtil = require('../../../../../shared/inputUtil');

const templatePath = `${cdkDir}/${process.env.SAMP_STACKNAME}.template.json`;
const synthedTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

const mockTemplate = {
  AWSTemplateFormatVersion: "2010-09-09",
  Transform: ['AWS::Serverless-2016-10-31'], Resources: {}
};
for (const fn of Object.keys(synthedTemplate.Resources)) {
  const resource = synthedTemplate.Resources[fn];
  if (resource.Type === "AWS::Lambda::Function") {
    if (!resource.Properties?.Code?.S3Bucket) continue;
    if (!resource.Properties?.Runtime.startsWith("node")) continue;
    if (resource.Metadata?.["aws:asset:is-bundled"] === false) continue;
    if (resource.Metadata?.['aws:cdk:path'].includes('/Resource')) {
      const asset = `${resource.Metadata?.['aws:asset:path']}/index.js`;
      const assetFile = fs.readFileSync(`${cdkDir}/${asset}`, 'utf8');
      const fileNames = assetFile.match(/\n\/\/.+?\.ts\n/g);
      let fileName = null;
      if (fileNames && fileNames.length === 1) {
        fileName = fileNames[0].replace('// ', '').replace('.ts', '').replace(/\n/g, '');
      } else {
        const handler = await inputUtil.file("Select handler file", "*.ts");
      }

      logicalId = fn;
      const handler = `${fileName}.${resource.Properties.Handler.split(".")[1]}`;
      if (logicalId === null) continue;

      mockTemplate.Resources[logicalId] = {
        Type: "AWS::Serverless::Function",
        Properties: {
          CodeUri: ".",
          Handler: handler
        }
      }
    }
  }
}

fs.writeFileSync(".samp-out/mock-template.yaml", yamlDump(mockTemplate));
