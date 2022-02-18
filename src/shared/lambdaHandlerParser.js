const { paths } = require("jsonpath");
const runtimes = require("./runtimes.json");

function buildFileName(globals, props) {
  const runtime = props.Runtime || globals.Function.Runtime;
  const extension = runtimes.filter((p) => p.name === runtime)[0].extension;
  const path = `${(props.CodeUri || globals.Function.CodeUri || "").replace(
    /^\W+|\W+$/g,
    ""
  )}/${props.Handler.split(".").slice(0, -1).join(".")}${extension}`.trim();
  return path.replace(
    /^\//,
    "");
}

module.exports = {
  buildFileName,
};
