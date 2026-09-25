"""
Unified Real Estate Accounting App Launcher
Starts FastAPI server on http://localhost:8000 serving both the REST API and the React frontend.
"""
import os
import sys
import webbrowser
import uvicorn

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)
    sys.path.insert(0, current_dir)

    print("=" * 70)
    print(" ?? PropBooks - Real Estate Accounting Web Application")
    print("=" * 70)
    print(" ? Backend API:       http://localhost:8000/api")
    print(" ? Web App UI:        http://localhost:8000")
    print(" ? Interactive Docs:  http://localhost:8000/docs")
    print("=" * 70)
    import threading
    import time

    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://localhost:8000")

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
