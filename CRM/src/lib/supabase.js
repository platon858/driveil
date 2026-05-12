import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://bydmbxzzpsybrwxmjdqn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZG1ieHp6cHN5YnJ3eG1qZHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODI4ODMsImV4cCI6MjA5NDE1ODg4M30.-t09iYEHWFBwVp03pK4oYhBbc_V58gQMG_yvSuy8ICo'
)
