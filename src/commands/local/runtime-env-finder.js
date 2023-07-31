const fs = require('fs');

function determineRuntime() {

  if (fs.existsSync('cdk.json')) return "cdk-ts";
  if (fs.existsSync('tsconfig.json')) return "sam-ts";

  // does a file ending -csproj exist in the current folder?
  const files = fs.readdirSync('.');
  for (const file of files) {
    if (file.endsWith('.csproj')) return "sam-dotnet";
  }

  if (fs.existsSync('nuget.config')) return "sam-dotnet";
  if (fs.existsSync('samconfig.toml')) return "sam-js";
}

module.exports = {
  determineRuntime
}