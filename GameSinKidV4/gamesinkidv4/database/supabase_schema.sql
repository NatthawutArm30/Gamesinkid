-- ====================================================================
-- GameSinKid PostgreSQL Database Schema for Supabase
-- อิงจาก emptygamesinkid.sql พร้อมฟังก์ชัน Views/Clicks/Favorites
-- ====================================================================

-- 1. ENUMS / CUSTOM TYPES
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('user', 'developer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.game_status AS ENUM ('draft', 'pending_review', 'published', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    avatar VARCHAR(255),
    display_name VARCHAR(255),
    bio TEXT,
    website VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 4. GAMES TABLE
CREATE TABLE IF NOT EXISTS public.games (
    id BIGSERIAL PRIMARY KEY,
    developer_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
    price NUMERIC(10,2) DEFAULT 0 NOT NULL,
    status public.game_status DEFAULT 'published'::public.game_status NOT NULL,
    cover_image TEXT,
    download_url TEXT,
    link TEXT,
    platform TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    views INT DEFAULT 0 NOT NULL,
    clicks INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. GAME IMAGES (Screenshots)
CREATE TABLE IF NOT EXISTS public.game_images (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL
);

-- 6. FAVORITES TABLE (สำหรับ User กดชื่นชอบเกม)
CREATE TABLE IF NOT EXISTS public.favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT favorites_user_game_unique UNIQUE (user_id, game_id)
);

-- 7. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT reviews_user_game_unique UNIQUE (user_id, game_id)
);

-- 8. DOWNLOADS TABLE
CREATE TABLE IF NOT EXISTS public.downloads (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. LIBRARIES TABLE (คลังเกมที่ครอบครอง)
CREATE TABLE IF NOT EXISTS public.libraries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    order_id BIGINT,
    added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT libraries_user_game_unique UNIQUE (user_id, game_id)
);

-- 10. ORDERS & ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    buyer_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    total_amount NUMERIC(10,2) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    price NUMERIC(10,2) NOT NULL,
    platform_fee NUMERIC(10,2) NOT NULL,
    developer_amount NUMERIC(10,2) NOT NULL
);

-- 11. REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status public.report_status DEFAULT 'open'::public.report_status NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. INDEXES
CREATE INDEX IF NOT EXISTS idx_games_developer_id ON public.games(developer_id);
CREATE INDEX IF NOT EXISTS idx_games_category_id ON public.games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_game_id ON public.reviews(game_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_game_id ON public.downloads(game_id);
CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON public.libraries(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 13. SEED INITIAL CATEGORIES
INSERT INTO public.categories (name)
VALUES ('Action'), ('Adventure'), ('RPG'), ('Horror'), ('Other')
ON CONFLICT (name) DO NOTHING;
