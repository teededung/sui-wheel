// Supabase Admin client for server-side operations
// Comment language: English
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Read from environment
const supabaseUrl = PUBLIC_SUPABASE_URL;
const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
	console.warn('[supabaseAdmin] Missing PUBLIC_SUPABASE_URL/SUPABASE_URL');
}
if (!serviceRoleKey) {
	console.warn('[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
	auth: { persistSession: false }
});
