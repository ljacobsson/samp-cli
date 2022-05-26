const parser = require("../../shared/parser");
const fs = require("fs");
const inputUtil = require("../../shared/inputUtil");
const cfnSpec = require("../../../resources/cfn-resource-specification.json");
const samSpec = require("../../../resources/sam-resource-specification.json");
const samRefs = require("../../../resources/sam-refs.json");
const cfnRefs = require("@mhlabs/iam-policies-cli/data/cfn-return-values.json")
const clipboard = require("clipboardy");

async function run(cmd) {
  const template = parser.parse("rv", fs.readFileSync(cmd.template));
  const options = Object.keys(template.Resources).map((key) => {
    return {
      name: `${key} [${template.Resources[key].Type}]`,
      value: { name: key, type: template.Resources[key].Type },
    };
  });

  const resource = await inputUtil.autocomplete("Select resource", options);

  const docs = { ...cfnSpec.ResourceTypes, ...samSpec.ResourceTypes }[resource.type];
  if (!docs && !docs.Attributes) {
    console.log(`Can't find return values for ${resource.type}`);
    return;
  }
  const attributes = Object.keys(docs.Attributes);
  const refs = { ...samRefs, ...cfnRefs };
  if (refs[resource.type]) {
    attributes.unshift({ name: `${refs[resource.type].Ref} (!Ref)`, value: { ref: true } });
  }

  const func = await inputUtil.autocomplete("Select attribute", attributes);
  let expression;
  if (parser.format["rv"] === "json") {
    expression = func.ref ? `{ "Ref": "${resource.name}" }` : `{ "Fn::GetAtt": ["${resource.name}", "${func}"] }`;
  } else {
    expression =  func.ref ? `!Ref ${resource.name}` : `!GetAtt ${resource.name}.${func}`;
  }

  if (cmd.clipboard) {
    clipboard.writeSync(expression);
    console.log(`'${expression}' is ready to be pasted`);
  } else {
    console.log(expression);
  }
}

module.exports = {
  run
};