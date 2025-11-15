<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { onMount } from 'svelte';
	import { setLanguageContext } from '$lib/context/language.js';
	import type { LanguageCode } from '$lib/services/translation.js';

	let { children } = $props();

	// Reactive language state shared via context (default: 'en')
	const language = $state<{ code: LanguageCode }>({ code: 'en' });

	function setLanguage(code: LanguageCode) {
		language.code = code;
	}

	// Load saved language from localStorage on client
	onMount(() => {
		try {
			const saved = localStorage.getItem('app_lang');
			if (saved === 'en' || saved === 'vi') language.code = saved;
		} catch {}
	});

	// Persist language to localStorage whenever it changes
	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem('app_lang', language.code);
			} catch {}
		}
	});

	setLanguageContext({ language, setLanguage });
</script>

<div class="flex min-h-screen flex-col">
	<Navbar />
	<main>
		{@render children()}
	</main>
	<Footer />
</div>
