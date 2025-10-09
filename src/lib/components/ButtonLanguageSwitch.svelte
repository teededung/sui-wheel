<script>
	import { onMount } from 'svelte';
	import { getLanguageContext } from '$lib/context/language.js';

	/** @type {{className?: string}} */
	let { className = '' } = $props();

	const { language, setLanguage } = getLanguageContext();
	let isVi = $derived(language.code === 'vi');

	function selectLanguage(lang) {
		setLanguage(lang);
	}

	let isInitialized = $state(false);
	onMount(() => {
		isInitialized = true;
	});
</script>

{#if isInitialized}
	<div class={`dropdown dropdown-end dropdown-hover ${className}`}>
		<div tabindex="0" role="button" class="btn btn-ghost">
			{#if isVi}
				<img src="/flag-vn.svg" alt="Vietnam flag" class="h-6 w-7 rounded-sm" />
				<span>Tiếng Việt</span>
			{:else}
				<img src="/flag-us.svg" alt="USA flag" class="h-6 w-7 rounded-sm" />
				<span>English</span>
			{/if}
		</div>
		<ul class="dropdown-content menu bg-base-200 rounded-box z-50 w-52 p-2 shadow-lg">
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
{/if}
