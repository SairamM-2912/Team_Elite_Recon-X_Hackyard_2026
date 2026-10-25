-- schema.sql
-- Creates the fictional_shop_db schema.
-- Run this ONCE after creating the database:
--   psql -U postgres -d fictional_shop_db -f schema.sql

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL       PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    phone         VARCHAR(30),
    role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                               CHECK (role IN ('customer','admin')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id             SERIAL          PRIMARY KEY,
    name           VARCHAR(200)    NOT NULL,
    description    TEXT,
    category       VARCHAR(80)     NOT NULL,
    price          NUMERIC(10,2)   NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER         NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url      TEXT,
    created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- ─── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id           SERIAL          PRIMARY KEY,
    user_id      INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount NUMERIC(12,2)   NOT NULL CHECK (total_amount >= 0),
    status       VARCHAR(30)     NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status);

-- ─── Order Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL          PRIMARY KEY,
    order_id    INTEGER         NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    product_id  INTEGER         NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity    INTEGER         NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10,2)   NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- ─── Contact Messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
    id         SERIAL       PRIMARY KEY,
    name       VARCHAR(120) NOT NULL,
    email      VARCHAR(200) NOT NULL,
    subject    VARCHAR(300),
    message    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
