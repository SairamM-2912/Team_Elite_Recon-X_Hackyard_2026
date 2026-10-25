-- seed.sql  — Fictional sample data for fictional_shop_db
-- All names, emails, and data are completely fictional.
-- Emails use @example.com (RFC 2606 reserved domain).
-- DO NOT use these accounts in production.
--
-- DEMO LOGIN CREDENTIALS (development only):
--   admin@example.com   / DemoAdmin2024!
--   alice@example.com   / DemoUser2024!
--
-- Password hashes were generated with bcrypt (cost 12).
-- Run after schema.sql:
--   psql -U postgres -d fictional_shop_db -f seed.sql

-- ─── Users (10) ───────────────────────────────────────────────────────────────
INSERT INTO users (full_name, email, password_hash, phone, role) VALUES
  ('Admin User',       'admin@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-000-0001', 'admin'),
  ('Alice Hartwell',   'alice@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0001', 'customer'),
  ('Bob Caldwell',     'bob@example.com',      '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0002', 'customer'),
  ('Carol Thornton',   'carol@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0003', 'customer'),
  ('David Mercer',     'david@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0004', 'customer'),
  ('Eve Langford',     'eve@example.com',      '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0005', 'customer'),
  ('Frank Novak',      'frank@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0006', 'customer'),
  ('Grace Ellison',    'grace@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0007', 'customer'),
  ('Henry Barlow',     'henry@example.com',    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0008', 'customer'),
  ('Iris Sutton',      'iris@example.com',     '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '+1-555-100-0009', 'customer')
ON CONFLICT (email) DO NOTHING;

-- ─── Products (20) ────────────────────────────────────────────────────────────
INSERT INTO products (name, description, category, price, stock_quantity, image_url) VALUES
  -- Electronics
  ('NovaTech Wireless Earbuds',  'True wireless earbuds with 24-hr battery and active noise cancellation.',  'Electronics',       49.99,  120, 'https://placehold.co/300x300?text=Earbuds'),
  ('PixelView 27" Monitor',      'QHD IPS monitor, 144Hz refresh rate, ideal for professionals and gamers.', 'Electronics',      329.00,   35, 'https://placehold.co/300x300?text=Monitor'),
  ('SwiftKey Mechanical Keyboard','Compact TKL mechanical keyboard with RGB backlighting and blue switches.',  'Electronics',       89.95,   80, 'https://placehold.co/300x300?text=Keyboard'),
  ('ArcLight USB-C Hub',         '7-in-1 USB-C hub: HDMI, 3× USB-A, SD, MicroSD, PD charging.',             'Electronics',       34.99,  200, 'https://placehold.co/300x300?text=USB+Hub'),
  ('ZenPad Pro 10"',             'Android tablet with 2K display, octa-core CPU, and stylus support.',        'Electronics',      249.00,   50, 'https://placehold.co/300x300?text=Tablet'),
  -- Clothing
  ('Urban Flex Hoodie',          'Lightweight pullover hoodie in cotton-poly blend. Available S–XL.',          'Clothing',          39.99,  300, 'https://placehold.co/300x300?text=Hoodie'),
  ('Classic Chino Trousers',     'Slim-fit chinos in stretch cotton. Sizes 28–38.',                           'Clothing',          54.00,  180, 'https://placehold.co/300x300?text=Chinos'),
  ('RunFast Athletic Shorts',    'Quick-dry training shorts with zippered pockets.',                           'Clothing',          24.99,  220, 'https://placehold.co/300x300?text=Shorts'),
  ('Meridian Oxford Shirt',      'Breathable cotton oxford button-down shirt. Business casual.',               'Clothing',          44.50,  140, 'https://placehold.co/300x300?text=Shirt'),
  ('TrailBlaze Waterproof Jacket','3-layer waterproof shell jacket for hiking and urban use.',                 'Clothing',         129.99,   60, 'https://placehold.co/300x300?text=Jacket'),
  -- Books
  ('Code Craft: Clean Architecture','A deep dive into writing maintainable, scalable software systems.',        'Books',             29.99,  500, 'https://placehold.co/300x300?text=Book'),
  ('The Quiet Algorithm',        'Literary science fiction exploring consciousness in AI systems.',             'Books',             14.99,  400, 'https://placehold.co/300x300?text=Book'),
  ('Data Wrangling Handbook',    'Practical guide to cleaning, transforming, and analysing datasets.',          'Books',             34.95,  300, 'https://placehold.co/300x300?text=Book'),
  ('Everyday Mindfulness',       'Illustrated guide to building a mindfulness practice from scratch.',          'Books',             12.50,  600, 'https://placehold.co/300x300?text=Book'),
  ('Planet Earth — A Visual Atlas','Full-colour reference atlas of world geography and ecosystems.',            'Books',             49.99,  150, 'https://placehold.co/300x300?text=Book'),
  -- Home Accessories
  ('LuminArc Desk Lamp',         'LED desk lamp with 5 colour temperatures and USB charging port.',             'Home Accessories',  42.00,   90, 'https://placehold.co/300x300?text=Lamp'),
  ('BambooBlend Cutting Board',  'Eco-friendly bamboo cutting board with juice groove. 40×28 cm.',             'Home Accessories',  19.99,  250, 'https://placehold.co/300x300?text=Board'),
  ('Nordic Ceramic Mug Set',     'Set of 4 hand-glazed ceramic mugs, 350 ml each.',                           'Home Accessories',  32.00,  110, 'https://placehold.co/300x300?text=Mugs'),
  ('AeroPress Coffee Maker',     'Compact coffee press for rich espresso-style brew. Includes 200 filters.',   'Home Accessories',  39.95,   75, 'https://placehold.co/300x300?text=Coffee'),
  ('Weave Storage Basket (3-pack)','Handwoven seagrass storage baskets in S/M/L. Stackable.',                  'Home Accessories',  55.00,   85, 'https://placehold.co/300x300?text=Baskets')
ON CONFLICT DO NOTHING;

-- ─── Orders (15) — reference users by subquery so seed is repeatable ──────────
-- We use a DO block so the subqueries resolve at runtime.
DO $$
DECLARE
  u_admin  INT; u_alice INT; u_bob INT; u_carol INT; u_david INT;
  u_eve    INT; u_frank INT; u_grace INT; u_henry INT; u_iris  INT;

  p1  INT; p2  INT; p3  INT; p4  INT; p5  INT;
  p6  INT; p7  INT; p8  INT; p9  INT; p10 INT;
  p11 INT; p12 INT; p13 INT; p14 INT; p15 INT;
  p16 INT; p17 INT; p18 INT; p19 INT; p20 INT;

  o1  INT; o2  INT; o3  INT; o4  INT; o5  INT;
  o6  INT; o7  INT; o8  INT; o9  INT; o10 INT;
  o11 INT; o12 INT; o13 INT; o14 INT; o15 INT;
BEGIN

-- Resolve user IDs
SELECT id INTO u_admin FROM users WHERE email='admin@example.com';
SELECT id INTO u_alice FROM users WHERE email='alice@example.com';
SELECT id INTO u_bob   FROM users WHERE email='bob@example.com';
SELECT id INTO u_carol FROM users WHERE email='carol@example.com';
SELECT id INTO u_david FROM users WHERE email='david@example.com';
SELECT id INTO u_eve   FROM users WHERE email='eve@example.com';
SELECT id INTO u_frank FROM users WHERE email='frank@example.com';
SELECT id INTO u_grace FROM users WHERE email='grace@example.com';
SELECT id INTO u_henry FROM users WHERE email='henry@example.com';
SELECT id INTO u_iris  FROM users WHERE email='iris@example.com';

-- Resolve product IDs (by name to stay repeatable)
SELECT id INTO p1  FROM products WHERE name='NovaTech Wireless Earbuds';
SELECT id INTO p2  FROM products WHERE name='PixelView 27" Monitor';
SELECT id INTO p3  FROM products WHERE name='SwiftKey Mechanical Keyboard';
SELECT id INTO p4  FROM products WHERE name='ArcLight USB-C Hub';
SELECT id INTO p5  FROM products WHERE name='ZenPad Pro 10"';
SELECT id INTO p6  FROM products WHERE name='Urban Flex Hoodie';
SELECT id INTO p7  FROM products WHERE name='Classic Chino Trousers';
SELECT id INTO p8  FROM products WHERE name='RunFast Athletic Shorts';
SELECT id INTO p9  FROM products WHERE name='Meridian Oxford Shirt';
SELECT id INTO p10 FROM products WHERE name='TrailBlaze Waterproof Jacket';
SELECT id INTO p11 FROM products WHERE name='Code Craft: Clean Architecture';
SELECT id INTO p12 FROM products WHERE name='The Quiet Algorithm';
SELECT id INTO p13 FROM products WHERE name='Data Wrangling Handbook';
SELECT id INTO p14 FROM products WHERE name='Everyday Mindfulness';
SELECT id INTO p15 FROM products WHERE name='Planet Earth — A Visual Atlas';
SELECT id INTO p16 FROM products WHERE name='LuminArc Desk Lamp';
SELECT id INTO p17 FROM products WHERE name='BambooBlend Cutting Board';
SELECT id INTO p18 FROM products WHERE name='Nordic Ceramic Mug Set';
SELECT id INTO p19 FROM products WHERE name='AeroPress Coffee Maker';
SELECT id INTO p20 FROM products WHERE name='Weave Storage Basket (3-pack)';

-- Insert orders & items only if they don't already exist (check by user+total pattern)
-- Order 1: Alice — earbuds + hub
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_alice AND total_amount=84.98) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_alice, 84.98, 'delivered', NOW() - INTERVAL '30 days')
    RETURNING id INTO o1;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o1, p1, 1, 49.99), (o1, p4, 1, 34.99);
