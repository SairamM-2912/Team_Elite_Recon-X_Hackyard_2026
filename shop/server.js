/**
 * server.js — RECON-X Fictional Shop Backend
 *
 * Stack: Node.js / Express / PostgreSQL (pg)
 *
 * Runs on port 3001 (configurable via PORT env var).
 * The existing RECON-X Python app continues on port 8000 unchanged.
 *
 * Security rules enforced here:
 *  - All prices, totals, and stock deductions are calculated server-side.
 *  - User ID and role are always read from the authenticated session.
 *  - Parameterised queries everywhere (no string interpolation into SQL).
 *  - Passwords hashed with bcrypt (cost 12).
 *  - Sessions backed by PostgreSQL (connect-pg-simple).
 *  - Login rate-limited (10 attempts / 15 min per IP).
 *  - CORS restricted to FRONTEND_ORIGIN.
 *  - Session ID regenerated after successful login.
 */

'use strict';

require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const { Pool }     = require('pg');
const bcrypt       = require('bcryptjs');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');

// ─── Database pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fictional_shop_db',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ─── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8000';
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// ─── Session store (PostgreSQL) ───────────────────────────────────────────────
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Send validation errors as 422 */
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

/** Require an authenticated session */
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

/** Require admin role */
function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// ─── Rate limiter (login endpoint) ────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS server_time');
    res.json({
      status: 'ok',
      database: 'connected',
      server_time: result.rows[0].server_time,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// ─── Auth: Register ───────────────────────────────────────────────────────────
app.post('/api/register',
  body('full_name').trim().isLength({ min: 2, max: 120 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
  body('phone').optional().trim().isLength({ max: 30 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { full_name, email, password, phone } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
      const hash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, $4, 'customer') RETURNING id, full_name, email, role, created_at`,
        [full_name, email, hash, phone || null]
      );
      const user = result.rows[0];
      // Start session immediately after registration
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Session error.' });
        req.session.userId = user.id;
        req.session.role   = user.role;
        res.status(201).json({ user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
      });
    } catch (err) {
      console.error('[POST /api/register]', err.message);
      res.status(500).json({ error: 'Registration failed.' });
    }
  }
);

// ─── Auth: Login ──────────────────────────────────────────────────────────────
app.post('/api/login', loginLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { email, password } = req.body;
    try {
      const result = await pool.query(
        'SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1',
        [email]
      );
      if (result.rows.length === 0) {
        // Constant-time-like delay to prevent user enumeration
        await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      // Regenerate session ID to prevent session fixation
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Session error.' });
        req.session.userId = user.id;
        req.session.role   = user.role;
        res.json({ user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role } });
      });
    } catch (err) {
      console.error('[POST /api/login]', err.message);
      res.status(500).json({ error: 'Login failed.' });
    }
  }
);

// ─── Auth: Logout ─────────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out.' });
  });
});

// ─── Auth: Me ─────────────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// ─── Products: List ───────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, limit = 50, offset = 0 } = req.query;
    let sql    = 'SELECT id, name, description, category, price, stock_quantity, image_url, created_at FROM products WHERE 1=1';
    const args = [];

    if (category) {
      args.push(category);
      sql += ` AND category = $${args.length}`;
    }
    if (search) {
      args.push(`%${search}%`);
      sql += ` AND (name ILIKE $${args.length} OR description ILIKE $${args.length})`;
    }
    args.push(Math.min(parseInt(limit, 10) || 50, 100));
    sql += ` ORDER BY created_at DESC LIMIT $${args.length}`;
    args.push(parseInt(offset, 10) || 0);
    sql += ` OFFSET $${args.length}`;

    const result = await pool.query(sql, args);
    res.json({ products: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[GET /api/products]', err.message);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// ─── Products: Single ─────────────────────────────────────────────────────────
app.get('/api/products/:id',
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await pool.query(
        'SELECT id, name, description, category, price, stock_quantity, image_url, created_at FROM products WHERE id = $1',
        [req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
      res.json({ product: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch product.' });
    }
  }
);

// ─── Products: Create (admin) ─────────────────────────────────────────────────
app.post('/api/products', requireAdmin,
  body('name').trim().isLength({ min: 2, max: 200 }),
  body('category').trim().isLength({ min: 2, max: 80 }),
  body('price').isFloat({ min: 0 }),
  body('stock_quantity').isInt({ min: 0 }),
  body('description').optional().trim(),
  body('image_url').optional().isURL(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { name, description, category, price, stock_quantity, image_url } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO products (name, description, category, price, stock_quantity, image_url)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, description || null, category, parseFloat(price), parseInt(stock_quantity, 10), image_url || null]
      );
      res.status(201).json({ product: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create product.' });
    }
  }
);

// ─── Products: Update (admin) ─────────────────────────────────────────────────
app.put('/api/products/:id', requireAdmin,
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().isLength({ min: 2, max: 200 }),
  body('price').optional().isFloat({ min: 0 }),
  body('stock_quantity').optional().isInt({ min: 0 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { name, description, category, price, stock_quantity, image_url } = req.body;
    try {
      const existing = await pool.query('SELECT id FROM products WHERE id=$1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });

      const fields = [];
      const args   = [];
      if (name           !== undefined) { args.push(name);                        fields.push(`name=$${args.length}`); }
      if (description    !== undefined) { args.push(description);                 fields.push(`description=$${args.length}`); }
      if (category       !== undefined) { args.push(category);                    fields.push(`category=$${args.length}`); }
      if (price          !== undefined) { args.push(parseFloat(price));           fields.push(`price=$${args.length}`); }
      if (stock_quantity !== undefined) { args.push(parseInt(stock_quantity, 10));fields.push(`stock_quantity=$${args.length}`); }
      if (image_url      !== undefined) { args.push(image_url);                   fields.push(`image_url=$${args.length}`); }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

      args.push(req.params.id);
      const result = await pool.query(
        `UPDATE products SET ${fields.join(',')} WHERE id=$${args.length} RETURNING *`,
        args
      );
      res.json({ product: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update product.' });
    }
  }
);

// ─── Products: Delete (admin) ─────────────────────────────────────────────────
app.delete('/api/products/:id', requireAdmin,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
      res.json({ message: 'Product deleted.', id: result.rows[0].id });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete product.' });
    }
  }
);

// ─── Orders: List ─────────────────────────────────────────────────────────────
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    let sql, args;
    if (req.session.role === 'admin') {
      sql  = `SELECT o.*, u.full_name, u.email
              FROM orders o JOIN users u ON u.id=o.user_id
              ORDER BY o.created_at DESC LIMIT 200`;
      args = [];
    } else {
      sql  = `SELECT o.*, u.full_name, u.email
              FROM orders o JOIN users u ON u.id=o.user_id
              WHERE o.user_id=$1 ORDER BY o.created_at DESC`;
      args = [req.session.userId];
    }
    const result = await pool.query(sql, args);
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// ─── Orders: Create ───────────────────────────────────────────────────────────
// Never trust price or total from the browser.
// Calculates totals from DB prices, checks stock, and decrements atomically.
app.post('/api/orders', requireAuth,
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1, max: 999 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { items } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the rows we're about to update
      const productIds = [...new Set(items.map(i => i.product_id))];
      const lockResult = await client.query(
        `SELECT id, price, stock_quantity, name FROM products
         WHERE id = ANY($1::int[]) FOR UPDATE`,
        [productIds]
      );

      if (lockResult.rows.length !== productIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more products not found.' });
      }

      const productMap = {};
      lockResult.rows.forEach(p => { productMap[p.id] = p; });

      let totalAmount = 0;
      const lineItems = [];

      for (const item of items) {
        const product = productMap[item.product_id];
        if (!product) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Product ${item.product_id} not found.` });
        }
        if (product.stock_quantity < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}.`
          });
        }
        const lineTotal = parseFloat(product.price) * item.quantity;
        totalAmount += lineTotal;
        lineItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price: product.price });
      }

      // Insert the order
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'pending') RETURNING *`,
        [req.session.userId, totalAmount.toFixed(2)]
      );
      const order = orderResult.rows[0];

      // Insert order items and decrement stock
      for (const li of lineItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
          [order.id, li.product_id, li.quantity, li.unit_price]
        );
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
          [li.quantity, li.product_id]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ order, items: lineItems });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[POST /api/orders]', err.message);
      res.status(500).json({ error: 'Order creation failed.' });
    } finally {
      client.release();
    }
  }
);

