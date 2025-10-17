<script>
	/* ------------ Imports & constants ------------ */
	import '../app.css';
	import { SuiModule } from 'sui-svelte-wallet-kit';
	import { Toaster, setToastState } from 'svelte-daisy-toaster';
	import { PUBLIC_ENOKI_API_KEY, PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

	/* ------------ Toaster & cleanup ------------ */
	setToastState();

	let { children } = $props();

	const walletConfig = {
		customNames: {
			'Sign in with Google': 'Google',
			'Slush — A Sui wallet': 'Slush',
			'Martian Sui Wallet': 'Martian',
			'OKX Wallet': 'OKX',
			'OneKey Wallet': 'OneKey',
			'Surf Wallet': 'Surf',
			'TokenPocket Wallet': 'TokenPocket'
		},
		ordering: [
			'Sign in with Google',
			'Slush — A Sui wallet', // Show Slush first
			'OKX Wallet', // Then OKX
			'Phantom', // Then Phantom
			'Suiet', // Then Suiet
			'Martian Sui Wallet', // Then Martian
			'OneKey Wallet', // Then OneKey
			'Surf Wallet', // Then Surf
			'TokenPocket Wallet' // Then TokenPocket
			// Other wallets (GlassWallet, Nightly) will appear after these in alphabetical order
		]
	};

	const zkLoginGoogle = {
		apiKey: PUBLIC_ENOKI_API_KEY,
		googleClientId: PUBLIC_GOOGLE_CLIENT_ID,
		network: 'testnet',
		redirectUrls: [
			'http://localhost:5177',
			'https://sui-wheel.netlify.app',
			'https://sui-wheel.netlify.app/wheel-list'
		]
	};
</script>

<SuiModule autoConnect={true} autoSuiNS={true} autoSuiBalance={true} {walletConfig} {zkLoginGoogle}>
	{@render children()}
</SuiModule>

<Toaster />
