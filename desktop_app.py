"""
PropBooks Desktop Application - Windows Desktop Pro Edition
Wraps the FastAPI accounting server and React UI inside a native Windows desktop GUI window using pywebview.
Automatically creates timestamped safety backups on window close / application exit.
"""
import sys
import os
import time
import threading
import uvicorn
import webview

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(CURRENT_DIR)
sys.path.insert(0, CURRENT_DIR)

from backend.company_manager import company_manager

def start_server():
    print("[PropBooks Desktop] Starting background accounting engine on http://127.0.0.1:8000 ...")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="warning")

def on_closed():
    print("[PropBooks Desktop] Window closing. Executing automatic safety backup on exit...")
    try:
        backup = company_manager.auto_backup_on_close()
        if backup:
            print(f"[PropBooks Desktop] Auto-backup saved: {backup['filename']}")
    except Exception as e:
        print(f"[PropBooks Desktop] Error during auto-backup: {e}")

def main():
    # Start backend server in daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait briefly for server startup
    time.sleep(1.0)

    print("[PropBooks Desktop] Launching native Windows desktop window...")
    window = webview.create_window(
        title="PropBooks - Real Estate Accounting & Statement Intelligence (Desktop Pro)",
        url="http://127.0.0.1:8000",
        width=1400,
        height=900,
        min_size=(1024, 700),
        text_select=True,
        zoomable=True
    )
    window.events.closed += on_closed

    webview.start(debug=False)

if __name__ == "__main__":
    main()
