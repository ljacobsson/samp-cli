const yamlCfn = require("yaml-cfn");
let format = {};
function parse(identifier, str) {
  try {
    const parsed = JSON.parse(str);
    format[identifier] = "json";
    return parsed;
  } catch {
    const parsed = yamlCfn.yamlParse(str);
    format[identifier] = "yaml";
    return parsed;
  }
}
function stringify(identifier, obj) {
  if (format[identifier] === "json") return JSON.stringify(obj, null, 2);
  if (format[identifier] === "yaml") return yamlCfn.yamlDump(obj).replace(/!<(.+?)>/g, "$1");
}

module.exports = {
  parse,
  stringify
};
