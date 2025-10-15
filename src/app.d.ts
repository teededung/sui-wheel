// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
            prisma: any;
            authedUser: any | null;
            supabase: import('@supabase/supabase-js').SupabaseClient;
            supabaseAdmin: import('@supabase/supabase-js').SupabaseClient;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Account {
		value: {
			address: string;
			chains: string[];
		};
	}
}

export {};
