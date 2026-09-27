-- ============================================================
-- GameSinKid: Migration Script to Fix Database Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. ADD MISSING COLUMNS TO games TABLE
-- Add 'views' column
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS views INT DEFAULT 0 NOT NULL;

-- Add 'clicks' column
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0 NOT NULL;

-- Add 'link' column
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS link TEXT;

-- Add 'updated_at' column
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- 2. FIX games.developer_id FOREIGN KEY
-- Currently references developer_profiles(id), needs to reference users(id)

-- Drop the existing foreign key constraint
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_developer_id_fkey;

-- Add new foreign key referencing users(id)
ALTER TABLE public.games ADD CONSTRAINT games_developer_id_fkey
    FOREIGN KEY (developer_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. CREATE MISSING favorites TABLE
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT favorites_pkey PRIMARY KEY (id),
    CONSTRAINT favorites_user_game_unique UNIQUE (user_id, game_id)
);

-- 4. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_games_developer_id ON public.games(developer_id);
CREATE INDEX IF NOT EXISTS idx_games_category_id ON public.games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_game_id ON public.favorites(game_id);
CREATE INDEX IF NOT EXISTS idx_reviews_game_id ON public.reviews(game_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_game_id ON public.downloads(game_id);
CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON public.libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);

-- 5. SEED CATEGORIES (if empty)
INSERT INTO public.categories (name)
VALUES ('Action'), ('Adventure'), ('RPG'), ('Horror'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- 6. ENABLE RLS + ADD POLICIES FOR SERVICE ROLE ACCESS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Full access policies (service_role bypasses RLS anyway, 
-- but these ensure anon key works for reads if needed)
DROP POLICY IF EXISTS "Allow all on users" ON public.users;
CREATE POLICY "Allow all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on games" ON public.games;
CREATE POLICY "Allow all on games" ON public.games FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on categories" ON public.categories;
CREATE POLICY "Allow all on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on favorites" ON public.favorites;
CREATE POLICY "Allow all on favorites" ON public.favorites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on reviews" ON public.reviews;
CREATE POLICY "Allow all on reviews" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on downloads" ON public.downloads;
CREATE POLICY "Allow all on downloads" ON public.downloads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on libraries" ON public.libraries;
CREATE POLICY "Allow all on libraries" ON public.libraries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on order_items" ON public.order_items;
CREATE POLICY "Allow all on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on reports" ON public.reports;
CREATE POLICY "Allow all on reports" ON public.reports FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! Your database now matches app.js
-- ============================================================
