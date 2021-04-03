const inputUtil = require("../../shared/inputUtil");
const jp = require("jsonpath");

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
    const value = await inputUtil.text(
      `Placeholder value for ${property.Placeholder}:`
    );
    templateString = templateString.replaceAll(property.Placeholder, value);
  }
  return JSON.parse(templateString);
}
async function propertyTransforms(template) {
  const metadata = template.Metadata;
  for (const property of metadata.PatternTransform.Properties || []) {
    let defaultValue, value;
    switch (property.InputType) {
      case "number":
        defaultValue = jp.query(template, property.JSONPath);
        console.log("Set value for " + property.JSONPath);
        value = parseInt(
          await inputUtil.text(
            `${property.Message}:`,
            defaultValue.length ? defaultValue[0] : undefined
          )
        );

        break;
      case "text":
        defaultValue = jp.query(template, property.JSONPath);
        value = await inputUtil.text(
          property.Message,
          defaultValue.length ? defaultValue[0] : undefined
        );
        break;
      case "runtime-select":
        value = await inputUtil.list(
          "Select Lambda runtime",
          [
            "nodejs10.x",
            "nodejs12.x",
            "nodejs14.x",
            "python3.8",
            "python3.7",
            "python3.6",
            "python2.7",
            "ruby2.7",
            "ruby2.5",
            "java11",
            "java8.al2",
            "java8",
            "go1.x",
            "dotnetcore3.1",
            "dotnetcore2.1",
          ].sort()
        );
        break;
    }
    jp.value(template, property.JSONPath, value);
  }
  return template;
}

module.exports = {
  transform,
};
