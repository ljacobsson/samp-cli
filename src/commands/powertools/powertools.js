const runtimeFinder = require('../../shared/runtime-env-finder');
const { execSync } = require('child_process');
const inputUtil = require('../../shared/inputUtil');
const { AsciiTable3 } = require('ascii-table3');

const modules = {
  "Logger": {
    "module": "logger",
    "docs": "https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger/"
  },
  "Tracer": {
    "module": "tracer",
    "docs": "https://docs.powertools.aws.dev/lambda/typescript/latest/core/tracer/"
  },
  "Metrics": {
    "module": "metrics",
    "docs": "https://docs.powertools.aws.dev/lambda/typescript/latest/core/metrics/"
  },
  "Parameters": {
    "module": "parameters",
    "docs": "https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/parameters/"
  },
  "Idempotency": {
    "module": "idempotency",
    "docs": "https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/"
  },
  "Batch processing": {
    "module": "batch",
    "docs": "https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/batch/"
  },
}

async function run(cmd) {
  const runtime = runtimeFinder.determineRuntime();

  if (runtime.functionless) {
    console.log("Could not find any functions in your SAM template");
    return;
  }

  if (runtime.defaulted) {
    console.log("This command only supports NodeJS projects");
    return;
  }

  if (runtime.isNodeJS) {
    const modulesToInstall = await inputUtil.checkbox("Which module(s) do you want to install?", Object.keys(modules));
    const packages = modulesToInstall.map(m => `@aws-lambda-powertools/${modules[m].module}`);

    execSync('npm install ' + packages.join(' '), { stdio: 'inherit' });
    // build a table of the modules and their docs

    const table =
      new AsciiTable3('Installed packages')
        .setHeading('Module', 'Documentation')
        .setAlignCenter(3)
        .addRowMatrix(modulesToInstall.map(m => [m, modules[m].docs]));

    // set compact style
    table.setStyle('compact');
    console.log(table.toString());
  }

}

module.exports = {
  run,
};