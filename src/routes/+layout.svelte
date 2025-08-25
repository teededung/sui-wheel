<script>
	/* ------------ Imports & constants ------------ */
	import '../app.css';
	import { SuiModule } from 'sui-svelte-wallet-kit';
	import { Toaster, setToastState } from 'svelte-daisy-toaster';

	/* ------------ Toaster & cleanup ------------ */
	setToastState();

	let { children } = $props();

	const walletConfig = {
		customNames: {
			'Slush — A Sui wallet': 'Slush',
			'Martian Sui Wallet': 'Martian',
			'OKX Wallet': 'OKX',
			'OneKey Wallet': 'OneKey',
			'Surf Wallet': 'Surf',
			'TokenPocket Wallet': 'TokenPocket'
		},
		ordering: [
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
</script>

<SuiModule autoConnect={true} autoSuiNS={true} autoSuiBalance={true} {walletConfig}>
	{@render children()}
</SuiModule>

<Toaster />
