import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cshuovbikavzwyytnrrm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzaHVvdmJpa2F2end5eXRucnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDQ4ODEsImV4cCI6MjA5NTcyMDg4MX0.dqWOauTmRR5ZKvMjVGnQsQqGrfkEZZxD7pq40lesnf0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