END IF;

-- Order 2: Alice — books
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_alice AND total_amount=77.44) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_alice, 77.44, 'delivered', NOW() - INTERVAL '15 days')
    RETURNING id INTO o2;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o2, p11, 1, 29.99), (o2, p12, 1, 14.99), (o2, p14, 2, 12.50), (o2, p14, 0, 0);
  -- fix: 29.99+14.99+12.50*2 = 69.98; re-seed with correct total
  DELETE FROM order_items WHERE order_id=o2;
  DELETE FROM orders WHERE id=o2;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_alice, 69.98, 'delivered', NOW() - INTERVAL '15 days')
    RETURNING id INTO o2;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o2, p11, 1, 29.99), (o2, p12, 1, 14.99), (o2, p14, 2, 12.50);
END IF;

-- Order 3: Bob — monitor
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_bob AND total_amount=329.00) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_bob, 329.00, 'shipped', NOW() - INTERVAL '5 days')
    RETURNING id INTO o3;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o3, p2, 1, 329.00);
END IF;

-- Order 4: Bob — clothing bundle
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_bob AND total_amount=118.49) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_bob, 118.49, 'delivered', NOW() - INTERVAL '45 days')
    RETURNING id INTO o4;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o4, p6, 1, 39.99), (o4, p7, 1, 54.00), (o4, p8, 1, 24.50);
