Prerequisites at time of writing:
* Function runtime should be `dotnet6`
* Has to be a SAM project. CDK might come later
* It assumes a folder structure where the SAM template is in the root, next to the `samconfig.toml` file
* The SAM template can be in either JSON or YAML format and can be called anything with a `json`, `yml`, `yaml` or `.template` extension
* You need to have npm/node isntalled on your system

### Instructions for VS Code
1. Clone this repo and check out this branch (`dotnet-support`)
2. Run `npm link`
3. cd to your .NET Lambda project root (make sure it has been deployed and that you're targeting a test environment)
4. Run `samp local --debug` and follow the prompts. This will create/append to `launch.json` and `tasks.json` in your `.vscode` folder with the necessary launch configuration
5. Run `samp local` and leave it running. (see `samp local --help` for all options)
6. Hit F5 (or start debugging via the dropdown menu)

When you're done debugging, exit the `samp local` process with Ctrl+C and you functions will be restored to run in the cloud again.

### Instructions for JetBrains Rider

1. Clone this repo and check out this branch (`dotnet-support`)
2. Run `npm link`
3. Open your solution file in Rider. Ensure the solution file is in the same folder as the SAM template
4. Run `samp local --debug` and follow the prompts. This will create a debug configuration in your `.run` folder
5. Run `samp local --profile <your aws profile>` and leave it running. (see `samp local --help` for all options)
6. Hit F5 (or start debugging via the dropdown menu)

### Instructions for Visual Studio

1. Clone this repo and check out this branch (`dotnet-support`)
2. Run `npm link`
4. Run `samp local --profile <your aws profile>` and leave it running. (see `samp local --help` for all options)
5. Add a new folder to your Lambda function project called `Properties`
6. Inside the properties folder, create a file called `launchSettings.json` *this file may already exist*
7. Configure the `launchSettings.json` file to include the below configuration

```json
{
  "profiles": {
    "HelloWorld": {
      "commandName": "Executable",
      "executablePath": "<SAM_TEMPLATE_DIRECTORY>\\.samp-out\\bin\\Debug\\net6.0\\dotnet.exe",
      "workingDirectory": "<SAM_TEMPLATE_DIRECTORY>",
      "remoteDebugEnabled": false
    }
  }
}
```
8. After every change to your function code you need to ensure that the `./.samp-out/dotnet.csproj` file is re-compiled. You can either:
  - Manually recompile using the command line `dotnet build ./samp-out/dotnet.csproj`
  - Add the `dotnet.csproj` file to your solution and recompile as part of your debug process
9. Hit F5 (or start debugging from the UI)