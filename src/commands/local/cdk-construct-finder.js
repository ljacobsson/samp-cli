const fs = require('fs');
const path = require('path');

function findFilesWithExtension(rootDir, fileExtension) {
  let files = [];

  function traverseDir(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const itemPath = path.join(currentDir, item);
      const itemStats = fs.statSync(itemPath);

      if (itemStats.isDirectory()) {
        traverseDir(itemPath);
      } else if (path.extname(itemPath) === fileExtension && !itemPath.includes('node_modules')) {
        files.push(itemPath);
      }
    });
  }

  traverseDir(rootDir);
  return files;
}

function findConstructs() {
  const rootDir = '.';
  const fileExtension = '.ts';
  const searchString = /extends.*Stack/g;
  const files = findFilesWithExtension(rootDir, fileExtension);
  const matchedFiles = [];

  files.forEach((file) => {
    const fileContent = fs.readFileSync(file, 'utf8');

    if (fileContent.match(searchString)) {
      matchedFiles.push(file);
    }
  });

  return matchedFiles;
}


module.exports = {
  findConstructs
};