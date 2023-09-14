const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yamlDump = require('js-yaml').dump;
function calculateHash(filePath) {
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

function findMatchingSource(assetHash, sourceDirectories) {
  for (const sourceDir of sourceDirectories) {
    const sourceFiles = fs.readdirSync(sourceDir);
    for (const sourceFile of sourceFiles) {
      if (fs.statSync(path.join(sourceDir, sourceFile)).isDirectory()) {
        const matchingSourceDir = findMatchingSource(assetHash, [path.join(sourceDir, sourceFile)]);
        if (matchingSourceDir !== null) {
          return matchingSourceDir;
        }
      } else {
        const sourceFilePath = path.join(sourceDir, sourceFile);
        const sourceHash = calculateHash(sourceFilePath);
        if (sourceHash === assetHash) {
          return sourceDir;
        }
      }
    }
  }
  return null;
}

function createAssetSourceMap(assetDirectories, sourceDirectories) {
  
  const assetSourceMap = {};

  for (const assetDir of assetDirectories) {
    const assetFiles = fs.readdirSync(assetDir);
    for (const assetFile of assetFiles) {
      const assetFilePath = path.join(assetDir, assetFile);
      const assetHash = calculateHash(assetFilePath);
      const matchingSource = findMatchingSource(assetHash, sourceDirectories);
      if (matchingSource) {
        const assetHashKey = path.basename(assetDir);
        assetSourceMap[assetHashKey] = matchingSource;
      }
    }
  }

  return assetSourceMap;
}



const assetDirectories = fs.readdirSync('cdk.out')
  .map(folder => path.join('cdk.out', folder))
  .filter(folderPath => fs.statSync(folderPath).isDirectory());

const sourceDirectories = fs.readdirSync('.')
  .map(handler => path.join('.', handler))
  .filter(handlerPath => fs.statSync(handlerPath).isDirectory() && !handlerPath.startsWith('.') && !handlerPath.startsWith('__') && !handlerPath.startsWith('cdk.out'));
const assetSourceMap = createAssetSourceMap(assetDirectories, sourceDirectories);

const template = JSON.parse(fs.readFileSync('cdk.out/' + process.argv[2] + '.template.json', 'utf-8'));
// Get all AWS::Lambda::Function resources
const functions = Object.keys(template.Resources)
  .filter(key => template.Resources[key].Type === "AWS::Lambda::Function")
const mockTemplate = {
  Resources: {}
};

for (const asset of Object.keys(assetSourceMap)) {
  for (const fn of functions) {
    const resource = template.Resources[fn];
    if (resource.Metadata['aws:asset:path'] === asset) {
      const handlerSplit = resource.Properties.Handler.split('/');
      mockTemplate.Resources[fn] = {
        Type: "AWS::Serverless::Function",
        Properties: { CodeUri: '.', Handler: `${assetSourceMap[asset]}/${handlerSplit[handlerSplit.length - 1]}`, Runtime: 'python' }
      };
      break;
    }
  }
}

fs.writeFileSync(".samp-out/mock-template.yaml", yamlDump(mockTemplate));
