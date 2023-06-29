const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SchemasClient, DescribeSchemaCommand, UpdateSchemaCommand, CreateSchemaCommand, CreateRegistryCommand } = require('@aws-sdk/client-schemas');
const { fromSSO } = require("@aws-sdk/credential-provider-sso");
const fs = require('fs');
const inputUtil = require('../../shared/inputUtil');

async function invoke(cmd, resourceName) {
  const lambdaClient = new LambdaClient({ region: cmd.region, credentials: await fromSSO({ profile: cmd.profile }) });
  const schemasClient = new SchemasClient({ region: cmd.region, credentials: await fromSSO({ profile: cmd.profile }) });
  if (!cmd.payload) {
    const payloadSource = await inputUtil.list("Select a payload source", ["Local JSON file", "Shared test event", "Input JSON"]);
    if (payloadSource === "Local JSON file") {
      cmd.payload = await inputUtil.file("Select file(s) to use as payload", "json");
    } else if (payloadSource === "Shared test event") {
      try {
        const sharedEvents = await schemasClient.send(new DescribeSchemaCommand({ RegistryName: "lambda-testevent-schemas", SchemaName: `_${resourceName}-schema` }));
        const schema = JSON.parse(sharedEvents.Content);
        const savedEvents = Object.keys(schema.components.examples);
        const event = await inputUtil.autocomplete("Select an event", savedEvents);
        cmd.payload = JSON.stringify(schema.components.examples[event].value);
      } catch (e) {
        console.log("Failed to fetch shared test events", e.message);
        process.exit(1);
      }
    } else if (payloadSource === "Input JSON") {
      do {
        cmd.payload = await inputUtil.text("Enter payload JSON");
      } while (!isValidJson(cmd.payload, true));
      const save = await inputUtil.prompt("Save as shared test event?", "No");
      if (save) {
        const name = await inputUtil.text("Enter a name for the event");
        try {
          try {
            await schemasClient.send(new CreateRegistryCommand({ RegistryName: registryName }));
          } catch (e) {
            // do nothing
          }

          const schema = await schemasClient.send(new DescribeSchemaCommand({ RegistryName: "lambda-testevent-schemas", SchemaName: `_${resourceName}-schema` }));
          const schemaContent = JSON.parse(schema.Content);
          schemaContent.components.examples[name] = { value: JSON.parse(cmd.payload) };
          await schemasClient.send(new UpdateSchemaCommand({ RegistryName: "lambda-testevent-schemas", SchemaName: `_${resourceName}-schema`, Type: "OpenApi3", Content: JSON.stringify(schemaContent) }));
        } catch (e) {
          if (e.message.includes("does not exist")) {
            console.log("Creating new schema");
            const schemaContent = {
              openapi: "3.0.0",
              info: {
                title: `Event`,
                version: "1.0.0"
              },
              paths: {},
              components: {
                examples: {
                  [name]: {
                    value: JSON.parse(cmd.payload)
                  }
                }
              }
            };
            await schemasClient.send(new CreateSchemaCommand({ RegistryName: "lambda-testevent-schemas", SchemaName: `_${resourceName}-schema`, Type: "OpenApi3", Content: JSON.stringify(schemaContent) }));
          } else {

            console.log("Failed to save shared test event", e.message);
            process.exit(1);
          }
        }
        console.log(`Saved event '${name}'`);
      }
    }
  }

  if (isFilePath(cmd.payload)) {
    cmd.payload = fs.readFileSync(cmd.payload).toString();
  }

  if (!isValidJson(cmd.payload)) {
    try {
      const sharedEvents = await schemasClient.send(new DescribeSchemaCommand({ RegistryName: "lambda-testevent-schemas", SchemaName: `_${resourceName}-schema` }));
      const schema = JSON.parse(sharedEvents.Content);
      cmd.payload = JSON.stringify(schema.components.examples[cmd.payload].value);
    } catch (e) {
      console.log("Failed to fetch shared test events", e.message);
      process.exit(1);
    }
  }

  if (isValidJson(cmd.payload)) {
    const params = new InvokeCommand({
      FunctionName: resourceName,
      Payload: cmd.payload
    });
    try {
      console.log("Invoking function with payload:", concatenateAndAddDots(cmd.payload, 100))
      const data = await lambdaClient.send(params);
      const response = JSON.parse(Buffer.from(data.Payload).toString());
      try {
        console.log("Response:", JSON.stringify(JSON.parse(response), null, 2));
      } catch (e) {
        console.log("Response:", response);
      }
    }
    catch (err) {
      console.log("Error", err);
    }
  } else {
    console.log("Invalid JSON, please try again");
  }
}

function concatenateAndAddDots(str, maxLength) {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + "...";
}

function isFilePath(str) {
  return str.startsWith("./") || str.startsWith("../") || str.startsWith("/") || str.startsWith("~") || str.startsWith("file://")
    && fs.existsSync(str);
}

function isValidJson(str, logInfo) {
  try {
    JSON.parse(str);
  } catch (e) {
    if (logInfo)
      console.log("Invalid JSON, please try again");
    return false;
  }
  return true;
}

exports.invoke = invoke;