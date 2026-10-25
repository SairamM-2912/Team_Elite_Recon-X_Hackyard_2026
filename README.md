# RECON-X — Database Security Proxy

RECON-X sits between database clients and protected databases, inspects SQL queries in real time, detects inference attacks, and enforces security policies before any sensitive data is released.

---

## What it does

| Feature | Description |
|---|---|
| SQL analysis | Parses every query before execution |
| Inference detection | Catches differencing attacks, population narrowing, progressive filtering, canary triggers |
| Risk scoring | 0–100 score with a ALLOW / WARN / RESTRICT / BLOCK decision |
| Fail-closed gate | BLOCK = zero database access, enforced on the server |
| Differential privacy | Adds calibrated Laplace noise to restricted aggregates |
| Audit log | SHA-256 chained, tamper-evident event log |
| PostgreSQL integration | Real read-only connection to a local PostgreSQL database |
| Compact panel UI | 375 px developer-tool style interface |

---

## Prerequisites

Before you start, make sure you have:

1. **Python 3.10 or newer** — download from https://www.python.org/downloads/  
   During installation, tick **"Add Python to PATH"**.
2. **PostgreSQL** (for the live database feature) — download from https://www.postgresql.org/download/windows/  
   You only need the PostgreSQL client libraries; a full server is fine too.
3. A command prompt or PowerShell window.

---

## Step-by-step setup (Windows)

### 1 — Open the project folder

```powershell
cd "C:\Users\SUVI\OneDrive\Desktop\RECON_X"
```

### 2 — Install Python dependencies

```powershell
pip install -r requirements.txt
```

This installs FastAPI, uvicorn, psycopg (PostgreSQL driver), python-dotenv, pytest, and supporting libraries.

### 3 — Create your environment file

Copy the example file and fill in your real database password:

```powershell
copy .env.example .env
```

Then open `.env` in Notepad (or any text editor) and change `replace_me` to your actual PostgreSQL password:

```
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=reconx_demo
PGUSER=reconx_reader
PGPASSWORD=your_real_password_here
```

> **Important:** Never commit `.env` to Git. It is already listed in `.gitignore`.

### 4 — Start the RECON-X server

```powershell
python run.py
```

You should see output like:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 5 — Open the panel

Navigate to **http://localhost:8000** in your browser.

You will see the RECON-X compact security panel. The **PostgreSQL** section is at the bottom — click **Test** to verify your database connection.

---

## PostgreSQL database setup

These steps create the read-only user and demo table that RECON-X expects.

Open `psql` (PostgreSQL interactive terminal) as a superuser:

```powershell
psql -U postgres
```

Then run:

```sql
-- Create the demo database
CREATE DATABASE reconx_demo;

-- Connect to it
\c reconx_demo

-- Create the demo table
CREATE TABLE public.demo_records (
    id         SERIAL PRIMARY KEY,
    name       TEXT,
    age        INTEGER,
    city       TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add some sample rows
INSERT INTO public.demo_records (name, age, city)
VALUES
  ('Alice',  32, 'London'),
  ('Bob',    45, 'New York'),
  ('Carol',  28, 'Berlin'),
  ('David',  55, 'Tokyo'),
  ('Eve',    39, 'Sydney');

-- Create the read-only user
CREATE USER reconx_reader WITH PASSWORD 'your_real_password_here';

-- Grant minimum required access
GRANT CONNECT ON DATABASE reconx_demo TO reconx_reader;
GRANT USAGE ON SCHEMA public TO reconx_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reconx_reader;

-- Ensure future tables are also readable
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO reconx_reader;

\q
```

Replace `your_real_password_here` with the same password you put in `.env`.

---

## Running tests

```powershell
python -m pytest tests -v
```

Tests that require a live PostgreSQL connection are automatically **skipped** when `PGPASSWORD` is not set — so the existing 20 security-engine tests always pass.

To run the full test suite including PostgreSQL tests, make sure your `.env` is configured and the server is not running on the same port, then:

```powershell
python -m pytest tests -v
```

### What the tests cover

| Test file | What it tests |
|---|---|
| `tests/test_parser.py` | SQL parsing and normalisation |
| `tests/test_engine.py` | Inference detection rules |
| `tests/test_diff_privacy.py` | Differential privacy noise |
| `tests/test_proxy.py` | Fail-closed proxy gate |
| `tests/test_api.py` | API endpoints end-to-end |
| `tests/test_pg.py` | PostgreSQL integration (skipped if no credentials) |

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/pg/status` | PG configuration (no credentials exposed) |
| POST | `/api/pg/test` | Real SELECT 1 health-check |
| GET | `/api/pg/schema` | Tables and columns in public schema |
| POST | `/api/pg/query` | Safe SELECT with RECON-X enforcement gate |
| POST | `/api/proxy/inspect` | Analyse query (no execution) |
| POST | `/api/proxy/execute` | Analyse + execute on synthetic sector DB |
| GET | `/api/events` | Recent security events |
| GET | `/api/history` | Session query history |
| GET | `/api/audit/verify` | Verify SHA-256 audit chain |

Full interactive API docs: **http://localhost:8000/docs**

---

## Security notes for beginners

- The `.env` file holds your database password. Keep it private. Do not share it.
- RECON-X enforces BLOCK decisions **on the server** — the database is never accessed when a query is blocked.
- `reconx_reader` has SELECT-only access. It cannot write, delete, or alter any data.
- Query results are capped at 50 rows and subject to a 5-second timeout.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `pip install` fails | Make sure Python is in your PATH. Run `python --version` to confirm. |
| Server won't start on port 8000 | Change the port in `run.py`: `uvicorn.run(..., port=8001)` |
| PG Test says "Connection failed" | Check `.env` values, confirm PostgreSQL is running: `pg_isready -U reconx_reader -d reconx_demo` |
| "Only SELECT statements permitted" | Only read-only SELECT queries are allowed through the PG endpoint. |
| Tests show SKIP for PG tests | Normal — set PGPASSWORD in your environment and re-run. |

---

## Project layout

```
RECON_X/
├── app/
│   ├── api/
│   │   ├── routes_pg.py          ← PostgreSQL endpoints
│   │   ├── routes_proxy.py       ← Core proxy endpoints
│   │   └── ...
│   ├── core/
│   │   ├── engine.py             ← Inference detection engine
│   │   ├── proxy.py              ← Fail-closed execution gate
│   │   ├── parser.py             ← SQL parser
│   │   ├── diff_privacy.py       ← Differential privacy
│   │   ├── audit.py              ← SHA-256 audit log
│   │   └── rbac.py               ← Role-based access control
│   ├── db/
│   │   ├── pg_service.py         ← PostgreSQL connection service
│   │   ├── connection.py         ← SQLite connection manager
│   │   └── seed_data.py          ← Synthetic sector databases
│   ├── static/
│   │   ├── index.html            ← Compact security panel
│   │   ├── css/style.css
│   │   └── js/app.js
│   └── main.py                   ← FastAPI application entry point
├── tests/
│   ├── test_pg.py                ← PostgreSQL integration tests
│   └── ...
├── .env.example                  ← Credential template (safe to commit)
├── .env                          ← Your real credentials (NEVER commit)
├── .gitignore
├── requirements.txt
├── run.py
└── README.md
```
