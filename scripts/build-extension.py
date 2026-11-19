#!/usr/bin/env python3
"""
Python runner for scripts/build-extension.js.
Invokes Node.js to generate the CRX3 binary extension.
"""

import os
import subprocess
import sys
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent.parent
    script = root / "scripts" / "build-extension.js"
    if not script.is_file():
        print(f"[!] Error: {script} not found.")
        sys.exit(1)

    node_bin = "node"
    # Fallback to standard Windows Node.js path if not in current PATH
    if sys.platform == "win32":
        default_node = Path(r"C:\Program Files\nodejs\node.exe")
        if default_node.is_file():
            node_bin = str(default_node)

    try:
        res = subprocess.run([node_bin, str(script)], check=True)
        sys.exit(res.returncode)
    except FileNotFoundError:
        print("[!] Node.js not found in system PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
