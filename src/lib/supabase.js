import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Имя bucket в Storage. В дашборде: Storage → ваш bucket → id должен совпадать.
export const STORAGE_BUCKET_FILES =
  import.meta.env.VITE_STORAGE_BUCKET ?? 'private-files'
