<script>
	import { page } from '$app/state';
	import ButtonThemeSwitch from './ButtonThemeSwitch.svelte';
	import ButtonConnectWallet from './ButtonConnectWallet.svelte';
	import ButtonLanguageSwitch from './ButtonLanguageSwitch.svelte';
	import { getLanguageContext } from '$lib/context/language.js';
	import logo from '$lib/assets/sui-wheel-logo-small.png';

	let isFaqPage = $derived(page.url.pathname === '/faq');
	let isAboutPage = $derived(page.url.pathname === '/about');

	const { language, setLanguage } = getLanguageContext();
	let isVi = $derived(language.code === 'vi');

	function selectLanguage(lang) {
		setLanguage(lang);
	}
</script>

<div class="navbar bg-base-100 px-4 shadow-sm">
	<div class="navbar-start">
		<!-- Mobile dropdown menu -->
		<div class="dropdown lg:hidden">
			<div tabindex="0" role="button" class="btn btn-ghost pl-1" aria-label="Open navigation menu">
				<span class="icon-[lucide--menu] h-7 w-7"></span>
			</div>
			<ul
				class="menu sm:menu-sm dropdown-content bg-base-200 rounded-box z-10 mt-3 w-52 p-2 shadow"
			>
				<li><a href="/wheel-list" aria-label="Go to Wheel List">Wheel List</a></li>
				<li><a href="/about" aria-label="Go to About">About</a></li>
				<li class="menu-title">
					<span>Language</span>
				</li>
				<li>
					<button
						onclick={() => selectLanguage('en')}
						class={`w-full text-left ${!isVi ? 'active' : ''}`}
					>
						<img src="/flag-us.svg" alt="USA flag" class="h-5 w-6 rounded-sm" />
						<span>English</span>
					</button>
				</li>
				<li>
					<button
						onclick={() => selectLanguage('vi')}
						class={`w-full text-left ${isVi ? 'active' : ''}`}
					>
						<img src="/flag-vn.svg" alt="Vietnam flag" class="h-5 w-6 rounded-sm" />
						<span>Tiếng Việt</span>
					</button>
				</li>
			</ul>
		</div>

		<!-- Logo -->
		<a href="/" class="flex items-center gap-2 text-xl">
			<img src={logo} alt="Sui wheel logo" class="h-8 rounded-full" />
			<span class="text-md hidden lg:block">Sui Wheel</span>
		</a>
	</div>

	<!-- Desktop navigation -->
	<div class="navbar-center hidden lg:flex">
		<div class="flex items-center gap-3">
			<a href="/wheel-list" class="btn btn-ghost btn-sm" aria-label="Go to Wheel List">Wheel List</a
			>
			<a href="/faq" class="btn btn-ghost btn-sm" aria-label="Go to FAQ">FAQ</a>
			<a href="/about" class="btn btn-ghost btn-sm" aria-label="Go to About">About</a>
		</div>
	</div>

	<div class="navbar-end flex items-center gap-4">
		<ButtonThemeSwitch />
		<ButtonLanguageSwitch className="hidden lg:block" />
		{#if !isFaqPage && !isAboutPage}
			<ButtonConnectWallet showBalance={false} />
		{/if}
	</div>
</div>
