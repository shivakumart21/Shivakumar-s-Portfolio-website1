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
-- Run these EXACT commands below in your Supabase SQL Editor
-- to allow the public key to insert artworks and images:
-- =============================================

-- 1. Disable security on your custom artwork table
ALTER TABLE artwork DISABLE ROW LEVEL SECURITY;

-- 2. Create an open security policy for your images bucket
-- (We use policies here because Supabase locks the storage engine core)
CREATE POLICY "Allow all public access to artworks bucket" 
ON storage.objects FOR ALL TO public 
USING (bucket_id = 'artworks') 
WITH CHECK (bucket_id = 'artworks');
-- Go to Storage in Supabase and:
-- 1. Create a new bucket called "artworks"
-- 2. Set it to PUBLIC.
-- =============================================
