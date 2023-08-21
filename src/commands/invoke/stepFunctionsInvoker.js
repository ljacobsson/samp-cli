const { SFNClient, StartExecutionCommand, ListExecutionsCommand, DescribeExecutionCommand } = require('@aws-sdk/client-sfn');
const { SchemasClient, DescribeSchemaCommand, UpdateSchemaCommand, CreateSchemaCommand, CreateRegistryCommand } = require('@aws-sdk/client-schemas');
const { fromSSO } = require("@aws-sdk/credential-provider-sso");
const link2aws = require('link2aws');
const fs = require('fs');
const inputUtil = require('../../shared/inputUtil');
const registryName = "sfn-testevent-schemas";
async function invoke(cmd, sfnArn) {
  const sfnClient = new SFNClient({ credentials: await fromSSO({ profile: cmd.profile }) });
  const schemasClient = new SchemasClient({ credentials: await fromSSO({ profile: cmd.profile }) });
  const stateMachineName = sfnArn.split(":").pop();
  if (!cmd.payload) {
    const payloadSource = await inputUtil.list("Select a payload source", ["Empty JSON", "Local JSON file", "Shared test event", "Recent execution history", "Input JSON"]);
    if (payloadSource === "Empty JSON") {
      cmd.payload = "{}";
    } else if (payloadSource === "Local JSON file") {
      cmd.payload = await inputUtil.file("Select file(s) to use as payload", "json");
    } else if (payloadSource === "Shared test event") {
      try {
        const sharedEvents = await schemasClient.send(new DescribeSchemaCommand({ RegistryName: registryName, SchemaName: `_${stateMachineName}-schema` }));
        const schema = JSON.parse(sharedEvents.Content);
        const savedEvents = Object.keys(schema.components.examples);
        const event = await inputUtil.autocomplete("Select an event", savedEvents);
        cmd.payload = JSON.stringify(schema.components.examples[event].value);
      } catch (e) {
        console.log("Failed to fetch shared test events", e.message);
        process.exit(1);
      }
    } else if (payloadSource === "Recent execution history") {
      try {
        const executions = await sfnClient.send(new ListExecutionsCommand({ stateMachineArn: sfnArn }));
        const executionNames = executions.executions.map(e => { return { name: `${e.name} (${e.startDate.toISOString()}) - ${e.status}`, value: e.executionArn } });
        const executionArn = await inputUtil.autocomplete("Select an execution", executionNames);
        const execution = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));

        cmd.payload = execution.input
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
          const schema = await schemasClient.send(new DescribeSchemaCommand({ RegistryName: registryName, SchemaName: `_${stateMachineName}-schema` }));
          const schemaContent = JSON.parse(schema.Content);
          schemaContent.components.examples[name] = { value: JSON.parse(cmd.payload) };
          await schemasClient.send(new UpdateSchemaCommand({ RegistryName: registryName, SchemaName: `_${stateMachineName}-schema`, Type: "OpenApi3", Content: JSON.stringify(schemaContent) }));
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
            await schemasClient.send(new CreateSchemaCommand({ RegistryName: registryName, SchemaName: `_${stateMachineName}-schema`, Type: "OpenApi3", Content: JSON.stringify(schemaContent) }));
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
      const sharedEvents = await schemasClient.send(new DescribeSchemaCommand({ RegistryName: registryName, SchemaName: `_${stateMachineName}-schema` }));
      const schema = JSON.parse(sharedEvents.Content);
      cmd.payload = JSON.stringify(schema.components.examples[cmd.payload].value);
    } catch (e) {
      console.log("Failed to fetch shared test events", e.message);
      process.exit(1);
    }
  }

  if (isValidJson(cmd.payload)) {
    let executionName = await inputUtil.text("Enter a name for the execution", "test-execution");
    executionName = executionName.replace(/[^a-zA-Z0-9-_]/g, "-");
    const params = new StartExecutionCommand({
      stateMachineArn: sfnArn,
      input: cmd.payload,
      name: `${executionName}-${Date.now()}`
    });
    try {
      console.log("Invoking state machine with payload:", concatenateAndAddDots(cmd.payload, 100))
      const data = await sfnClient.send(params);
      const response = data.executionArn;
      let url;
      if (response.includes(":express:")) {
        url = `https://${cmd.region}.console.aws.amazon.com/states/home?region=${cmd.region}#/express-executions/details/${response}?startDate=${data.startDate.getTime()}`
      } else {
        url = `https://${cmd.region}.console.aws.amazon.com/states/home?region=${cmd.region}#/v2/executions/details/${response}`;
      }
      console.log("Started:", url);
      return { resourceName: sfnArn, payload: cmd.payload }
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