// ─── Orders: Single ───────────────────────────────────────────────────────────
app.get('/api/orders/:id', requireAuth,
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const orderResult = await pool.query(
        'SELECT * FROM orders WHERE id=$1', [req.params.id]
      );
      if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
      const order = orderResult.rows[0];

      // Only owner or admin may view
      if (req.session.role !== 'admin' && order.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      const itemsResult = await pool.query(
        `SELECT oi.*, p.name AS product_name, p.image_url
         FROM order_items oi JOIN products p ON p.id=oi.product_id
         WHERE oi.order_id=$1`,
        [req.params.id]
      );
      res.json({ order, items: itemsResult.rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch order.' });
    }
  }
);

// ─── Contact ──────────────────────────────────────────────────────────────────
app.post('/api/contact',
  body('name').trim().isLength({ min: 2, max: 120 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('subject').optional().trim().isLength({ max: 300 }).escape(),
  body('message').trim().isLength({ min: 5, max: 5000 }).escape(),
  async (req, res) => {
    if (!validate(req, res)) return;
    const { name, email, subject, message } = req.body;
    try {
      await pool.query(
        `INSERT INTO contact_messages (name, email, subject, message) VALUES ($1,$2,$3,$4)`,
        [name, email, subject || null, message]
      );
      res.status(201).json({ message: 'Your message has been received. Thank you!' });
    } catch (err) {
      console.error('[POST /api/contact]', err.message);
      res.status(500).json({ error: 'Failed to save message.' });
    }
  }
);

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n[Shop Backend] Running on http://127.0.0.1:${PORT}`);
  console.log(`[Shop Backend] Accepting requests from: ${FRONTEND_ORIGIN}`);
  console.log(`[Shop Backend] API docs: GET /api/health\n`);
});

module.exports = app; // for testing
