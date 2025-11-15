import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		csrf: {
			trustedOrigins: ['*']
		}
	},
	vitePlugin: {
		inspector: true
	}
};

export default config;
