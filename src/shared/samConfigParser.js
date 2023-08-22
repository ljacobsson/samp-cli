const toml = require('toml');
const fs = require('fs');
const yaml = require('yaml');

function parse(samconfigFile) {

  const foundSamconfigFile = findSamconfigFile(samconfigFile);
  if (foundSamconfigFile === null){
    return {};
  }

  const configEnv = 'default';
  let config;
  try {
    config = toml.parse(fs.readFileSync(foundSamconfigFile, 'utf-8'));
  } catch (e) {
    config = yaml.parse(fs.readFileSync(foundSamconfigFile, 'utf-8'));    
  }
  const envConfig = config[configEnv].deploy.parameters;
  envConfig.configEnv = process.env.configEnv || 'default';
  envConfig.stack_name = envConfig.stack_name || config[configEnv].global.parameters.stack_name
  envConfig.region = envConfig.region || config[configEnv].global.parameters.region || process.env.AWS_REGION;
  envConfig.profile = envConfig.profile || config[configEnv].global?.parameters.profile || process.env.AWS_PROFILE || 'default';
  return envConfig;
}

function findSamconfigFile(samconfigFile) {
  const defaultSamconfigFiles = ['samconfig.toml', 'samconfig.yaml', 'samconfig.yml'];

  if (samconfigFile && !defaultSamconfigFiles.includes(samconfigFile)){
    if(fs.existsSync(samconfigFile)){
      return samconfigFile;
    }
    return null;
  } else {
    for (const file of defaultSamconfigFiles) {
      if (fs.existsSync(file)){
        return file;
      }
    }
    return null;
  }
}

module.exports = {
  parse,
  findSamconfigFile
}