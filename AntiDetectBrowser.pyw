"""
Anti's Detect Browser - Native Desktop Application Entrypoint.
Double-click to launch the application silently with zero console window.
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import desktop_app

if __name__ == "__main__":
    desktop_app.main()
