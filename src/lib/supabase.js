import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rdjtnrzvhpwsiclqjohc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkanRucnp2aHB3c2ljbHFqb2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODI5MDYsImV4cCI6MjA5NTk1ODkwNn0.m8Qfx-fusYut2rpd3Z8D-ZMe8mLONdj58S5gveg53rw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'hako' }
})