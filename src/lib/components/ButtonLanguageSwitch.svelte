<script>
	import { onMount } from 'svelte';
	import { getLanguageContext } from '$lib/context/language.js';

	/** @type {{className?: string}} */
	let { className = '' } = $props();

	const { language, setLanguage } = getLanguageContext();
	let isVi = $derived(language.code === 'vi');

	function toggleLanguage() {
		setLanguage(isVi ? 'en' : 'vi');
	}

	let isInitialized = $state(false);
	onMount(() => {
		isInitialized = true;
	});
</script>

{#if isInitialized}
	<label
		class={`swap swap-rotate tooltip tooltip-bottom cursor-pointer ${className}`}
		aria-label="Switch language"
		title="Switch language"
		data-tip={isVi ? 'Vietnamese' : 'English'}
	>
		<input
			type="checkbox"
			class="language-controller"
			checked={isVi}
			onchange={toggleLanguage}
			aria-label="Toggle language"
		/>

		<img src="/flag-us.svg" alt="USA flag" class="swap-off h-6 w-7 rounded-sm" />
		<img src="/flag-vn.svg" alt="Vietnam flag" class="swap-on h-6 w-7 rounded-sm" />
	</label>
{/if}
