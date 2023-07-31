function run(initialised) {
  process.env.outDir = ".samp-out";
  let fileContent = fs.readFileSync("tsconfig.json", "utf8");
  // remove // comments
  fileContent = fileContent.replace(/\/\/.*/g, '');
  const dotnetProcess = exec(`dotnet watch`, {});
  dotnetProcess.stdout.on('data', (data) => {
    console.log("dotnet: ", data.toString().replace(/\n$/, ''));
    if (data.toString().includes("Waiting for a file to change before") && !initialised) {
      initialised = true;
      const childProcess = exec(`${__dirname}/../../../node_modules/.bin/node ${__dirname}/runner.js run`, {});
      childProcess.stdout.on('data', (data) => print(data));
      childProcess.stderr.on('data', (data) => print(data));
    }
  });
  return initialised;
}