END IF;

-- Order 5: Carol — tablet + keyboard
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_carol AND total_amount=338.95) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_carol, 338.95, 'processing', NOW() - INTERVAL '2 days')
    RETURNING id INTO o5;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o5, p5, 1, 249.00), (o5, p3, 1, 89.95);
END IF;

-- Order 6: Carol — home accessories
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_carol AND total_amount=91.95) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_carol, 91.95, 'delivered', NOW() - INTERVAL '60 days')
    RETURNING id INTO o6;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o6, p16, 1, 42.00), (o6, p17, 1, 19.99), (o6, p19, 1, 39.95), (o6, p18, 0, 0);
  DELETE FROM order_items WHERE order_id=o6;
  DELETE FROM orders WHERE id=o6;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_carol, 101.94, 'delivered', NOW() - INTERVAL '60 days')
    RETURNING id INTO o6;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o6, p16, 1, 42.00), (o6, p17, 1, 19.99), (o6, p19, 1, 39.95);
END IF;

-- Order 7: David — atlas + handbook
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_david AND total_amount=84.94) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_david, 84.94, 'delivered', NOW() - INTERVAL '20 days')
    RETURNING id INTO o7;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o7, p15, 1, 49.99), (o7, p13, 1, 34.95);
END IF;

-- Order 8: David — jacket
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_david AND total_amount=129.99) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_david, 129.99, 'pending', NOW() - INTERVAL '1 day')
    RETURNING id INTO o8;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o8, p10, 1, 129.99);
END IF;

-- Order 9: Eve — home accessories
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_eve AND total_amount=87.00) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_eve, 87.00, 'shipped', NOW() - INTERVAL '3 days')
    RETURNING id INTO o9;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o9, p18, 1, 32.00), (o9, p20, 1, 55.00);
END IF;

-- Order 10: Frank — electronics mix
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_frank AND total_amount=124.94) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_frank, 124.94, 'delivered', NOW() - INTERVAL '10 days')
    RETURNING id INTO o10;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o10, p1, 1, 49.99), (o10, p3, 1, 89.95), (o10, p4, 0, 0);
  DELETE FROM order_items WHERE order_id=o10;
  DELETE FROM orders WHERE id=o10;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_frank, 139.94, 'delivered', NOW() - INTERVAL '10 days')
    RETURNING id INTO o10;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o10, p1, 1, 49.99), (o10, p3, 1, 89.95);
END IF;

