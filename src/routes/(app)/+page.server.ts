import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const load: PageServerLoad = async () => {
	const xImportEnabled = Boolean(env.X_API_KEY);

	if (!xImportEnabled && dev) {
		console.log('[x-import] disabled: missing X_API_KEY');
	}

	return { xImportEnabled };
};
