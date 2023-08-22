const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { findSAMTemplateFile, parse } = require('../../../../../shared/parser');

async function setup(initialised, cmd) {
  const projectReferenceTemplate = '<ProjectReference Include="..\%code_uri%.csproj" />';
  let template = ""

  // If custom template file is provided through the cli
  const templateFile = process.env.SAMP_TEMPLATE_FILE
  if (templateFile) {
    if (fs.existsSync(templateFile)) {
      template = parse("template", fs.readFileSync(templateFile).toString());
    } else {
      console.log(`The specified ${templateFile} cannot be found`);
      return;
    }
  } else {
    // If not provided then find default sam templatefile
    template = parse("template", fs.readFileSync(findSAMTemplateFile('.')).toString());
  }

  // fetch all functions
  const functions = Object.keys(template.Resources).filter(key => template.Resources[key].Type === "AWS::Serverless::Function");
  const codeURIs = functions.map(f => {
    const props = template.Resources[f].Properties
    const codeUri = (props.CodeUri || template.Globals.Function.CodeUri + "/").replace(/\/\//g, "/");
    const project = props.Handler.split("::")[0];
    return `\\${codeUri}\\${project}`;
  });

  const uniqueCodeURIs = [...new Set(codeURIs)];
  console.log('Copying dotnet project');
  fs.cpSync(`${__dirname}/../../../runtime-support/dotnet`, `.samp-out/`, { recursive: true });

  let csproj = fs.readFileSync(`.samp-out/dotnet.csproj`, 'utf8');

  for (const codeUri of uniqueCodeURIs) {
    csproj = csproj.replace("<!-- Projects -->", projectReferenceTemplate.replace("%code_uri%", codeUri) + "\n<!-- Projects -->");
  }
  csproj = csproj.replace("<!-- Projects -->", "");
  fs.writeFileSync(`.samp-out/dotnet.csproj`, csproj);

  await run(initialised, cmd);
}


async function run(initialised, cmd) {
  try {
    //process.env.outDir = ".samp-out";
    await copyAppsettings();
    process.env.DOTNET_WATCH_RESTART_ON_RUDE_EDIT = "true";

    const dotnetProcess = exec(`dotnet build`, { cwd: `.samp-out` });
    dotnetProcess.stderr.on('data', (data) => print(data));
    dotnetProcess.stdout.on('data', (data) => {
      console.log("dotnet: ", data.toString().replace(/\n$/, ''));
      if (!initialised) {
        initialised = true;
        const childProcess = exec(`node ${__dirname}../../../../runner.js run`, {});
        childProcess.stdout.on('data', (data) => print(data));
        childProcess.stderr.on('data', (data) => print(data));
        if (!cmd.debug) {
          const runProcess = exec(`dotnet watch run`, { cwd: `${process.cwd()}/.samp-out` });
          runProcess.stderr.on('data', (data) => print(data));
          runProcess.stdout.on('data', (data) => print(data));
        } else {
          console.log("You can now select '[SAMP] Debug Lambda functions' and start debugging");
        }
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

const findAppSettingsJson = async (folderPath = ".") => {
  try {
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileStat = fs.statSync(filePath);

      if (fileStat.isDirectory()) {
        const appSettingsPath = await findAppSettingsJson(filePath);
        if (appSettingsPath) {
          return appSettingsPath;
        }
      } else if (file === 'appsettings.json') {
        return filePath;
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
};

async function copyAppsettings() {
  const dir = process.cwd();
  const sourceFilePath = await findAppSettingsJson(dir);
  if (sourceFilePath) {
    const destinationPath = path.join(dir, '.samp-out', 'appsettings.json');

    try {
      fs.copyFileSync(sourceFilePath, destinationPath);
      console.log('appsettings.json copied successfully!');
    } catch (err) {
    }
  };
}

module.exports = {
  setup
};