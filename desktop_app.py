"""
PropBooks Desktop Application - Windows Desktop Pro Edition
Wraps the FastAPI accounting server and React UI inside a native Windows desktop GUI window using pywebview or app-mode window.
Automatically creates timestamped safety backups on window close / application exit.
"""
import sys
import os
import time
import threading
import subprocess
import uvicorn

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(CURRENT_DIR)
sys.path.insert(0, CURRENT_DIR)

from backend.company_manager import company_manager

def is_server_ready() -> bool:
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8000/api/system/info", timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False

def start_server():
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="warning")

def on_closed():
    print("[PropBooks Desktop] Window closing. Executing automatic safety backup on exit...")
    try:
        backup = company_manager.auto_backup_on_close()
        if backup:
            print(f"[PropBooks Desktop] Auto-backup saved: {backup['filename']}")
        # Enforce retention policy: strictly keep last 3 backups and delete older ones
        pruned_bkps = company_manager.prune_backups(keep_count=3)
        pruned_comps = company_manager.prune_companies(keep_count=3)
        print(f"[PropBooks Desktop] Backup retention enforced: kept last 3 backups, pruned {len(pruned_bkps)} old backups.")
        if pruned_comps:
            print(f"[PropBooks Desktop] Pruned {len(pruned_comps)} old company files.")
    except Exception as e:
        print(f"[PropBooks Desktop] Error during auto-backup / pruning on exit: {e}")

def launch_dedicated_app_window():
    """Fallback: Launches Microsoft Edge or Chrome in app-window mode (standalone window, no tabs, no address bar)."""
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
    import webbrowser
    webbrowser.open_new("http://127.0.0.1:8000")

def main():
    if not is_server_ready():
        print("[PropBooks Desktop] Starting background accounting engine on http://127.0.0.1:8000 ...")
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        for _ in range(30):
            if is_server_ready():
                break
            time.sleep(0.3)
    else:
        print("[PropBooks Desktop] Accounting engine already active on http://127.0.0.1:8000.")

    print("[PropBooks Desktop] Launching dedicated application window...")
    try:
        import webview
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
    except Exception as e:
        print(f"[PropBooks Desktop] pywebview unavailable ({e}). Opening standalone application window...")
        launch_dedicated_app_window()

if __name__ == "__main__":
    main()
