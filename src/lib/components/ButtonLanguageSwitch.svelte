<script>
	import { onMount } from 'svelte';

	/** @type {{className?: string}} */
	let { className = '' } = $props();

	let isInitialized = $state(false);
	let isVi = $state(false);

	onMount(() => {
		isInitialized = true;
	});

	function toggleLanguage() {
		isVi = !isVi;
	}
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
