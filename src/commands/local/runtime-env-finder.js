const fs = require('fs');
const path = require('path');
const { parse, findSAMTemplateFile } = require('../../shared/parser');
const enums = require('../../shared/enums');

function determineRuntime(customTemplateFile) {

  let templateFile = ""

  // If custom template file is provided through the cli
  if (customTemplateFile) {
    if (fs.existsSync(customTemplateFile)) {
      templateFile = customTemplateFile;
    } else {
      return null;
    }
  } else {
    // If not provided then find default sam templatefile
    templateFile = findSAMTemplateFile(process.cwd());
  }
  
  if (templateFile) {

    const template = parse("sam", fs.readFileSync(templateFile, 'utf8'));
    const firstFunction = Object.keys(template.Resources).find(key => template.Resources[key].Type === "AWS::Serverless::Function");
    const runtime = (template.Resources[firstFunction].Properties.Runtime || template.Globals?.Function?.Runtime).substring(0, 3);
    switch (runtime) {
      case "dot":
        return { iac: "sam", functionLanguage: enums.languages.Csharp, runtime: enums.runtimes.Dotnet};
      case "pyt":
        return { iac: "sam", functionLanguage: enums.languages.Python, runtime: enums.runtimes.Python};
      case "jav":
        return { iac: "sam", functionLanguage: enums.languages.Java, runtime: enums.runtimes.Java};
      case "nod": {
        if (fs.existsSync('cdk.json')) return { iac: "cdk", functionLanguage: enums.languages.TypeScript, runtime: enums.runtimes.NodeJs }; // Only CDK with TS is supported
        if (fs.existsSync('tsconfig.json')) return { iac: "sam", functionLanguage: enums.languages.TypeScript, runtime: enums.runtimes.NodeJs };
        return { iac: "sam", functionLanguage: enums.languages.JavaScript, runtime: enums.runtimes.NodeJs };
      }
      default: {
        return null;
      }
    }
  }
  
  return null;
}

module.exports = {
  determineRuntime
}