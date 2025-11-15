// App hooks
// Attach per-request Supabase clients to event.locals for server routes.
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const supabaseUrl = PUBLIC_SUPABASE_URL ?? '';
	const anonKey = PUBLIC_SUPABASE_ANON_KEY ?? '';
	const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY ?? '';

	// Public client for anon operations (if ever needed server-side)
	event.locals.supabase = createClient(supabaseUrl, anonKey, {
		auth: { persistSession: false }
	});

	// Admin client with service role
	event.locals.supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false }
	});

	const response = await resolve(event);
	return response;
};

export async function handleClose() {}
