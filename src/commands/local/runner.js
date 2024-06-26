const fs = require('fs');
const { exec } = require('child_process');

async function run(cmd) {
  const lambdaDebug = await import("./lib/index.js");

  await lambdaDebug.connect();
}
async function stop(cmd) {
  const lambdaDebug = await import("./lib/index.js");

  await lambdaDebug.cleanup();
}
if (process.argv[2] === "run") {
  run();
}

module.exports = {
  run,
  stop
};

