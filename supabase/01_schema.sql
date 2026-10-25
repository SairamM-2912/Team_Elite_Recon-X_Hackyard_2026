-- ==============================================================================
-- SUPABASE MIGRATION: 01_schema.sql
-- Fictional Shop Database Schema with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension (standard in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Table: user_profiles
-- Linked to Supabase Auth (auth.users) via foreign key
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. Table: products
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. Table: orders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ------------------------------------------------------------------------------
-- 4. Table: order_items
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- ------------------------------------------------------------------------------
-- 5. Table: contact_messages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (char_length(name) >= 2),
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    subject TEXT,
    message TEXT NOT NULL CHECK (char_length(message) >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- AUTOMATED PROFILE CREATION TRIGGER
-- Whenever a user signs up via Supabase Auth, populate user_profiles
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
        NEW.email,
        'customer'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- SECURE SERVERLESS ORDER CREATION (Prevents Client Price/Stock Tampering)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.place_order(items JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_order_id UUID;
    v_total NUMERIC(12, 2) := 0;
    item RECORD;
    v_product RECORD;
BEGIN
    -- Verify authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to place an order.';
    END IF;

    -- Ensure profile exists
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id) THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;

    -- Create order with initial total 0
    INSERT INTO public.orders (user_id, total_amount, status)
    VALUES (v_user_id, 0, 'pending')
    RETURNING id INTO v_order_id;

    -- Process each item from JSON: [{product_id: UUID, quantity: INT}]
    FOR item IN SELECT * FROM jsonb_to_recordset(items) AS x(product_id UUID, quantity INT)
    LOOP
        -- Lock product row
        SELECT * INTO v_product FROM public.products WHERE id = item.product_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found.', item.product_id;
        END IF;

        IF v_product.stock_quantity < item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for "%". Available: %', v_product.name, v_product.stock_quantity;
        END IF;

        -- Insert line item with authoritative database price
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
        VALUES (v_order_id, item.product_id, item.quantity, v_product.price);

        -- Decrement inventory
        UPDATE public.products
        SET stock_quantity = stock_quantity - item.quantity
        WHERE id = item.product_id;

        v_total := v_total + (v_product.price * item.quantity);
    END LOOP;

    -- Update final authoritative total
    UPDATE public.orders SET total_amount = v_total WHERE id = v_order_id;

    RETURN jsonb_build_object('order_id', v_order_id, 'total_amount', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by owner or admin"
    ON public.user_profiles FOR SELECT
    USING (
        auth.uid() = id
        OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can update own profile (excluding role)"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()) -- prevents self-promotion to admin
    );

-- 2. products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
    ON public.products FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Only admins can modify products"
    ON public.products FOR ALL
    TO authenticated
    USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');

-- 3. orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders or admin views all"
    ON public.orders FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can create own orders"
    ON public.orders FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 4. order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (o.user_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin')
        )
    );

-- 5. contact_messages
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact messages"
    ON public.contact_messages FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Only admins can view contact messages"
    ON public.contact_messages FOR SELECT
    TO authenticated
    USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');
