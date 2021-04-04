# sam-patterns-cli

*Note: this is an early version of a CLI backed by an early version of a community driven resource; https://serverlessland.com/patterns/. There might be bugs*

This tool lets you browse the content of the [Serverless Patterns Collection](https://serverlessland.com/patterns/) and inject patterns directly into your SAM template. Support for both JSON and YAML.

## Installation
`npm install -g sam-patterns-cli`

Acquire a Github access token from [here](https://github.com/settings/tokens) and store it in environment variable `GITHUB_TOKEN`. This is not strictly required, but if you don't you'll be rate limited to 60 requests per hour.

## Usage

### sam-patterns import
Imports a serverless pattern into an existing template

```
Usage: sam-patterns [options] [command]

Options:
  -v, --vers          output the current version
  -h, --help          display help for command

Commands:
  import|i [options]  Imports a pattern from https://github.com/aws-samples/serverless-patterns/
  help [command]      display help for command
```
![Demo](images/demo.gif)

### sam-patterns explore
Lets you browse and explore your serverless patterns repositories. You can either visualise them using [cfn-diagram](https://github.com/mhlabs/cfn-diagram) or click through to the pattern's documentation. 

```
Usage: sam-patterns explore|e [options]

Explores and visualises patterns from https://github.com/aws-samples/serverless-patterns/

Options:
  -h, --help  display help for command
```
![Demo](images/demo2.gif)

### sam-patterns source
Lets you add more sources. This could be public repositores, such as Jermey Daly's [Serverless Reference Architectures](https://www.jeremydaly.com/serverless-reference-architectures/) or a private repository for company specific patterns.

Example how to add Jeremy Daly's reference architectures as a source:
```
? GitHub owner: serverless-architecture
? GitHub repo: reference-architectures
? Root: folder /
? Relative path to template file: /sam
? Template filename(s): template.yaml,template.yml
? URL (use #PATTERN_NAME# as placeholder): https://jeremydaly.com/the-#PATTERN_NAME#-pattern
```
The configuration gets stored in `~/.sam-patterns-cli/settings.json`

If you create your own collection you need to follow this structure:
```
  The repository should follow the following structure. (README.md is optional):
  ├── pattern-1
  | ├── README.md
  │ └── template.yaml
  ├── pattern-2
  | ├── README.md
  │ └── template.yaml
  └── pattern-3
    ├── README.md
    └── template.yaml
```

## Customise pattern imports using placeholders and property manipulation
Say you host a pattern that creates an SQS queue and a Lambda function and sets the queue as an event source:
```
AWSTemplateFormatVersion: 2010-09-09
Transform:
  - AWS::Serverless-2016-10-31
Resources:
  The_Consumer:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs14.x
      CodeUri: src/
      Handler: The_Consumer.handler
      Timeout: 3
      Events:
        SQS:
          Type: SQS
          Properties: 
            BatchSize: 10
            Queue: !GetAtt The_Queue.Arn
  The_Queue:
    Type: AWS::SQS::Queue
```
When a user of this snippet imports it into their template they are likely to jump straight at renaming the resources to something that semantically describes the type of messages the queue is handling. Also, the runtime is likely to be something different.

As a pattern producer you can help out with this by defining a Metadata object on the pattern template:
```
Metadata:
  PatternTransform:
    Placeholders:
      - Placeholder: The_
        Message: Message type
    Properties:
      - JSONPath: $.Resources.The_Consumer.Properties.Events.SQS.Properties.BatchSize
        InputType: number
        Message: Enter batch size
      - JSONPath: $.Resources.The_Consumer.Properties.CodeUri
        InputType: string
        Message: Enter CodeUri
```

*`PatternTransform.Placeholders` (array)*
* `Placeholder`: the string to be replaced
* `Message`: A message to be displayed (optional)

*`PatternTransform.Properties` (array)*
* `JSONPath`: The [JSONPath](https://support.smartbear.com/alertsite/docs/monitors/api/endpoint/jsonpath.html) to the property to be modified
* `Message`: A message to be displayed (optional)
* `InputType`: The datatype. Currently supports `string`, `number` or `runtime-select`

The input type `runtime-select` lets the user select a valid Lambda runtime. This metadata is automatically applied to all patterns, so there's no need to explicitly add it. If the user always writes code in a specific language they can export environment variable `SAM_PATTERNS_DEFAULT_RUNTIME` to a valid [Lambda runtime identifier](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)

![Demo](images/demo3.gif)

## Known issues and limitations
* Comments in YAML disappear when parsing the template
* Only content form the template.yaml file will be imported. Any supporting files like lambda functions or openapi schemas will be skipped.
* Only works with SAM templates
