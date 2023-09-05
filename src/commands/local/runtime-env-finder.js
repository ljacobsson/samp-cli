const fs = require('fs');
const path = require('path');
const { parse, findSAMTemplateFile } = require('../../shared/parser');

function determineRuntime() {
  const templateFile = findSAMTemplateFile(process.cwd());
  if (templateFile && !templateFile.includes('mock')) {

    const template = parse("sam", fs.readFileSync(templateFile, 'utf8'));
    const firstFunction = Object.keys(template.Resources).find(key => template.Resources[key].Type === "AWS::Serverless::Function");
    const runtime = (template.Resources[firstFunction].Properties.Runtime || template.Globals?.Function?.Runtime).substring(0, 3);
    switch (runtime) {
      case "dot":
        return { iac: "sam", functionLanguage: "dotnet", runtime: "dotnet" };
      case "pyt":
        return { iac: "sam", functionLanguage: "python", runtime: "python" };
      case "jav":
        return { iac: "sam", functionLanguage: "java", runtime: "java" };
      case "nod": {
        const isTs = fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
        return { iac: "sam", functionLanguage: isTs ? "ts" : "js", runtime: "nodejs", isNodeJS: true };
      }
    }
  }
  if (fs.existsSync('cdk.json')) {
    const cdkJson = JSON.parse(fs.readFileSync('cdk.json', 'utf8'));
    if (cdkJson.app.includes('python')) return { iac: "cdk", functionLanguage: "python", runtime: "python" };
    return { iac: "cdk", functionLanguage: "ts", runtime: "nodejs", isNodeJS: true };
  }
  if (fs.existsSync('tsconfig.json')) return { iac: "sam", functionLanguage: "ts", runtime: "nodejs", isNodeJS: true };
}

module.exports = {
  determineRuntime
}