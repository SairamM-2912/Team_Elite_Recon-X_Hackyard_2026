# Fictional Shop — Backend & Database Setup

This document covers the **shop backend** that lives alongside the RECON-X security proxy.

---

## Architecture

```
Browser
  │
  ├─ http://localhost:8000  ── Python FastAPI (RECON-X proxy + static files)
  │     └─ /shop            ── Serves shop.html (the storefront UI)
  │
  └─ http://localhost:3001  ── Node.js/Express (shop API)
        └─ /api/*           ── Products, auth, orders, contact
              │
              └─ PostgreSQL fictional_shop_db
```

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 18 | Shop backend |
| npm | 9 | Package installation |
| PostgreSQL | 14 | Database server |
| Python 3.10 | — | RECON-X proxy (already set up) |

---

## Step 1 — Install PostgreSQL

Download from https://www.postgresql.org/download/windows/

During setup:
- Set a superuser password for the `postgres` user. **Write it down.**
- Default port: 5432
- Tick "Add to PATH" or note the installation path (e.g. `C:\Program Files\PostgreSQL\16\bin`)

---

## Step 2 — Create the database and schema

Open **pgAdmin** (installed with PostgreSQL) or open a terminal and run:

```powershell
# If psql is in PATH:
psql -U postgres

# Or use the full path:
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

Then in psql:

```sql
CREATE DATABASE fictional_shop_db;
\q
```

Now apply the schema:

```powershell
psql -U postgres -d fictional_shop_db -f "C:\Users\SUVI\OneDrive\Desktop\RECON_X\shop\schema.sql"
```

---

## Step 3 — Configure environment variables

```powershell
cd "C:\Users\SUVI\OneDrive\Desktop\RECON_X\shop"
copy .env.example .env
notepad .env
```

Fill in your real PostgreSQL password:

```
DATABASE_URL=postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5432/fictional_shop_db
SESSION_SECRET=any_long_random_string_here
PORT=3001
FRONTEND_ORIGIN=http://localhost:8000
NODE_ENV=development
```

---

## Step 4 — Install Node dependencies

```powershell
cd "C:\Users\SUVI\OneDrive\Desktop\RECON_X\shop"
npm install
```

---

## Step 5 — Load sample data (optional)

```powershell
psql -U postgres -d fictional_shop_db -f "C:\Users\SUVI\OneDrive\Desktop\RECON_X\shop\seed.sql"
```

### Sample records inserted

| Table | Records |
|---|---|
| users | 10 (1 admin + 9 customers) |
| products | 20 (Electronics, Clothing, Books, Home) |
| orders | 15 (various statuses) |
| order_items | ~25 |
| contact_messages | 10 |

---

## Step 6 — Start both servers

**Terminal 1 — RECON-X proxy (Python):**

```powershell
cd "C:\Users\SUVI\OneDrive\Desktop\RECON_X"
python run.py
```

**Terminal 2 — Shop backend (Node.js):**

```powershell
cd "C:\Users\SUVI\OneDrive\Desktop\RECON_X\shop"
node server.js
```

---

## Step 7 — Open in browser

| URL | What you see |
|---|---|
| http://localhost:8000 | RECON-X security panel (with 🛒 Shop link) |
| http://localhost:8000/shop | Fictional shop storefront |
| http://localhost:3001/api/health | Backend health check |
| http://localhost:3001/api/products | Product listing (JSON) |

---

## Demo login credentials

> ⚠️ **Development only.** These accounts are seeded fictional data. Do not use in production.

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `DemoAdmin2024!` | admin |
| `alice@example.com` | `DemoUser2024!` | customer |
| `bob@example.com` | `DemoUser2024!` | customer |

> Note: The seed.sql uses pre-computed bcrypt hashes. The actual password hashes in the DB correspond to `DemoAdmin2024!` for the admin and `DemoUser2024!` for all customer accounts. **These are fictional accounts — never use in production.**

---

## API Endpoints

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Database connectivity check |

### Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | None | Create account |
| POST | `/api/login` | None | Login (rate limited: 10/15min) |
| POST | `/api/logout` | Session | Destroy session |
| GET | `/api/me` | Session | Current user profile |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | None | List products (filter: `?category=`, `?search=`) |
| GET | `/api/products/:id` | None | Single product |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/orders` | Session | My orders (admin sees all) |
| POST | `/api/orders` | Session | Place order (stock checked + decremented in DB transaction) |
| GET | `/api/orders/:id` | Session | Order detail (owner or admin only) |

### Contact
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/contact` | None | Submit contact message |

---

## Security implemented

- ✅ Passwords hashed with bcrypt (cost 12)
- ✅ Session stored in PostgreSQL, session ID regenerated after login
- ✅ Login rate-limited (10 attempts per 15 minutes per IP)
- ✅ All prices calculated server-side — never trusted from browser
- ✅ Stock decremented atomically in a PostgreSQL transaction
- ✅ User ID and role always read from session — never from request body
- ✅ Parameterised SQL everywhere — no string interpolation
- ✅ CORS restricted to `FRONTEND_ORIGIN`
- ✅ Admin routes reject non-admin sessions with 403
- ✅ Users cannot view or modify other users' orders (403)
- ✅ Input validation with express-validator

---

## Replacing sample data with real data

1. Delete the seed data:
   ```sql
   TRUNCATE contact_messages, order_items, orders, products, users RESTART IDENTITY CASCADE;
   ```
2. Register real user accounts through `/api/register` or pgAdmin.
3. Add real products through the admin API or pgAdmin.
4. Remove or comment out `seed.sql` from your deployment checklist.
5. Set `NODE_ENV=production` and configure HTTPS.
