const inquirer = require("inquirer");

async function choices(message, items,type) {
    return (await inquirer.prompt({
        type: type,
        name: "item",
        choices: items,
        message: message
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
async function checkbox(message, items) {
    return await choices(message, items, "checkbox");
}


module.exports = {
    list,
    checkbox,
    text
}