const { SFNClient, TestStateCommand, DescribeStateMachineCommand, ListExecutionsCommand, GetExecutionHistoryCommand } = require('@aws-sdk/client-sfn');
const { CloudFormationClient, ListStackResourcesCommand } = require('@aws-sdk/client-cloudformation');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { fromSSO } = require("@aws-sdk/credential-provider-sso");
const samConfigParser = require('../../shared/samConfigParser');
const parser = require('../../shared/parser');
const fs = require('fs');
const inputUtil = require('../../shared/inputUtil');
const clc = require("cli-color");
const path = require('path');
const { Spinner } = require('cli-spinner');
const jp = require('jsonpath');

const os = require('os');
const { ConflictingResourceUpdateException } = require('@aws-sdk/client-iot');
let clientParams;
async function run(cmd) {
    const config = await samConfigParser.parse();

    if (!cmd.stackName && !config.stack_name) {
        console.log("No stack name found. Use --stack-name or set stack_name in samconfig.toml");
        process.exit(1);
    }

    if (!cmd.region && !config.region) {
        console.log("No region found. Use --region or set region in samconfig.toml");
        process.exit(1);
    }

    let credentials;
    try {
        credentials = await fromSSO({ profile: cmd.profile || config.profile || 'default' });
    } catch (e) {
    }

    clientParams = { credentials, region: cmd.region || config.region }
    const sfnClient = new SFNClient(clientParams);
    const cloudFormation = new CloudFormationClient(clientParams);
    const sts = new STSClient(clientParams);
    const template = await parser.findSAMTemplateFile(process.cwd());
    const templateContent = fs.readFileSync(template, 'utf8');
    const templateObj = parser.parse("template", templateContent);
    const stateMachines = findAllStateMachines(templateObj);
    const stateMachine = stateMachines.length === 1 ? stateMachines[0] : await inputUtil.list("Select state machine", stateMachines);

    const definitionFile = templateObj.Resources[stateMachine].Properties.DefinitionUri;
    const definitionObj = parser.parse("definition", fs.readFileSync(definitionFile, 'utf8'));
    const spinner = new Spinner(`Fetching state machine ${stateMachine}... %s`);
    spinner.setSpinnerString(30);
    spinner.start();

    const stackResources = await listAllStackResourcesWithPagination(cloudFormation, cmd.stackName || config.stack_name);

    const stateMachineArn = stackResources.find(r => r.LogicalResourceId === stateMachine).PhysicalResourceId;
    const stateMachineRoleName = stackResources.find(r => r.LogicalResourceId === `${stateMachine}Role`).PhysicalResourceId;

    const describedStateMachine = await sfnClient.send(new DescribeStateMachineCommand({ stateMachineArn }));
    const definition = JSON.parse(describedStateMachine.definition);
    findAllDefinitionSubstitutions(definition, definitionObj);

    spinner.stop(true);
    const states = findStates(definition);
    const state = await inputUtil.autocomplete("Select state", states.map(s => { return { name: s.key, value: { name: s.key, state: s.state } } }));

    const input = await getInput(stateMachineArn, state.name, describedStateMachine.type);

    const accountId = (await sts.send(new GetCallerIdentityCommand({}))).Account;
    console.log(`Invoking state ${clc.green(state.name)} with input:\n${clc.green(input)}\n`);

    await testState(sfnClient, state, accountId, stateMachineRoleName, input);
    if (cmd.watch) {
        console.log("Watching for changes in definition file... Press Ctrl+C / Command+. to stop.");

        fs.watchFile(definitionFile, async () => {
            const fileContent = fs.readFileSync(definitionFile, 'utf8');
            try {
                const definitionObj = parser.parse("asl", fileContent);
                const substitutedDefinition = findAllDefinitionSubstitutions(definition, definitionObj);
                const states = findStates(substitutedDefinition);
                const updatedState = states.find(s => s.key === state.name);
                console.log("StateMachine updated. Testing state...");
                await testState(sfnClient, updatedState, accountId, stateMachineRoleName, input);
            } catch (e) {
                console.log("Error parsing definition file. Make sure it's valid JSON.\n", e.message);
            }
        });
    }
}

async function testState(sfnClient, state, accountId, stateMachineRoleName, input) {
    const testResult = await sfnClient.send(new TestStateCommand(
        {
            definition: JSON.stringify(state.state),
            roleArn: `arn:aws:iam::${accountId}:role/${stateMachineRoleName}`,
            input: input
        }
    ));
    delete testResult.$metadata;
    let color = "green";
    if (testResult.error) {
        color = "red";
    }
    for (const key in testResult) {
        let value;
        let jsonPaths;
        try {
            const json = JSON.parse(testResult[key]);
            value = JSON.stringify(json, null, 2);
            if (key === "output") {
                jsonPaths = [...new Set(listJsonPaths(json))];
            }
        }
        catch (e) {
            value = testResult[key];
        }
        let outputValue = value;
        if (value.split('\n').length > 10 || value.length > 1000) {
            outputValue = value.split('\n').slice(0, 10).join('\n') + "\n... (truncated - see output file for full result)";
        }
        console.log(`\n${clc[color](key.charAt(0).toUpperCase() + key.slice(1))}: ${outputValue}`);
        if (key === "output") {
            fs.writeFileSync("./samp-test-state-output.json", value);
            console.log(`\nState output written to ${clc.green("./samp-test-state-output.json")}\n\nAvailable JSON paths on output:\n${clc.blue(jsonPaths.join("\n"))}`);
        }
    }
}

