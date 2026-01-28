import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ddiabipnsvxdmoszsrsl.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWFiaXBuc3Z4ZG1vc3pzcnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTczMjQsImV4cCI6MjA4NTA5MzMyNH0.2x56ACtEZmCo-CIbEqkfyaHFCmzrYjBQZyQhIJl1SNA'

export function createClient() {
    return createBrowserClient(
        supabaseUrl,
        supabaseAnonKey
    )
}
