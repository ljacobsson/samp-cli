Prerequisites at time of writing:
* Function runtime should be `dotnet6`
* Has to be a SAM project. CDK might come later
* It assumes a folder structure where the SAM template is in the root, next to the `samconfig.toml` file
* The SAM template can be in either JSON or YAML format and can be called anything with a `json`, `yml`, `yaml` or `.template` extension

Instructions
1. Clone this repo and check out this branch
2. Run `npm link`
3. cd to your .NET Lambda project root (make sure it has been deployed and that you're targeting a test environment)
4. Create `.vscode/launch.json` and `.vscode/tasks.json` files (see below). Should work for any IDE, but have only tried in vscode. Creation of these will be automated in the future.
5. Run `samp local --profile <your aws profile>` and leave it running. (see `samp local --help` for all options)
6. Hit F5 (or start debugging via the dropdown menu)

`.vscode/launch.json`:
```
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Lambda functions",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "build",      
      "program": "${workspaceFolder}/.samp-out/bin/Debug/net6.0/dotnet.dll",
      "args": [],
      "cwd": "${workspaceFolder}",
      "stopAtEntry": false,
      "console": "internalConsole"
    }
  ]
}
```

`.vscode/tasks.json`:
```
{
  "tasks": [
    {
      "label": "build",
      "command": "dotnet",
      "type": "process",
      "args": [
        "build",
        "${workspaceFolder}/.samp-out/dotnet.csproj"
      ],
      "problemMatcher": "$msCompile"
    },
  ]
}
```

When you're done debugging, exit the `samp local` process with Ctrl+C and you functions will be restored to run in the cloud again.
