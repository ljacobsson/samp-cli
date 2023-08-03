const toml = require('toml');
const fs = require('fs');
const yaml = require('yaml');
function parse() {
  if (!fs.existsSync(`samconfig.toml`)) {
    return {};
  }
  const configEnv = 'default';
  let config;
  try {
    config = toml.parse(fs.readFileSync(`samconfig.toml`, 'utf-8'));
  } catch (e) {
    config = yaml.parse(fs.readFileSync(`samconfig.yaml`, 'utf-8'));    
  }
  const envConfig = config[configEnv].deploy.parameters;
  envConfig.configEnv = process.env.configEnv || 'default';
  envConfig.stack_name = envConfig.stack_name || config[configEnv].global.parameters.stack_name
  envConfig.region = envConfig.region || config[configEnv].global.parameters.region || process.env.AWS_REGION;
  envConfig.profile = envConfig.profile || config[configEnv].global?.parameters.profile || process.env.AWS_PROFILE || 'default';
  return envConfig;
}

module.exports = {
  parse
}