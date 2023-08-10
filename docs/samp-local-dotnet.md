## Local debugging for functions written in .NET

### Prerequisites:
* Function runtime should be `dotnet6`
* Has to be a SAM project. CDK might be supported later.
* It assumes a folder structure where the SAM template is in the root, next to the `samconfig.toml` file
* The SAM template can be in either JSON or YAML format and can be called anything with a `json`, `yml`, `yaml` or `.template` extension
* You need to have npm/node installed on your system.

### Supported IDEs
Local debugging should work in any IDE, however `samp local --debug` automates launch config for the following IDEs:
* VS Code
* Visual Studio
* JetBrains Rider
* JetBrains PyCharm

### Get started
1. Install `samp-cli`:
```bash
$ npm install -g samp-cli
```
2. cd to your .NET Lambda project root (make sure it has been deployed and that you're targeting a test environment. *Never* run this against a production environment!)
3. Run `samp local --debug` and follow the prompts. This will create the required IDE specific configuration files. Leave the process running.
5. Hit F5 (or start debugging via the dropdown menu)

When you're done debugging, kill the `samp local` process with Ctrl+C (⌘+C on Mac) and you functions will be restored to run in the cloud again.


### Hot reloads and .NET

Hot reloads work well with NodeJS, but the native .NET support isn't quite there yet and it's due in .NET 7
8. After every change to your function code you need to ensure that the `./.samp-out/dotnet.csproj` file is re-compiled. You can either:
  - Manually recompile using the command line `dotnet build ./samp-out/dotnet.csproj`
  - Add the `dotnet.csproj` file to your solution and recompile as part of your debug process
9. Hit F5 (or start debugging from the UI)


### Acknowledgement
Big thanks to [James Eastham](https://twitter.com/plantpowerjames) for all the help with the testing and configuration.