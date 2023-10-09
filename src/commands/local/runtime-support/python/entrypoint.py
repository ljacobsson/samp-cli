import importlib.util
import os
import re
import time
import json
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading

def handle_created_file(event):
    if event.is_directory:
        return

    created_file_path = event.src_path

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
        data["obj"]["context"]["get_remaining_time_in_millis"] = lambda: 10000
        context = DictToObject(convert_camel_to_snake(data["obj"]["context"]))
        response = func(data["obj"]["event"], context)
        response_file_path = path.replace("samp-requests", "samp-responses")
        with open(response_file_path, "w") as response_file:
            response_file.write(json.dumps(response)) 
    else:
        print(f"Function '{function_name}' not found in module '{module_name}'")
        
def camel_to_snake(name):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()

def convert_camel_to_snake(data):
    if isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            if isinstance(value, dict) or isinstance(value, list):
                value = convert_camel_to_snake(value)
            new_key = camel_to_snake(key)
            if new_key == "memory_limit_in_m_b":
                new_key = "memory_limit_in_mb"
            new_dict[new_key] = value
        return new_dict
    elif isinstance(data, list):
        new_list = []
        for item in data:
            new_item = convert_camel_to_snake(item)
            new_list.append(new_item)
        return new_list
    else:
        return data

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
        print(f"Local event router running...")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

class DictToObject:
    def __init__(self, dictionary):
        for key, value in dictionary.items():
            if isinstance(value, dict):
                setattr(self, key, DictToObject(value))
            else:
                setattr(self, key, value)

if __name__ == "__main__":
    setup_file_listener()
