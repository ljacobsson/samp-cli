const fs = require('fs');
const path = require('path');

function findFilesWithExtension(rootDir, fileExtension, packagesDir = "node_modules") {
  let files = [];

  function traverseDir(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const itemPath = path.join(currentDir, item);
      const itemStats = fs.statSync(itemPath);

      if (itemStats.isDirectory()) {
        traverseDir(itemPath);
      } else if (path.extname(itemPath) === fileExtension && !itemPath.includes(packagesDir) && !itemPath.startsWith(".") && !itemPath.includes('.samp-out')) {
        files.push(itemPath);
      }
    });
  }

  traverseDir(rootDir);
  return files;
}


module.exports = {
  findFilesWithExtension
};