import fs from "fs";

export async function routeEvent(obj, stack, functionSources) {
  try {
    const event = obj.event;
    const context = obj.context;
    process.env = { ...obj.envVars, LOCAL_DEBUG: true };
    let logicalId;
    try {
      logicalId = stack.StackResourceSummaries.find(resource => resource.PhysicalResourceId === context.functionName).LogicalResourceId;
    } catch (e) {
    }

    if (!logicalId) {
      return { error: "Could not find function in stack", skipResponse: true };
    }

    if (functionSources[logicalId].runtime.startsWith("nodejs")) {
      const modulePath = functionSources[logicalId].module;
      const module = await import(modulePath);
      return await module[functionSources[logicalId].handler](event, context);
    } else {
      // write to disk
      if (!fs.existsSync(".samp-out")) fs.mkdirSync(".samp-out");
      if (!fs.existsSync(".samp-out/samp-requests")) fs.mkdirSync(".samp-out/samp-requests");
      if (!fs.existsSync(".samp-out/samp-responses")) fs.mkdirSync(".samp-out/samp-responses");
      fs.writeFileSync(".samp-out/samp-requests/" + obj.context.awsRequestId, JSON.stringify({ func: functionSources[logicalId].handler, module: functionSources[logicalId].module, obj }, null, 2));
      // await file to be written to .samp-out/responses
        
      return await new Promise((resolve, reject) => {
        const filePath = `.samp-out/samp-responses/${context.awsRequestId}`;

        const watcher = fs.watch(".samp-out/samp-responses", (eventType, filename) => {
          if (filename === context.awsRequestId) {
            watcher.close(); // Close the watcher to stop monitoring changes
            fs.readFile(filePath, "utf-8", (err, data) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            });
          }
        });
        // setTimeout(() => {
        //   watcher.close();
        //   resolve("Timeout");
        // }, 10000);
      });
    }
  } catch (error) {
    console.log(error);
    return { error: error.message };
  }
}
if (process.argv.length > 3) {
  const obj = JSON.parse(process.argv[2]);
  const stack = JSON.parse(process.argv[3]);
  const functionSources = JSON.parse(process.argv[4]);
  routeEvent(obj, stack, functionSources).then((result) => {
    if (!result?.skipResponse) {
      const response = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      process.send(response || "");
    }
    process.exit(0);
  }
  );
}

