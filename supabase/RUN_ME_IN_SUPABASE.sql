-- ==============================================================================
-- ALL-IN-ONE SUPABASE SCHEMA & SEED SCRIPT
-- Paste this entire script into your Supabase SQL Editor and click RUN.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 2. Table: products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- 3. Table: orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 4. Table: order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- 5. Table: contact_messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (char_length(name) >= 2),
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    subject TEXT,
    message TEXT NOT NULL CHECK (char_length(message) >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Automation trigger for Supabase Auth signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
        NEW.email,
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Secure order placement database function
CREATE OR REPLACE FUNCTION public.place_order(items JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_order_id UUID;
    v_total NUMERIC(12, 2) := 0;
    item RECORD;
    v_product RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- Ensure profile exists
    INSERT INTO public.user_profiles (id, full_name, email, role)
    VALUES (v_user_id, 'Customer', auth.jwt()->>'email', 'customer')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.orders (user_id, total_amount, status)
    VALUES (v_user_id, 0, 'pending')
    RETURNING id INTO v_order_id;

    FOR item IN SELECT * FROM jsonb_to_recordset(items) AS x(product_id UUID, quantity INT)
    LOOP
        SELECT * INTO v_product FROM public.products WHERE id = item.product_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found.', item.product_id;
        END IF;

        IF v_product.stock_quantity < item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for "%". Available: %', v_product.name, v_product.stock_quantity;
        END IF;

        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order_id, item.product_id, item.quantity, v_product.price);

        UPDATE public.products
        SET stock_quantity = stock_quantity - item.quantity
        WHERE id = item.product_id;

        v_total := v_total + (v_product.price * item.quantity);
    END LOOP;

    UPDATE public.orders SET total_amount = v_total WHERE id = v_order_id;
    RETURN jsonb_build_object('order_id', v_order_id, 'total_amount', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
DROP POLICY IF EXISTS "Profiles viewable by owner or admin" ON public.user_profiles;
CREATE POLICY "Profiles viewable by owner or admin"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()));

-- products policies
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products"
    ON public.products FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Admin modify products" ON public.products;
CREATE POLICY "Admin modify products"
    ON public.products FOR ALL
    TO authenticated
    USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

-- orders policies
DROP POLICY IF EXISTS "Users view own orders or admin" ON public.orders;
CREATE POLICY "Users view own orders or admin"
    ON public.orders FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders"
    ON public.orders FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- order_items policies
DROP POLICY IF EXISTS "Users view own items" ON public.order_items;
CREATE POLICY "Users view own items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin')
        )
    );

-- contact_messages policies
DROP POLICY IF EXISTS "Public insert contact" ON public.contact_messages;
CREATE POLICY "Public insert contact"
    ON public.contact_messages FOR INSERT
    TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admin view contact" ON public.contact_messages;
CREATE POLICY "Admin view contact"
    ON public.contact_messages FOR SELECT
    TO authenticated
    USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

-- ------------------------------------------------------------------------------
-- SEED 20 PRODUCTS
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
-- SEED 10 CONTACT MESSAGES
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
