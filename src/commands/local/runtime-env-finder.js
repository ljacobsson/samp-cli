const fs = require('fs');
const path = require('path');

function determineRuntime() {

  if (fs.existsSync('cdk.json')) return "cdk-ts";
  if (fs.existsSync('tsconfig.json')) return "sam-ts";

  // does a file ending -csproj exist in the current folder or subfolders?
  const csprojFiles = [];
  const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
      const dirFile = path.join(dir, file);
      try {
        filelist = walkSync(dirFile, filelist);
      } catch (err) {
        if (err.code === 'ENOTDIR' || err.code === 'EBUSY') filelist = [...filelist, dirFile];
        else throw err;
      }
    });
    return filelist;
  }
  walkSync(process.cwd()).forEach(file => {
    if (file.endsWith('.csproj')) csprojFiles.push(file);
  });
  if (csprojFiles.length > 0) return "sam-dotnet";

  if (fs.existsSync('nuget.config')) return "sam-dotnet";
  if (fs.existsSync('samconfig.toml')) return "sam-js";
}

module.exports = {
  determineRuntime
}