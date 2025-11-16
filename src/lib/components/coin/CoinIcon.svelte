<script lang="ts">
	/**
	 * CoinIcon Component
	 * Displays a coin icon with fallback support
	 */

	// Props
	let {
		iconUrl = $bindable(null),
		symbol = '',
		size = 'md',
		alt = '',
		loading = false
	}: {
		iconUrl?: string | null;
		symbol?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		alt?: string;
		loading?: boolean;
	} = $props();

	// State
	let imageLoaded = $state(false);
	let imageError = $state(false);

	// Size classes
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-6 h-6',
		lg: 'w-8 h-8',
		xl: 'w-12 h-12'
	};

	// Text size for fallback
	const textSizeClasses = {
		sm: 'text-xs',
		md: 'text-sm',
		lg: 'text-base',
		xl: 'text-xl'
	};

	// Computed alt text
	let altText = $derived(alt || `${symbol} icon` || 'Coin icon');

	// Reset state when iconUrl changes
	$effect(() => {
		if (iconUrl) {
			imageLoaded = false;
			imageError = false;
		}
	});

	// Handle image load
	function handleImageLoad() {
		imageLoaded = true;
		imageError = false;
	}

	// Handle image error
	function handleImageError() {
		imageError = true;
		imageLoaded = false;
	}

	// Get first letter of symbol for fallback
	let fallbackLetter = $derived(symbol ? symbol.charAt(0).toUpperCase() : '?');
</script>

<div
	class="coin-icon inline-flex items-center justify-center {sizeClasses[size]}"
	role="img"
	aria-label={altText}
>
	{#if loading}
		<!-- Loading skeleton -->
		<div
			class="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full {sizeClasses[size]}"
			aria-label="Loading coin icon"
		></div>
	{:else if iconUrl && !imageError}
		<!-- Coin image -->
		<img
			src={iconUrl}
			alt={altText}
			class="rounded-full object-cover {sizeClasses[size]} {imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200"
			onload={handleImageLoad}
			onerror={handleImageError}
		/>
		{#if !imageLoaded}
			<!-- Loading placeholder while image loads -->
			<div
				class="absolute inset-0 animate-pulse bg-gray-300 dark:bg-gray-700 rounded-full {sizeClasses[size]}"
			></div>
		{/if}
	{:else}
		<!-- Fallback: Show first letter of symbol -->
		<div
			class="flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold {sizeClasses[size]} {textSizeClasses[size]}"
			title={symbol || 'Unknown coin'}
		>
			{fallbackLetter}
		</div>
	{/if}
</div>

<style>
	.coin-icon {
		position: relative;
		flex-shrink: 0;
	}

	img {
		transition: opacity 0.2s ease-in-out;
	}
</style>
