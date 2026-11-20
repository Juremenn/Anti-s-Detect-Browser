"""
oauth_config.py - Official application Google OAuth 2.0 Desktop client credentials.

Release builds (`scripts/build-release.py`) may inject values from `.env` or environment
variables into this module at package time so end users get zero-config 1-click Google
Sign-In and Drive `appDataFolder` sync out of the box.
"""

import os

OFFICIAL_GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "PASTE_YOUR_CLIENT_ID_HERE")
OFFICIAL_GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "PASTE_YOUR_CLIENT_SECRET_HERE")
