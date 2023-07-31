import fs from 'fs';

export function locateJsHandler(template, obj, baseDir) {
  const globals = template.Globals?.Function || {};
  const handlerFolders = (obj.handler || globals.Handler).split('/');
  const functionHandler = handlerFolders.pop();
  // remove folders if they don't exist on disk
  handlerFolders.forEach((folder, index) => {
    if (!fs.existsSync(`${process.cwd()}/${baseDir}${handlerFolders.slice(0, index + 1).join('/')}`)) {
      handlerFolders.splice(index, 1);
    }
  });
  obj.handler = handlerFolders.join('/');
  const handler = (obj.handler + '/' + functionHandler.split('.')[0]).replace(/\/\//g, '/');
  const handlerMethod = functionHandler.split('.')[1];
  let jsExt = ".js";
  for (const ext of [".js", ".mjs", ".jsx"]) {
    if (fs.existsSync(`${process.cwd()}/${baseDir}${handler}${ext}`)) {
      jsExt = ext;
      break;
    }
  }
  console.log("jsExt", jsExt);
  const module = `file://${`${process.cwd()}/${baseDir}${handler}${jsExt}`.replace(/\/\//g, '/')}`.replace('.samp-out/./', '.samp-out/');
  return { module, handlerMethod, runtime: obj.runtime || globals.Runtime || "nodejs18.x" };
}

export function locateDotnetHandler(template, obj, baseDir) {
  const globals = template.Globals?.Function || {};
  const handlerMethod = (obj.handler || globals.Handler);
  return { handlerMethod, runtime: obj.runtime };
}

export function locateHandler(template, obj, baseDir) {
  if (!obj.runtime || obj.runtime.startsWith("nodejs")) return locateJsHandler(template, obj, baseDir);
  if (obj.runtime.startsWith("dotnet")) return locateDotnetHandler(template, obj, baseDir);
}