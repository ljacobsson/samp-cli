# sam-patterns-cli

*Note: this is an early version of a CLI backed by an early version of a community driven resource; https://serverlessland.com/patterns/. There might be bugs*

This tool lets you browse the content of the [Serverless Patterns Collection](https://serverlessland.com/patterns/) and inject patterns directly into your SAM template. Support for both JSON and YAML.

## Usage
```
Usage: sam-patterns [options] [command]

Options:
  -v, --vers          output the current version
  -h, --help          display help for command

Commands:
  import|i [options]  Imports a pattern from https://github.com/aws-samples/serverless-patterns/
  help [command]      display help for command
```

## Demo
![Demo](images/demo.gif)

## Known issues
* Comments in YAML disappear when parsing the template
* Some templates in the Serverless Patterns Collection have bugs and are unparseable
