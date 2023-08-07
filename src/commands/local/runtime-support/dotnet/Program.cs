using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal class Program
{
  private static void Main(string[] args)
  {
    const string basePath = "";
    static void Main(string[] args)
    {

      string folderPath = $"{basePath}requests";
      // create folder if it doesn't exist
      if (!Directory.Exists(folderPath))
      {
        Directory.CreateDirectory(folderPath);
      }
      FileSystemWatcher watcher = new FileSystemWatcher(folderPath);
      // Watch for new files
      watcher.Created += OnFileCreated;
      watcher.EnableRaisingEvents = true;
      Console.WriteLine("File watcher is running. Press any key to stop.");
      Thread.Sleep(Timeout.Infinite);
    }

    static void OnFileCreated(object sender, FileSystemEventArgs e)
    {
      // Start a new thread with the specified environment variables
      Thread thread = new Thread(InvokeFunctionThread);
      thread.Start(e);

      // Wait for the thread to complete
      thread.Join();
    }

    static void InvokeFunctionThread(object? data)
    {
      var e = (FileSystemEventArgs?)data;
      Console.WriteLine($"New file created: {e?.Name} in {e?.FullPath}");
      string[]? split = null;
      dynamic? request = null;

      for (int i = 0; i < 10; i++)
      {
        try
        {
          string json = File.ReadAllText(e?.FullPath ?? "");
          request = JsonConvert.DeserializeObject<dynamic>(json);
          split = request?.func.ToString().Split("::");
        }
        catch (Exception)
        {
          Thread.Sleep(200);
          continue;
        }
      }
      if (request == null || split == null)
      {
        Console.WriteLine("Error: Could not read event.");
        return;
      }
      try
      {
        var className = split?[1];
        var method = split?[2];
        var assembly = Assembly.LoadFrom($"{basePath}bin/Debug/net6.0/{split?[0]}.dll");
        var classType = assembly.GetType(className ?? "");
        var context = new LambdaContext();

        if (classType == null || method == null)
        {
          Console.WriteLine("Class or method not found.");
          return;
        }

        foreach (JProperty prop in request?.obj["envVars"].Properties() ?? Enumerable.Empty<JProperty>())
        {
          Environment.SetEnvironmentVariable(prop.Name, prop.Value.ToString());
        }

        var instance = Activator.CreateInstance(classType);
        var methodInfo = classType.GetMethod(method);
        var parameters = methodInfo?.GetParameters();
        var parameterList = new List<object>();

        // The method will have 0, 1 or 2 parameters. The first parameter is the payload, the second is the ILambdaContext
        if (parameters?.Length > 0)
        {
          // There's a payload
          var type = parameters[0].ParameterType;
          var p = JsonConvert.DeserializeObject(request?.obj["event"].ToString(), type);
          parameterList.Add(p);
        }
        if (parameters?.Length > 1)
        {
          // There's an ILambdaContext
          var type = parameters[1].ParameterType;
          var p = JsonConvert.DeserializeObject(request?.obj["context"].ToString(), typeof(LambdaContext));
          parameterList.Add(p);
        }

        if (methodInfo == null)
        {
          Console.WriteLine("Method not found.");
          return;
        }
        var response = methodInfo.Invoke(instance, parameterList.ToArray());
        var responsesDir = e?.FullPath.Replace("requests", "responses");

        if (responsesDir == null) {
          Console.WriteLine("Error: Could not find responses directory.");
          return;
        }

        if (response is Task)
        {
          var task = response as Task;
          task?.Wait();
          var result = task?.GetType()?.GetProperty("Result")?.GetValue(task);

          if (result is string)
          {
            File.WriteAllText(responsesDir, result.ToString());
            return;
          }
          else
          {
            File.WriteAllText(responsesDir, JsonConvert.SerializeObject(result));
          }

        }
        else if (response is string)
        {
          File.WriteAllText(responsesDir, response.ToString());
          return;
        }
        else
        {
          File.WriteAllText(responsesDir, JsonConvert.SerializeObject(response));
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine("Error: " + ex.Message);
      }
    }



    Main(args);
  }
}