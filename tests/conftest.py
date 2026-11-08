"""Use isolated, seeded SQLite files for tests instead of local user databases."""

import os
import shutil
import tempfile


_TEST_DATA_DIR = tempfile.mkdtemp(prefix="reconx-tests-")
os.environ["RECONX_DATA_DIR"] = _TEST_DATA_DIR
os.environ["RECONX_SEED_DEMO_DATA"] = "true"


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TEST_DATA_DIR, ignore_errors=True)
