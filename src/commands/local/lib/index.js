export async function connect(config) {
  process.env.SOFT_EXIT = true
  await import(`./connect.js?version=${Number((new Date()))}`);
}

export async function cleanup() {
  await import("./cleanup.js");
}
