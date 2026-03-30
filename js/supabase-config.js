// ============================================
// BazaarOS — Supabase Configuration
// ============================================

const SUPABASE_URL = 'https://mkgklnnlmifrkzetivvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ2tsbm5sbWlmcmt6ZXRpdnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDIwMzMsImV4cCI6MjA4OTg3ODAzM30._urHUrIzWkp6U8EZ95gv4qROdTUKJQaUeF6JwPTEaKs';

// Initialize Supabase client
// The CDN script exposes the global 'supabase' object with createClient
// We must name our instance something else (e.g. supabaseClient) so we don't clobber it.
let supabaseClient = null;

if (typeof supabase !== 'undefined' && supabase.createClient) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized');
} else {
  console.error('❌ Supabase library failed to load from CDN');
}
