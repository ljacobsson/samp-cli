const fs = require('fs');
const { exec } = require('child_process');
const chokidar = require('chokidar');

function run(initialised) {
  try {
    //process.env.outDir = ".samp-out";
    const dotnetProcess = exec(`dotnet build .samp-out/dotnet.csproj`, {});
    dotnetProcess.stderr.on('data', (data) => print(data));
    dotnetProcess.stdout.on('data', (data) => {
      console.log("dotnet: ", data.toString().replace(/\n$/, ''));
      if (data.toString().includes("Time Elapsed") && !initialised) {
        initialised = true;
        const childProcess = exec(`node ${__dirname}/runner.js run`, {});
        childProcess.stdout.on('data', (data) => print(data));
        childProcess.stderr.on('data', (data) => print(data));
      }
    });
    return initialised;
  } catch (error) {
    console.log(error);
  }
}

function print(data) {
  if (!process.env.muteParentOutput) {
    console.error(data.toString().replace(/\n$/, ''));
  }
}

module.exports = {
  run
};
