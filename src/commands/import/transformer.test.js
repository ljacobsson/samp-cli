const transformer = require("./transformer");
const inquirer = require("inquirer");

test("Test transform", async () => {
  inquirer.prompt = (questions) => Promise.resolve({ text: "test" });

  await transformer.transform(template);
});

const template = {
  AWSTemplateFormatVersion: "2010-09-09T00:00:00.000Z",
  Transform: ["AWS::Serverless-2016-10-31"],
  Metadata: {
    PatternTransform: {
      Placeholders: [
        {
          Placeholder: "The_",
          InputType: "text",
          Message: "Message type",
        },
      ],
      Properties: [
        {
          JSONPath:
            "$.Resources.The_Consumer.Properties.Environment.Variables.Number",
          InputType: "number",
          Message: "Enter a number",
        },
        {
          JSONPath: "$.Resources.TheConsumer.Properties.Runtime",
          InputType: "runtime-select",
        },
      ],
    },
  },
  Resources: {
    The_Consumer: {
      Type: "AWS::Serverless::Function",
      Properties: {
        Runtime: "nodejs14.x",
        CodeUri: "src/",
        Handler: "The_Consumer.js",
        Timeout: 3,
        Environment: {
          Variables: {
            Number: 123,
          },
        },
        Events: {
          SQS: {
            Type: "SQS",
            Properties: {
              Queue: null,
            },
          },
        },
      },
    },
    The_Queue: {
      Type: "AWS::SQS::Queue",
    },
  },
};
