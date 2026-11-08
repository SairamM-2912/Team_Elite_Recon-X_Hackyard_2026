"""Shared SQLite connection settings for concurrent application access."""

import sqlite3
from os import PathLike


SQLITE_BUSY_TIMEOUT_MS = 30_000


def connect_sqlite(db_path: str | PathLike[str]) -> sqlite3.Connection:
    """Open a SQLite connection with a bounded wait for concurrent writers."""
    conn = sqlite3.connect(db_path, timeout=SQLITE_BUSY_TIMEOUT_MS / 1000)
    conn.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS}")
    return conn
