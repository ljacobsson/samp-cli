const inquirer = require("inquirer");

async function choices(message, items,type, defaults) {
    return (await inquirer.prompt({
        type: type,
        name: "item",
        choices: items,
        message: message,
        default: defaults
    })).item;
}
async function text(message, defaultValue) {
    return (await inquirer.prompt({
        type: "input",
        name: "text",
        default: defaultValue,
        message: message
    })).text;
}
async function list(message, items) {
    return await choices(message, items, "list");
}

async function checkbox(message, items, defaults) {
    return await choices(message, items, "checkbox", defaults);
}

async function prompt(message) {
    return (await inquirer.prompt({
        type: "confirm",
        name: "choice",
        default: "Yes",
        message: message
    })).choice;
}


module.exports = {
    list,
    checkbox,
    text,
    prompt
}