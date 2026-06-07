-- User private files: metadata table + private storage bucket
-- Files are only visible to the owner (RLS on table and storage).

-- Table for file metadata (actual files in Storage bucket)
CREATE TABLE IF NOT EXISTS user_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 104857600),
  mime_type text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_files_user_id_idx ON user_files(user_id);
CREATE INDEX IF NOT EXISTS user_files_created_at_idx ON user_files(created_at DESC);

ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;

-- Only owner can see and manage their files
CREATE POLICY "Users can view own files"
  ON user_files FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
  ON user_files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
  ON user_files FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Private storage bucket (create if not exists). 100 MB enforced in app + user_files.file_size CHECK.
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-files', 'private-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only owner can access files in their folder (path: user_id/...)
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'private-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'private-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete from own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'private-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
