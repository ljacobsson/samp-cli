const runtimes = require("./runtimes.json");

function buildFileName(globals, props) {
  const runtime = props.Runtime || globals.Function.Runtime;
  const extension = runtimes.filter((p) => p.name === runtime)[0].extension;

  let path = null;
  
  if(runtime.includes("dotnetcore")){
    const basePath = (props.CodeUri || globals.Function.CodeUri).replace(
      /^\W+|\W+$/g,
      ""
    );
    var handlerParts = props.Handler.split("::");
    var assemblyName = handlerParts[0];
    var namespace = handlerParts[1];
    var namespaceWitoutRoot = namespace.replace(assemblyName, "").substring(1);
    var namespaceAsPath = namespaceWitoutRoot.replace(".", "/");
    
    path = `${basePath}/${namespaceAsPath}${extension}`.trim();
  }
  else{
    path = `${(props.CodeUri || globals.Function.CodeUri).replace(
      /^\W+|\W+$/g,
      ""
    )}/${props.Handler.split(".").slice(0, -1).join(".")}${extension}`.trim();
  }
  
  return path.replace(
    /^\//,
    "");
}

module.exports = {
  buildFileName,
};
