const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SchemasClient, DescribeSchemaCommand, UpdateSchemaCommand, CreateSchemaCommand, CreateRegistryCommand } = require('@aws-sdk/client-schemas');
const { fromSSO } = require("@aws-sdk/credential-provider-sso");
const fs = require('fs');
const path = require('path');
const inputUtil = require('../../shared/inputUtil');

async function invoke(cmd, resource) {
  const resourceName = resource.PhysicalResourceId;
  const lambdaClient = new LambdaClient({ region: cmd.region, credentials: await fromSSO({ profile: cmd.profile }) });
  const schemasClient = new SchemasClient({ region: cmd.region, credentials: await fromSSO({ profile: cmd.profile }) });
  let files = [];
  if (!cmd.payload) {
    const sources = ["Empty JSON", "Local JSON file", "Shared test event", "Input JSON"];
    const requestsPath = `${process.cwd()}/.samp-out/samp-requests`;
    if (fs.existsSync(requestsPath)) {
      files = getRequestFiles(requestsPath, resourceName);
      if (files.length > 0) {
        sources.unshift("Recent request (samp local)");
      }
    }
    const payloadSource = await inputUtil.list("Select a payload source", sources);
    if (payloadSource === "Recent request (samp local)") {
      const file = await inputUtil.autocomplete("Select a recent request", files.map(p => {
        let stringifiedEvent;
        if (p.event instanceof Object) {
          stringifiedEvent = JSON.stringify(p.event);
        } else {
          stringifiedEvent = p.event;
        }
        
        if (stringifiedEvent.length > 64) {
          stringifiedEvent = stringifiedEvent.substring(0, 50) + "...";
        }
        return { name: `[${p.createdAt.toLocaleTimeString()}] ${stringifiedEvent}`, value: p.name }
      }));
      const obj = fs.readFileSync(`${process.cwd()}/.samp-out/samp-requests/${file}`, "utf8");
      cmd.payload = JSON.stringify(JSON.parse(obj).obj.event);
    } else if (payloadSource === "Empty JSON") {
      cmd.payload = "{}";
    } else if (payloadSource === "Local JSON file") {
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

function getRequestFiles(folderPath, resourceName) {
  try {
    const files = fs.readdirSync(folderPath, { withFileTypes: true });

    const fileDetails = files
      .filter(file => {
        if (!file.isFile()) {
          return false;
        }
        const fileContent = JSON.parse(fs.readFileSync(path.join(folderPath, file.name), "utf8"));
        return fileContent.obj.context.functionName === resourceName;
      }
      )
      .map(file => {
        const filePath = path.join(folderPath, file.name);
        const stats = fs.statSync(filePath);
        const event = JSON.parse(fs.readFileSync(path.join(folderPath, file.name), "utf8")).obj.event;
        return { name: file.name, createdAt: stats.ctime, event };
      });

    const sortedFiles = fileDetails.sort((a, b) => b.createdAt - a.createdAt);
    return sortedFiles;
  } catch (err) {
    console.error('Error reading folder:', err);
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