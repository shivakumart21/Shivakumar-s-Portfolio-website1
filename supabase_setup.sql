-- =============================================
-- SUPABASE DATABASE SETUP FOR ART GALLERY
-- NOTE: The website has been configured to use the existing "artwork" table
-- directly. You DO NOT need to run this SQL unless you are starting a fresh project.
-- =============================================

-- Existing "artwork" table structure
CREATE TABLE IF NOT EXISTS artwork (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,          -- Stores: category ||| title ||| description
    image_url TEXT NOT NULL,      -- Public image path
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STORAGE BUCKET SETUP
-- Go to Storage in Supabase and:
-- 1. Create a new bucket called "artworks"
-- 2. Set it to PUBLIC
-- =============================================
