const inquirer = require("inquirer");
const inquirerFileTreeSelection = require("inquirer-file-tree-selection-prompt");
const TreePrompt = require('inquirer-tree-prompt');
const fs = require("fs");
inquirer.registerPrompt("file-tree-selection", inquirerFileTreeSelection);
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

inquirer.registerPrompt('tree', TreePrompt);

async function tree(message, items) {
  return (
    await inquirer.prompt({
      type: "tree",
      name: "item",
      tree: items,
      message: message,
    })
  ).item;
}


async function choices(message, items, type, defaults, pageSize = 5) {
  return (
    await inquirer.prompt({
      type: type,
      name: "item",
      choices: items,
      message: message,
      default: defaults,
      pageSize: pageSize,

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

async function files(message) {
  return (
    await inquirer.prompt({
      type: "file-tree-selection",
      name: "files",
      message: message,
      multiple: true,
    })
  ).files;
}

async function file(message, filter) {
  let result;
  do {

    result = (await inquirer.prompt({
      type: "file-tree-selection",
      name: "file",
      message: message,
      multiple: false,
      onlyShowValid: true,
      validate: function (answer) {
        if (fs.lstatSync(answer).isDirectory()) {
          return true;
        }
        return answer.endsWith(filter);
      }
    })
    ).file;
  } while (fs.lstatSync(result).isDirectory());
  return result;
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
async function autocomplete(message, items) {
  return await choices(message, items, "autocomplete", null, 7);
}

async function list(message, items) {
  return await choices(message, items, "list", null);
}

async function checkbox(message, items, defaults) {
  let list = [];
  do {
    list = await choices(message, items, "checkbox", defaults);
  } while (list.length === 0);
  return list;
}

async function prompt(message, defaultValue) {
  return (
    await inquirer.prompt({
      type: "confirm",
      name: "choice",
      default: defaultValue || "Yes",
      message: message,
    })
  ).choice;
}

module.exports = {
  autocomplete,
  list,
  checkbox,
  text,
  prompt,
  files,
  file,
  tree
};
