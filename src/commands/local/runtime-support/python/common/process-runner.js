const { exec } = require("child_process");

function run(cmd) {
  const pythonProcess = exec(`python3.9 ${process.cwd()}/.samp-out/entrypoint.py`, {});
  pythonProcess.stderr.on('data', (data) => print(data));
  pythonProcess.stdout.on('data', (data) => print(data));
}

function print(data) {
  console.log("[python] " + data.toString().replace(/\n$/, ''));
}

module.exports = {
  run
};