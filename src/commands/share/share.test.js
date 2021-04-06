const share = require("./share");
const inquirer = require("inquirer");

test("Test transform", async () => {
  await share.flattenAndIndent(template);
});

const template = {
  AWSTemplateFormatVersion: "2010-09-09T00:00:00.000Z",
  Transform: ["AWS::Serverless-2016-10-31"],
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
      Properties: {
        Name: "test"
      }
    },
  },
};
