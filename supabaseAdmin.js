import { createClient } from '@supabase/supabase-js';

// This client uses the SERVICE ROLE key and must never be imported into
// a 'use client' component or otherwise sent to the browser. It is only
// ever used inside app/api/**/route.js files, which run on the server.

let cachedClient = null;

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
