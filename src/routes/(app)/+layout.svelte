<script>
	import { page } from '$app/state';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	let { children } = $props();

	let isAboutPage = $derived(page.url.pathname === '/about');
</script>

{#if isAboutPage}
	{@render children()}
{:else}
	<div class="flex min-h-screen flex-col">
		<Navbar />
		<main>
			{@render children()}
		</main>
		<Footer />
	</div>
{/if}
