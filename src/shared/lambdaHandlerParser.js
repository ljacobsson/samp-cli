const { paths } = require("jsonpath");
const runtimes = require("./runtimes.json");

function buildFileName(globals, props, language) {
  const runtime = props.Runtime || globals.Function.Runtime;
  const path = `${(props.CodeUri || globals.Function.CodeUri || "").replace(
    /^\W+|\W+$/g,
    ""
  )}/${props.Handler.split(".").slice(0, -1).join(".")}${language.extension}`.trim();
  return path.replace(
    /^\//,
    "");
}

module.exports = {
  buildFileName,
};
