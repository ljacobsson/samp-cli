const parser = require("./lambdaHandlerParser");

test("Test handler path builder", async () => {
  const cases = [
    {
      globals: { Function: { Runtime: "nodejs12.x", CodeUri: "src/" } },
      props: { Handler: "app.handler" },
    },
    {
      globals: { Function: { Runtime: "nodejs12.x", CodeUri: "./src" } },
      props: { Handler: "app.handler" },
    },
    {
      globals: {
        Function: { Runtime: "nodejs12.x" },
      },
      props: { Handler: "app.handler", CodeUri: "src/" },
    },
  ];

  for (const testCase of cases) {
    const path = parser.buildFileName(testCase.globals, testCase.props);
    expect(path).toBe("src/app.js");
  }
});
test("Test handler path builder deep path", async () => {
  const cases = [
    {
      globals: { Function: { Runtime: "python3.6", CodeUri: "src/handlers" } },
      props: { Handler: "app.handler" },
    },
    {
      globals: {
        Function: { Runtime: "python3.6", CodeUri: "./src/handlers" },
      },
      props: { Handler: "app.handler" },
    },
    {
      globals: { Function: { Runtime: "python3.6" } },
      props: { Handler: "app.handler", CodeUri: "src/handlers/" },
    },
  ];

  for (const testCase of cases) {
    const path = parser.buildFileName(testCase.globals, testCase.props);
    expect(path).toBe("src/handlers/app.py");
  }
});
test("Test handler path builder deep path 2", async () => {
  const cases = [
    {
      globals: { Function: { Runtime: "python3.6", CodeUri: "." } },
      props: { Handler: "src/handlers/app.handler" },
    },
  ];

  for (const testCase of cases) {
    const path = parser.buildFileName(testCase.globals, testCase.props);
    expect(path).toBe("src/handlers/app.py");
  }
});
