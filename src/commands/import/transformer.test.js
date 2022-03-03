const transformer = require("./transformer");
const inquirer = require("inquirer");
const inputUtil = require("../../shared/inputUtil");
const jp = require("jsonpath");
test("Fix dashed field name", async () => {
    const obj = {
        inner: {
            "detail-type": "abc",
        },
    };

    const value = jp.query(obj, '$["detail-type"]');

    console.log("value", value);
});

test("Test transform", async () => {
    inputUtil.text = (message, defaultValue) => { return "test" }
    process.env.SAM_PATTERNS_DEFAULT_RUNTIME = "nodejs14.x";

    await transformer.transform(template, { metadataPromtTitle: "test" });
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
