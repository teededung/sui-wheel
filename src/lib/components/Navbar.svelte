<script>
	import ButtonThemeSwitch from './ButtonThemeSwitch.svelte';
	import ButtonConnectWallet from './ButtonConnectWallet.svelte';
</script>

<div class="navbar bg-base-100 px-4 shadow-sm">
	<div class="navbar-start">
		<a href="/" class="flex items-center gap-2 text-xl">
			<img src="/sui-logo.png" alt="Sui logo" class="h-8 rounded-full" />
			<span class="text-md hidden lg:block">Sui Wheel</span>
		</a>
	</div>
	<div class="navbar-end flex items-center gap-3">
		<ButtonThemeSwitch />
		<ButtonConnectWallet showBalance={false} />
	</div>
</div>
