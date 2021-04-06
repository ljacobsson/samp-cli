const inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

async function choices(message, items, type, defaults) {
  return (
    await inquirer.prompt({
      type: type,
      name: "item",
      choices: items,
      message: message,
      default: defaults,
      pageSize: 15,
      source: function (answersYet, input) {
        if (!input) {
          return items;
        }
        const split = input.split(" ");
        return items.filter(
          (p) =>
            !p.name ||
            split.filter((f) => p.name.toLowerCase().includes(f.toLowerCase()))
              .length === split.length
        );
      },
    })
  ).item;
}
async function text(message, defaultValue) {
  return (
    await inquirer.prompt({
      type: "input",
      name: "text",
      default: defaultValue,
      message: message,
    })
  ).text;
}
async function list(message, items) {
  return await choices(message, items, "autocomplete");
}
async function list2(message, items) {
  return await choices(message, items, "list");
}

async function checkbox(message, items, defaults) {
  let list = [];
  do {
    list = await choices(message, items, "checkbox", defaults);
  } while (list.length === 0);
  return list;
}

async function prompt(message) {
  return (
    await inquirer.prompt({
      type: "confirm",
      name: "choice",
      default: "Yes",
      message: message,
    })
  ).choice;
}

module.exports = {
  list,
  list2,
  checkbox,
  text,
  prompt,
};
