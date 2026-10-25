"""Vercel Serverless Function entry point for RECON-X."""
import os
import sys

# Add parent directory to path so imports like `from app...` work seamlessly
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.main import app

# Export app for Vercel Python runtime
app = app
