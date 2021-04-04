const inputUtil = require("../../shared/inputUtil");
const jp = require("jsonpath");
const runtimes = require("./runtimes.json");
const { Separator } = require("inquirer");

async function transform(template) {
  const metadata = template.Metadata;
  if (!metadata || !metadata.PatternTransform) {
    return template;
  }
  console.log("Applying transforms...");
  template = await propertyTransforms(template);
  template = await placeholderTransforms(template);
  return template;
}

async function placeholderTransforms(template) {
  const metadata = template.Metadata;

  let templateString = JSON.stringify(template);
  for (const property of metadata.PatternTransform.Placeholders || []) {
    const value = await inputUtil.text(property.Message || 
      `Placeholder value for ${property.Placeholder}:`
    );
    templateString = templateString.replaceAll(property.Placeholder, value);
  }
  return JSON.parse(templateString);
}
async function propertyTransforms(template) {
  const metadata = template.Metadata;
  for (const property of metadata.PatternTransform.Properties || []) {
    if (!jp.query(template, property.JSONPath).length)
        continue
    let defaultValue, value;
    switch (property.InputType) {
      case "number":
        defaultValue = jp.query(template, property.JSONPath);
        value = parseInt(
          await inputUtil.text(
            `${property.Message || "Set value for " + property.JSONPath}:`,
            defaultValue.length ? defaultValue[0] : undefined
          )
        );

        break;
      case "string":
      case "text":
        defaultValue = jp.query(template, property.JSONPath);
        value = await inputUtil.text(
          property.Message,
          defaultValue.length ? defaultValue[0] : undefined
        );
        break;
      case "runtime-select":
        value =
          process.env.SAM_PATTERNS_DEFAULT_RUNTIME ||
          (await inputUtil.list(
            `Select Lambda runtime for ${JSONPathToFrieldlyName(
              property.JSONPath
            )}.`,
            [
              ...runtimes.filter((p) => p.latest),
              new Separator("*** Older versions ***"),
              ...runtimes.filter((p) => !p.latest),
            ]
          ));
        break;
    }
    if (value) jp.value(template, property.JSONPath, value);
  }
  return template;
}

function JSONPathToFrieldlyName(jsonPath) {
  const split = jsonPath.split(".");
  if (split[1] === "Globals") return "Globals";
  else return "function " + split[2];
}

module.exports = {
  transform,
};
