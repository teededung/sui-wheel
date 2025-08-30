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
		<a href="/wheel-list" class="btn btn-ghost btn-sm" aria-label="Go to Wheel List">Wheel List</a>
		<a href="/about" class="btn btn-ghost btn-sm" aria-label="Go to About">About</a>
		<ButtonThemeSwitch />
		<ButtonConnectWallet showBalance={false} />
	</div>
</div>
