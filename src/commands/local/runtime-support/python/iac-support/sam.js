const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
async function setup(initialised, cmd) {
  await run(initialised, cmd);
}

async function run(initialised, cmd) {
  try {
    if (!fs.existsSync('.samp-out')) {
      fs.mkdirSync('.samp-out');
    }
    if (!fs.existsSync('.samp-out/samp-requests')) {
      fs.mkdirSync('.samp-out/samp-requests');
    }

    mergeRequirementFiles(process.cwd());
    removeDuplicatesFromFile('.samp-out/requirements.tmp');
    fs.cpSync(`${__dirname}/../../../runtime-support/python`, `.samp-out/`, { recursive: true });

    const pythonProcess = exec(`pip install -r ${process.cwd()}/.samp-out/requirements.txt -t ${process.cwd()}/.samp-out`, {});
    console.log("Installing dependencies...");
    pythonProcess.stderr.on('data', (data) => print(data));
    //pythonProcess.stdout.on('data', (data) => print(data));
    pythonProcess.on('exit', (code) => {
      initialised = true;
      const childProcess = exec(`node ${__dirname}../../../../runner.js run`, {});
      childProcess.stdout.on('data', (data) => print(data));
      childProcess.stderr.on('data', (data) => print(data));
      if (!cmd.debug) {
        const pythonProcess = exec(`${process.env.SAMP_PYTHON_EXECUTABLE || 'python'} entrypoint.py`, { cwd: `${process.cwd()}/.samp-out` });
        pythonProcess.stderr.on('data', (data) => print(data));
        pythonProcess.stdout.on('data', (data) => print(data));
      } else {
        console.log("You can now select '[SAMP] Debug Lambda functions' and start debugging");
      }
    });
    return initialised;
  } catch (error) {
    console.log(error);
  }
}

function print(data) {
  if (!process.env.muteParentOutput) {
    console.error("[SAMP] " + data.toString().replace(/\n$/, ''));
  }
}

function mergeRequirementFiles(dirPath) {
  const outputFile = '.samp-out/requirements.tmp';

  const mergeContents = (filePaths, outputFilePath) => {
    const mergedContent = filePaths
      .map(filePath => fs.readFileSync(filePath, 'utf-8'))
      .join('\n');

    fs.writeFileSync(outputFilePath, mergedContent);
  };

  const gatherFilePaths = (dir) => {
    let filePaths = [];

    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const fileStat = fs.statSync(filePath);

      if (fileStat.isDirectory()) {
        filePaths = filePaths.concat(gatherFilePaths(filePath));
      } else if (file === 'requirements.txt') {
        filePaths.push(filePath);
      }
    });

    return filePaths;
  };

  const requirementFilePaths = gatherFilePaths(dirPath);

  if (requirementFilePaths.length > 0) {
    mergeContents(requirementFilePaths, outputFile);
  } else {
    console.log('No requirements.txt files found.');
  }
}

function removeDuplicatesFromFile(filePath) {
  const outputFile = '.samp-out/requirements.txt';

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let uniqueLines = [...new Set(lines)]; // Use a Set to remove duplicates
  uniqueLines = uniqueLines.filter(line => !line.startsWith('pytest'));
  uniqueLines.push('watchdog');
  const uniqueContent = uniqueLines.join('\n');
  fs.writeFileSync(outputFile, uniqueContent);
  fs.unlinkSync(filePath);
}


module.exports = {
  setup
};