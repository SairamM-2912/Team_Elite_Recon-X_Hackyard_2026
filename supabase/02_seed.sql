-- ==============================================================================
-- SUPABASE SEED: 02_seed.sql
-- Fictional Demo Data for products & contact messages
-- Note: User profiles are linked to auth.users.
-- Run in Supabase SQL Editor after 01_schema.sql.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Insert 20 Fictional Products
-- ------------------------------------------------------------------------------
INSERT INTO public.products (id, name, description, category, price, stock_quantity, image_url) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'NovaTech Wireless Earbuds', 'True wireless earbuds with 24-hr battery and active noise cancellation.', 'Electronics', 49.99, 120, 'https://placehold.co/300x300?text=Earbuds'),
  ('a0000000-0000-0000-0000-000000000002', 'PixelView 27" Monitor', 'QHD IPS monitor, 144Hz refresh rate, ideal for professionals and gamers.', 'Electronics', 329.00, 35, 'https://placehold.co/300x300?text=Monitor'),
  ('a0000000-0000-0000-0000-000000000003', 'SwiftKey Mechanical Keyboard', 'Compact TKL mechanical keyboard with RGB backlighting and blue switches.', 'Electronics', 89.95, 80, 'https://placehold.co/300x300?text=Keyboard'),
  ('a0000000-0000-0000-0000-000000000004', 'ArcLight USB-C Hub', '7-in-1 USB-C hub: HDMI, 3x USB-A, SD, MicroSD, PD charging.', 'Electronics', 34.99, 200, 'https://placehold.co/300x300?text=USB+Hub'),
  ('a0000000-0000-0000-0000-000000000005', 'ZenPad Pro 10"', 'Android tablet with 2K display, octa-core CPU, and stylus support.', 'Electronics', 249.00, 50, 'https://placehold.co/300x300?text=Tablet'),

  ('a0000000-0000-0000-0000-000000000006', 'Urban Flex Hoodie', 'Lightweight pullover hoodie in cotton-poly blend. Available S-XL.', 'Clothing', 39.99, 300, 'https://placehold.co/300x300?text=Hoodie'),
  ('a0000000-0000-0000-0000-000000000007', 'Classic Chino Trousers', 'Slim-fit chinos in stretch cotton. Sizes 28-38.', 'Clothing', 54.00, 180, 'https://placehold.co/300x300?text=Chinos'),
  ('a0000000-0000-0000-0000-000000000008', 'RunFast Athletic Shorts', 'Quick-dry training shorts with zippered pockets.', 'Clothing', 24.99, 220, 'https://placehold.co/300x300?text=Shorts'),
  ('a0000000-0000-0000-0000-000000000009', 'Meridian Oxford Shirt', 'Breathable cotton oxford button-down shirt. Business casual.', 'Clothing', 44.50, 140, 'https://placehold.co/300x300?text=Shirt'),
  ('a0000000-0000-0000-0000-000000000010', 'TrailBlaze Waterproof Jacket', '3-layer waterproof shell jacket for hiking and urban use.', 'Clothing', 129.99, 60, 'https://placehold.co/300x300?text=Jacket'),

  ('a0000000-0000-0000-0000-000000000011', 'Code Craft: Clean Architecture', 'A deep dive into writing maintainable, scalable software systems.', 'Books', 29.99, 500, 'https://placehold.co/300x300?text=Book'),
  ('a0000000-0000-0000-0000-000000000012', 'The Quiet Algorithm', 'Literary science fiction exploring consciousness in AI systems.', 'Books', 14.99, 400, 'https://placehold.co/300x300?text=Book'),
  ('a0000000-0000-0000-0000-000000000013', 'Data Wrangling Handbook', 'Practical guide to cleaning, transforming, and analysing datasets.', 'Books', 34.95, 300, 'https://placehold.co/300x300?text=Book'),
  ('a0000000-0000-0000-0000-000000000014', 'Everyday Mindfulness', 'Illustrated guide to building a mindfulness practice from scratch.', 'Books', 12.50, 600, 'https://placehold.co/300x300?text=Book'),
  ('a0000000-0000-0000-0000-000000000015', 'Planet Earth — A Visual Atlas', 'Full-colour reference atlas of world geography and ecosystems.', 'Books', 49.99, 150, 'https://placehold.co/300x300?text=Book'),

  ('a0000000-0000-0000-0000-000000000016', 'LuminArc Desk Lamp', 'LED desk lamp with 5 colour temperatures and USB charging port.', 'Home Accessories', 42.00, 90, 'https://placehold.co/300x300?text=Lamp'),
  ('a0000000-0000-0000-0000-000000000017', 'BambooBlend Cutting Board', 'Eco-friendly bamboo cutting board with juice groove. 40x28 cm.', 'Home Accessories', 19.99, 250, 'https://placehold.co/300x300?text=Board'),
  ('a0000000-0000-0000-0000-000000000018', 'Nordic Ceramic Mug Set', 'Set of 4 hand-glazed ceramic mugs, 350 ml each.', 'Home Accessories', 32.00, 110, 'https://placehold.co/300x300?text=Mugs'),
  ('a0000000-0000-0000-0000-000000000019', 'AeroPress Coffee Maker', 'Compact coffee press for rich espresso-style brew. Includes 200 filters.', 'Home Accessories', 39.95, 75, 'https://placehold.co/300x300?text=Coffee'),
  ('a0000000-0000-0000-0000-000000000020', 'Weave Storage Basket (3-pack)', 'Handwoven seagrass storage baskets in S/M/L. Stackable.', 'Home Accessories', 55.00, 85, 'https://placehold.co/300x300?text=Baskets')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Insert 10 Fictional Contact Messages
-- ------------------------------------------------------------------------------
INSERT INTO public.contact_messages (name, email, subject, message) VALUES
  ('Alice Hartwell',  'customer01@example.com', 'Order Enquiry', 'Hi, I wanted to check on the status of my recent order.'),
  ('Bob Caldwell',    'customer02@example.com', 'Product Availability', 'Do you restock the TrailBlaze jacket in size Large?'),
  ('Carol Thornton',  'customer03@example.com', 'Return Request', 'I received the wrong colour hoodie. How do I initiate a return?'),
  ('David Mercer',    'customer04@example.com', 'Bulk Order Discount', 'We would like to order 50 units of the USB-C Hub for our office.'),
  ('Eve Langford',    'customer05@example.com', 'Book Recommendation', 'Do you carry other titles by the author of The Quiet Algorithm?'),
  ('Frank Novak',     'customer06@example.com', 'Shipping Delay', 'My order was supposed to arrive yesterday. Can you look into it?'),
  ('Grace Ellison',   'customer07@example.com', 'Invoice Request', 'Please send an invoice for my last order to customer07@example.com.'),
  ('Henry Barlow',    'customer08@example.com', 'Feedback — Great Service', 'Just wanted to say the packaging was excellent and delivery was very fast.'),
  ('Iris Sutton',     'customer09@example.com', 'Gift Wrapping Option', 'Do you offer gift wrapping on ceramic mug sets? It is for a birthday.'),
  ('Visitor Demo',    'customer10@example.com', 'General Enquiry', 'What payment methods do you accept for international deliveries?');
