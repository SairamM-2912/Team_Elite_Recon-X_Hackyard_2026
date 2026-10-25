-- ==============================================================================
-- SUPABASE SEED: 03_seed_users_and_orders.sql
-- Fictional Demo Accounts (10 customers) & 15 Orders
--
-- INSTRUCTIONS:
-- In Supabase, accounts must be created in Auth.
-- You can run this script in SQL Editor to populate demo auth accounts
-- with standard encrypted passwords (development only).
-- Default password for all demo accounts: DemoUser2024!
-- ==============================================================================

DO $$
DECLARE
    u_admin UUID := '00000000-0000-0000-0000-000000000001';
    u1  UUID := '00000000-0000-0000-0000-000000000002';
    u2  UUID := '00000000-0000-0000-0000-000000000003';
    u3  UUID := '00000000-0000-0000-0000-000000000004';
    u4  UUID := '00000000-0000-0000-0000-000000000005';
    u5  UUID := '00000000-0000-0000-0000-000000000006';
    u6  UUID := '00000000-0000-0000-0000-000000000007';
    u7  UUID := '00000000-0000-0000-0000-000000000008';
    u8  UUID := '00000000-0000-0000-0000-000000000009';
    u9  UUID := '00000000-0000-0000-0000-000000000010';

    p1 UUID := 'a0000000-0000-0000-0000-000000000001';
    p2 UUID := 'a0000000-0000-0000-0000-000000000002';
    p3 UUID := 'a0000000-0000-0000-0000-000000000003';
    p4 UUID := 'a0000000-0000-0000-0000-000000000004';
    p5 UUID := 'a0000000-0000-0000-0000-000000000005';
    p6 UUID := 'a0000000-0000-0000-0000-000000000006';
    p7 UUID := 'a0000000-0000-0000-0000-000000000007';
    p8 UUID := 'a0000000-0000-0000-0000-000000000008';
    p9 UUID := 'a0000000-0000-0000-0000-000000000009';
    p10 UUID := 'a0000000-0000-0000-0000-000000000010';
    p11 UUID := 'a0000000-0000-0000-0000-000000000011';
    p12 UUID := 'a0000000-0000-0000-0000-000000000012';
    p13 UUID := 'a0000000-0000-0000-0000-000000000013';
    p14 UUID := 'a0000000-0000-0000-0000-000000000014';
    p15 UUID := 'a0000000-0000-0000-0000-000000000015';
    p16 UUID := 'a0000000-0000-0000-0000-000000000016';
    p17 UUID := 'a0000000-0000-0000-0000-000000000017';
    p18 UUID := 'a0000000-0000-0000-0000-000000000018';
    p19 UUID := 'a0000000-0000-0000-0000-000000000019';
    p20 UUID := 'a0000000-0000-0000-0000-000000000020';

    o_id UUID;
BEGIN
    -- 1. Create Auth Users if not existing
    -- Encrypted password hash for 'DemoUser2024!' ($2a$10$..)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES
      (u_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Admin User"}'::jsonb, now(), now()),
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer01@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Alice Hartwell"}'::jsonb, now(), now()),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer02@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Bob Caldwell"}'::jsonb, now(), now()),
      (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer03@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Carol Thornton"}'::jsonb, now(), now()),
      (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer04@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "David Mercer"}'::jsonb, now(), now()),
      (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer05@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Eve Langford"}'::jsonb, now(), now()),
      (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer06@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Frank Novak"}'::jsonb, now(), now()),
      (u7, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer07@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Grace Ellison"}'::jsonb, now(), now()),
      (u8, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer08@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Henry Barlow"}'::jsonb, now(), now()),
      (u9, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer09@example.com', crypt('DemoUser2024!', gen_salt('bf')), now(), '{"full_name": "Iris Sutton"}'::jsonb, now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Update admin profile role
    UPDATE public.user_profiles SET role = 'admin' WHERE id = u_admin;

    -- 2. Insert 15 Fictional Orders with Items
    -- Order 1: Alice (Earbuds + USB-C Hub = 49.99 + 34.99 = 84.98)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u1, 84.98, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p1, 1, 49.99), (o_id, p4, 1, 34.99);

    -- Order 2: Alice (Books: 29.99 + 14.99 + 25.00 = 69.98)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u1, 69.98, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p11, 1, 29.99), (o_id, p12, 1, 14.99), (o_id, p14, 2, 12.50);

    -- Order 3: Bob (Monitor = 329.00)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u2, 329.00, 'shipped') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p2, 1, 329.00);

    -- Order 4: Bob (Clothing = 39.99 + 54.00 = 93.99)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u2, 93.99, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p6, 1, 39.99), (o_id, p7, 1, 54.00);

    -- Order 5: Carol (Tablet + Keyboard = 249.00 + 89.95 = 338.95)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u3, 338.95, 'processing') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p5, 1, 249.00), (o_id, p3, 1, 89.95);

    -- Order 6: Carol (Home = 42.00 + 19.99 = 61.99)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u3, 61.99, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p16, 1, 42.00), (o_id, p17, 1, 19.99);

    -- Order 7: David (Atlas + Handbook = 49.99 + 34.95 = 84.94)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u4, 84.94, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p15, 1, 49.99), (o_id, p13, 1, 34.95);

    -- Order 8: David (Jacket = 129.99)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u4, 129.99, 'pending') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p10, 1, 129.99);

    -- Order 9: Eve (Home = 32.00 + 55.00 = 87.00)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u5, 87.00, 'shipped') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p18, 1, 32.00), (o_id, p20, 1, 55.00);

    -- Order 10: Frank (Earbuds + Keyboard = 49.99 + 89.95 = 139.94)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u6, 139.94, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p1, 1, 49.99), (o_id, p3, 1, 89.95);

    -- Order 11: Grace (Hoodie + Shirt = 39.99 + 44.50 = 84.49)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u7, 84.49, 'cancelled') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p6, 1, 39.99), (o_id, p9, 1, 44.50);

    -- Order 12: Henry (Books = 29.99 + 34.95 = 64.94)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u8, 64.94, 'delivered') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p11, 1, 29.99), (o_id, p13, 1, 34.95);

    -- Order 13: Iris (Lamp + Cutting Board = 42.00 + 19.99 = 61.99)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u9, 61.99, 'processing') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p16, 1, 42.00), (o_id, p17, 1, 19.99);

    -- Order 14: Alice (Monitor + Keyboard = 329.00 + 89.95 = 418.95)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u1, 418.95, 'shipped') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p2, 1, 329.00), (o_id, p3, 1, 89.95);

    -- Order 15: Bob (Coffee Maker + Baskets = 39.95 + 55.00 = 94.95)
    INSERT INTO public.orders (user_id, total_amount, status) VALUES (u2, 94.95, 'pending') RETURNING id INTO o_id;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price) VALUES (o_id, p19, 1, 39.95), (o_id, p20, 1, 55.00);

END $$;
