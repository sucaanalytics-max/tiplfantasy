-- Player photos bucket for one-time headshot imports.
-- Public read, service-role-only write. Admin route /admin/players/sync-images
-- downloads images from Sportmonks (and iplt20.com fallback if used) and stores
-- them here. The DB players.image_url column points at the public URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  524288, -- 512 KB cap; headshots are ~50-100 KB after resize
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: anyone can read.
DO $$ BEGIN
  CREATE POLICY "Player photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Note: the service-role key bypasses RLS so no INSERT/UPDATE/DELETE policy is
-- needed for the sync route. If we ever expose admin upload via a regular user
-- session, gate it on profiles.is_admin.