function listJsonPaths(obj, prefix = '$') {
    let paths = [];
    for (const [key, value] of Object.entries(obj)) {
        let path = `${prefix}.${key}`;

        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj === null)
            return [prefix];
        if (value !== null && typeof value === 'object') {
            if (!Array.isArray(value)) {
                paths = paths.concat(listJsonPaths(value, path));
            } else {
                for (let i = 0; i < value.length; i++) {
                    paths = paths.concat(listJsonPaths(value[i], `${path}[${i}]`));
                }
            }
        } else {
            const regex = /\[\d+\]/g;
            path = path.replace(regex, '[*]');
            if (!paths.includes(path))
                paths.push(path);
        }
    }
    return paths;
}

async function getInput(stateMachineArn, state, stateMachineType) {
    let types = [
        "Empty JSON",
        "Manual input",
        "From file"];

    if (stateMachineType === "STANDARD") {
        types.push("From recent execution");
    }

    const configDirExists = fs.existsSync(path.join(os.homedir(), '.samp-cli', 'state-tests'));
    if (!configDirExists) {
        fs.mkdirSync(path.join(os.homedir(), '.samp-cli', 'state-tests'), { recursive: true });
    }

    const fileName = stateMachineArn.replace(/:/g, "-");

    const stateMachineStateFileExists = fs.existsSync(path.join(os.homedir(), '.samp-cli', 'state-tests', fileName));

    if (!stateMachineStateFileExists) {
        fs.writeFileSync(path.join(os.homedir(), '.samp-cli', 'state-tests', fileName), "{}");
    }

    const storedState = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.samp-cli', 'state-tests', fileName), "utf8"));
    if (Object.keys(storedState).length > 0) {
        types = ["Latest input", ...types];
    }

    const type = await inputUtil.list("Select input type", types);

    if (type === "Empty JSON") {
        return "{}";
    }

    if (type === "Manual input") {
        return inputUtil.text("Enter input JSON", "{}");
    }

    if (type === "From file") {
        const file = await inputUtil.file("Select input file", "json");
        return fs.readFileSync(file, "utf8");
    }

    if (type === "Latest input") {
        return JSON.stringify(storedState[state]);
    }

    if (type === "From recent execution") {
        const sfnClient = new SFNClient(clientParams);

        const executions = await sfnClient.send(new ListExecutionsCommand({ stateMachineArn }));
        const execution = await inputUtil.autocomplete("Select execution", executions.executions.map(e => { return { name: `[${e.startDate.toLocaleTimeString()}] ${e.name}`, value: e.executionArn } }));
        const executionHistory = await sfnClient.send(new GetExecutionHistoryCommand({ executionArn: execution }));
        const input = findFirstTaskEnteredEvent(executionHistory, state);
        if (!input) {
            console.log("No input found for state. Did it execute in the chosen execution?");
            process.exit(1);
        }
        return input.stateEnteredEventDetails.input;
    }
}


function findAllDefinitionSubstitutions(deployedDefinition, aslObj, currentPath = '') {
    const result = [];
    const regex = /\${(.+?)}/g;

    function formatKey(key) {
        // Check if the key contains spaces or special characters that need quoting
        return key.match(/\s|\.|\[|\]/) ? `['${key}']` : `.${key}`;
    }

    function traverse(obj, path) {
        if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
            Object.entries(obj).forEach(([key, value]) => {
                // Adjust path format for keys with spaces
                const formattedKey = formatKey(key);
                const newPath = path ? `${path}${formattedKey}` : key;
                traverse(value, newPath);
            });
        } else if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const newPath = `${path}[${index}]`;
                traverse(item, newPath);
            });
        } else if (typeof obj === "string") {
            let match;
            while (match = regex.exec(obj)) {
                // Adjust for the root path not requiring a leading '.'
                const adjustedPath = path.startsWith('.') ? path.substring(1) : path;
                result.push({ match: match[1], path: adjustedPath });
            }
        }
    }

    traverse(aslObj, '');

    for (const sub of result) {
        const value = jp.value(deployedDefinition, `\$.${sub.path}`);
        jp.value(aslObj, sub.path, value);
    }


    return aslObj;
}

function findFirstTaskEnteredEvent(jsonData, state) {
    for (const event of jsonData.events) {
        if (event.type.endsWith("StateEntered") && event.stateEnteredEventDetails.name === state) {
            return event;
        }
    }
    return null; // or any appropriate default value
}


function findStates(aslDefinition) {
    const result = [];

    function traverseStates(states) {
        Object.keys(states).forEach(key => {
            const state = states[key];
            if (state.Type === 'Task' || state.Type === 'Pass' || state.Type === 'Choice') {
                result.push({ key, state });
            }
            if (state.Type === 'Parallel' && state.Branches) {
                state.Branches.forEach(branch => {
                    traverseStates(branch.States);
                });
            }
            if (state.Type === 'Map' && state.ItemProcessor && state.ItemProcessor.States) {
                traverseStates(state.ItemProcessor.States);
            }
        });
    }
    traverseStates(aslDefinition.States);
    return result;
}

function listAllStackResourcesWithPagination(cloudFormation, stackName) {
    const params = {
        StackName: stackName
    };
    const resources = [];
    const listStackResources = async (params) => {
        const response = await cloudFormation.send(new ListStackResourcesCommand(params));
        resources.push(...response.StackResourceSummaries);
        if (response.NextToken) {
            params.NextToken = response.NextToken;
            await listStackResources(params);
        }
    };

    return listStackResources(params).then(() => resources);
}

function findAllStateMachines(templateObj) {
    const stateMachines = Object.keys(templateObj.Resources).filter(r => templateObj.Resources[r].Type === "AWS::Serverless::StateMachine");
    if (stateMachines.length === 0) {
        console.log("No state machines found in template");
        process.exit(0);
    }

    return stateMachines;
}

module.exports = {
    run
}