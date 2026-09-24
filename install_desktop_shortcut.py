"""
Installs a shortcut to PropBooks on the Windows Desktop.
"""
import os
import subprocess

current_dir = os.path.dirname(os.path.abspath(__file__))
bat_path = os.path.join(current_dir, "Launch_PropBooks.bat")
desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop")
shortcut_path = os.path.join(desktop_dir, "PropBooks Desktop Pro.lnk")

# PowerShell command to create Windows shortcut
ps_script = f'''
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
$Shortcut.TargetPath = "{bat_path}"
$Shortcut.WorkingDirectory = "{current_dir}"
$Shortcut.Description = "PropBooks Real Estate Accounting Desktop Edition"
$Shortcut.Save()
'''

subprocess.run(["powershell", "-Command", ps_script], check=True)
print(f"? Desktop shortcut created: {shortcut_path}")
