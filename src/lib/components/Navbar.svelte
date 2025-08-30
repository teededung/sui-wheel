<script>
	import ButtonThemeSwitch from './ButtonThemeSwitch.svelte';
	import ButtonConnectWallet from './ButtonConnectWallet.svelte';
</script>

<div class="navbar bg-base-100 px-4 shadow-sm">
	<div class="navbar-start">
		<!-- Mobile dropdown menu -->
		<div class="dropdown lg:hidden">
			<div tabindex="0" role="button" class="btn btn-ghost" aria-label="Open navigation menu">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h8m-8 6h16"
					/>
				</svg>
			</div>
			<ul class="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow">
				<li><a href="/wheel-list" aria-label="Go to Wheel List">Wheel List</a></li>
				<li><a href="/about" aria-label="Go to About">About</a></li>
			</ul>
		</div>

		<!-- Logo -->
		<a href="/" class="flex items-center gap-2 text-xl">
			<img src="/sui-logo.png" alt="Sui logo" class="h-8 rounded-full" />
			<span class="text-md hidden lg:block">Sui Wheel</span>
		</a>
	</div>

	<!-- Desktop navigation -->
	<div class="navbar-center hidden lg:flex">
		<div class="flex items-center gap-3">
			<a href="/wheel-list" class="btn btn-ghost btn-sm" aria-label="Go to Wheel List">Wheel List</a
			>
			<a href="/about" class="btn btn-ghost btn-sm" aria-label="Go to About">About</a>
		</div>
	</div>

	<div class="navbar-end flex items-center gap-3">
		<ButtonThemeSwitch />
		<ButtonConnectWallet showBalance={false} />
	</div>
</div>
