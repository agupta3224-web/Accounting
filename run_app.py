"""
Unified Real Estate Accounting App Launcher
Starts FastAPI server on http://localhost:8000 and opens in a dedicated application window.
"""
import os
import sys
import time
import threading
import subprocess
import webbrowser
import uvicorn

def is_server_ready() -> bool:
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8000/api/system/info", timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False

def open_dedicated_app_window():
    # Wait until server is responding
    for _ in range(25):
        if is_server_ready():
            break
        time.sleep(0.3)
    
    # Attempt to open as a dedicated, standalone application window (no browser tabs/URL bar)
    try:
        subprocess.Popen(["msedge", "--app=http://127.0.0.1:8000", "--new-window"])
        return
    except Exception:
        pass
    try:
        subprocess.Popen(["chrome", "--app=http://127.0.0.1:8000", "--new-window"])
        return
    except Exception:
        pass
    webbrowser.open_new("http://127.0.0.1:8000")

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)
    sys.path.insert(0, current_dir)

    print("=" * 70)
    print(" PropBooks - Real Estate Accounting Desktop Application")
    print("=" * 70)
    print("  Backend API:       http://localhost:8000/api")
    print("  Dedicated Window:  http://localhost:8000")
    print("  Interactive Docs:  http://localhost:8000/docs")
    print("=" * 70)

    threading.Thread(target=open_dedicated_app_window, daemon=True).start()

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
