<script lang="ts">
	import { onMount } from 'svelte';
	import { getLanguageContext } from '$lib/context/language.js';
	import flagVN from '$lib/assets/flag-vn.svg';
	import flagUS from '$lib/assets/flag-us.svg';

	interface Props {
		className?: string;
	}

	let { className = '' }: Props = $props();

	const { language, setLanguage } = getLanguageContext();
	let isVi = $derived(language.code === 'vi');

	function selectLanguage(lang: 'en' | 'vi') {
		setLanguage?.(lang);
	}

	let isInitialized = $state(false);
	onMount(() => {
		isInitialized = true;
	});
</script>

{#if isInitialized}
	<div class={`dropdown-hover dropdown dropdown-end ${className}`}>
		<div tabindex="0" role="button" class="btn btn-ghost">
			{#if isVi}
				<img src={flagVN} alt="Vietnam flag" class="h-6 w-7 rounded-sm" />
				<span>Tiếng Việt</span>
			{:else}
				<img src={flagUS} alt="USA flag" class="h-6 w-7 rounded-sm" />
				<span>English</span>
			{/if}
		</div>
		<ul class="dropdown-content menu z-50 w-52 rounded-box bg-base-200 p-2 shadow-lg">
			<li>
				<button
					onclick={() => selectLanguage('en')}
					class={`w-full text-left ${!isVi ? 'active' : ''}`}
				>
					<img src={flagUS} alt="USA flag" class="h-5 w-6 rounded-sm" />
					<span>English</span>
				</button>
			</li>
			<li>
				<button
					onclick={() => selectLanguage('vi')}
					class={`w-full text-left ${isVi ? 'active' : ''}`}
				>
					<img src={flagVN} alt="Vietnam flag" class="h-5 w-6 rounded-sm" />
					<span>Tiếng Việt</span>
				</button>
			</li>
		</ul>
	</div>
{/if}
