import importlib.util
import os
import time
import json
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading

def handle_created_file(event):
    if event.is_directory:
        return

    created_file_path = event.src_path
    print(f"New file created: {created_file_path}")

    try:
        with open(created_file_path, 'r') as file:
            content = file.read()
            json_data = json.loads(content)
            my_thread = threading.Thread(target=run_function_from_module, args=(json_data, created_file_path))
            my_thread.start()
            my_thread.join()
    except Exception as e:
        print(f"Error reading or deserializing JSON: {e}")

def run_function_from_module(data, path):
    module_path = data["module"]
    function_name = data["func"]
    vars = data["obj"]["envVars"]
    for var_name, var_value in vars.items():
      os.environ[var_name] = var_value

    if module_path.startswith("file://"):
        module_path = module_path[len("file://"):]

    module_name = module_path.replace("/", ".").replace(".py", "")
    module_spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)

    if hasattr(module, function_name):
        func = getattr(module, function_name)
        response = func(data["obj"]["event"], data["obj"]["context"])
        response_file_path = path.replace("samp-requests", "samp-responses")
        with open(response_file_path, "w") as response_file:
            response_file.write(json.dumps(response)) 
    else:
        print(f"Function '{function_name}' not found in module '{module_name}'")

class RequestFolderHandler(FileSystemEventHandler):
    def on_created(self, event):
        handle_created_file(event)

def setup_file_listener():
    folder_to_watch = "samp-requests"
    event_handler = RequestFolderHandler()
    observer = Observer()
    observer.schedule(event_handler, folder_to_watch)
    observer.start()

    try:
        print(f"Watching for created files in '{folder_to_watch}'...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    setup_file_listener()