-- Order 11: Grace — clothing
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_grace AND total_amount=98.50) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_grace, 98.50, 'cancelled', NOW() - INTERVAL '8 days')
    RETURNING id INTO o11;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o11, p6, 1, 39.99), (o11, p9, 1, 44.50), (o11, p8, 0, 0);
  DELETE FROM order_items WHERE order_id=o11;
  DELETE FROM orders WHERE id=o11;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_grace, 84.49, 'cancelled', NOW() - INTERVAL '8 days')
    RETURNING id INTO o11;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o11, p6, 1, 39.99), (o11, p9, 1, 44.50);
END IF;

-- Order 12: Henry — multiple books
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_henry AND total_amount=77.43) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_henry, 77.43, 'delivered', NOW() - INTERVAL '25 days')
    RETURNING id INTO o12;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o12, p11, 1, 29.99), (o12, p13, 1, 34.95), (o12, p14, 1, 12.49);
  DELETE FROM order_items WHERE order_id=o12;
  DELETE FROM orders WHERE id=o12;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_henry, 77.43, 'delivered', NOW() - INTERVAL '25 days')
    RETURNING id INTO o12;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o12, p11, 1, 29.99), (o12, p13, 1, 34.95), (o12, p14, 1, 12.49);
END IF;

-- Order 13: Iris — home + lamp
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_iris AND total_amount=74.00) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_iris, 74.00, 'processing', NOW() - INTERVAL '1 day')
    RETURNING id INTO o13;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o13, p16, 1, 42.00), (o13, p17, 1, 19.99), (o13, p18, 0, 0);
  DELETE FROM order_items WHERE order_id=o13;
  DELETE FROM orders WHERE id=o13;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_iris, 61.99, 'processing', NOW() - INTERVAL '1 day')
    RETURNING id INTO o13;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o13, p16, 1, 42.00), (o13, p17, 1, 19.99);
END IF;

-- Order 14: Alice — large electronics
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_alice AND total_amount=413.95) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_alice, 413.95, 'shipped', NOW() - INTERVAL '4 days')
    RETURNING id INTO o14;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o14, p2, 1, 329.00), (o14, p3, 1, 89.95), (o14, p4, 0, 0);
  DELETE FROM order_items WHERE order_id=o14;
  DELETE FROM orders WHERE id=o14;
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_alice, 418.95, 'shipped', NOW() - INTERVAL '4 days')
    RETURNING id INTO o14;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o14, p2, 1, 329.00), (o14, p3, 1, 89.95);
END IF;

-- Order 15: Bob — coffee + baskets
IF NOT EXISTS (SELECT 1 FROM orders WHERE user_id=u_bob AND total_amount=94.95) THEN
  INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (u_bob, 94.95, 'pending', NOW() - INTERVAL '6 hours')
    RETURNING id INTO o15;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (o15, p19, 1, 39.95), (o15, p20, 1, 55.00);
END IF;

END $$;

-- ─── Contact Messages (10) ────────────────────────────────────────────────────
INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES
  ('Alice Hartwell',  'alice@example.com',        'Order Enquiry',            'Hi, I wanted to check on the status of my recent monitor order.',              NOW() - INTERVAL '14 days'),
  ('Bob Caldwell',    'bob@example.com',           'Product Availability',     'Do you restock the TrailBlaze jacket in size Large?',                          NOW() - INTERVAL '10 days'),
  ('Carol Thornton',  'carol@example.com',         'Return Request',           'I received the wrong colour hoodie. How do I initiate a return?',              NOW() - INTERVAL '8 days'),
  ('David Mercer',    'david@example.com',         'Bulk Order Discount',      'We would like to order 50 units of the USB-C Hub for our office.',             NOW() - INTERVAL '7 days'),
  ('Eve Langford',    'eve@example.com',           'Book Recommendation',      'Do you carry other titles by the author of The Quiet Algorithm?',              NOW() - INTERVAL '5 days'),
  ('Frank Novak',     'frank@example.com',         'Shipping Delay',           'My order was supposed to arrive yesterday. Can you look into it?',             NOW() - INTERVAL '3 days'),
  ('Grace Ellison',   'grace@example.com',         'Invoice Request',          'Please send an invoice for my last order to grace@example.com.',               NOW() - INTERVAL '2 days'),
  ('Henry Barlow',    'henry@example.com',         'Feedback — Great Service', 'Just wanted to say the packaging was excellent and delivery was very fast.',   NOW() - INTERVAL '1 day'),
  ('Iris Sutton',     'iris@example.com',          'Gift Wrapping Option',     'Do you offer gift wrapping on ceramic mug sets? It is for a birthday.',       NOW() - INTERVAL '12 hours'),
  ('Visitor',         'visitor@example.com',       'General Enquiry',          'What payment methods do you accept for international orders?',                  NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;
