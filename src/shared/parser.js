const fs = require("fs");
const path = require("path");
const yamlCfn = require("yaml-cfn");
let format = {
  yaml: "yaml",
};
function parse(identifier, str) {
  try {
    const parsed = JSON.parse(str);
    format[identifier] = "json";
    return parsed;
  } catch {
    const parsed = yamlCfn.yamlParse(str);
    format[identifier] = "yaml";
    return parsed;
  }
}
function stringify(identifier, obj) {
  if (format[identifier] === "json") return JSON.stringify(obj, null, 2);
  if (format[identifier] === "yaml")
    return yamlCfn.yamlDump(obj).replace(/!<(.+?)>/g, "$1");
}

function findSAMTemplateFile(directory) {
  if (process.env.SAMP_TEMPLATE_PATH && process.env.SAMP_TEMPLATE_PATH !== 'undefined') {
    return process.env.SAMP_TEMPLATE_PATH;
  }
  if (fs.existsSync("./cdk.json")) {
    return ".samp-out/mock-template.yaml";
  }
  const files = fs.readdirSync(directory);
  const paths = [];
  for (const file of files) {
    const filePath = path.join(directory, file);

    // Check if the file extension is .json, .yml, or .yaml
    if (file.match(/\.(json|ya?ml|template)$/i)) {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check if the content of the file contains the specified string
      if (content.includes('AWS::Serverless-2016-10-31')) {
        //console.log('SAM template file found:', file);
        paths.push(filePath);
      }
    }
  }

  if (paths.length === 1) {
    return paths[0];
  }

  if (paths.length > 1) {
    console.log('Multiple SAM template files found. Please specify which one to use with the --template option.');
    process.exit(1);
  }

  console.log('Template file not found.');
  return null;
}

module.exports = {
  parse,
  stringify,
  format,
  findSAMTemplateFile
};
