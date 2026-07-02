-- =============================================
-- SUPABASE DATABASE SETUP FOR ART GALLERY
-- =============================================

-- Existing "artwork" table structure
CREATE TABLE IF NOT EXISTS artwork (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,          
    image_url TEXT NOT NULL,      
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 🚨 CRITICAL FIX FOR "ROW LEVEL SECURITY" ERROR 🚨
-- Run ALL THREE of these EXACT commands below in your Supabase SQL Editor
-- to allow the public key to insert artworks and images:
-- =============================================

ALTER TABLE artwork DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- =============================================
-- STORAGE BUCKET SETUP
-- Go to Storage in Supabase and:
-- 1. Create a new bucket called "artworks"
-- 2. Set it to PUBLIC.
-- =============================================
