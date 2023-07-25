export async function routeEvent(obj, stack, functionSources) {
  try {
    const event = obj.event;
    const context = obj.context;
    process.env = { ...obj.envVars, LOCAL_DEBUG: true };

    const logicalId = stack.StackResourceSummaries.find(resource => resource.PhysicalResourceId === context.functionName).LogicalResourceId;
    const modulePath = functionSources[logicalId].module;
    const module = await import(modulePath);
    return await module[functionSources[logicalId].handler](event, context);
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
    const response = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    process.send(response || "");
    process.exit(0);
  }
  );
}