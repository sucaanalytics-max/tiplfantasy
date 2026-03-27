-- Add image_url column to players table for CricAPI player photos
ALTER TABLE players ADD COLUMN IF NOT EXISTS image_url TEXT;
