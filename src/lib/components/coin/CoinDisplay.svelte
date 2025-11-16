<script lang="ts">
	/**
	 * CoinDisplay Component
	 * Displays coin amount with icon and symbol
	 */

	import CoinIcon from './CoinIcon.svelte';
	import { coinMetadataCache } from '$lib/services/CoinMetadataCache.svelte';
	import { createTestnetCoinService } from '$lib/services/coinService';
	import { formatCoinAmount, DEFAULT_COIN_TYPE } from '$lib/utils/coinHelpers';
	import { COMMON_COINS } from '$lib/constants';

	// Props
	let {
		coinType = DEFAULT_COIN_TYPE,
		amount,
		showIcon = true,
		showSymbol = true,
		showName = false,
		size = 'md',
		layout = 'horizontal',
		compact = true
	}: {
		coinType?: string;
		amount: string | bigint | number;
		showIcon?: boolean;
		showSymbol?: boolean;
		showName?: boolean;
		size?: 'sm' | 'md' | 'lg';
		layout?: 'horizontal' | 'vertical';
		compact?: boolean;
	} = $props();

	// State
	let metadata = $state<any>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Size classes
	const textSizeClasses = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg'
	};

	const iconSizes = {
		sm: 'sm' as const,
		md: 'md' as const,
		lg: 'lg' as const
	};

	// Fetch metadata
	async function loadMetadata() {
		loading = true;
		error = null;

		try {
			// Check if it's a common coin with predefined metadata
			const commonCoin = COMMON_COINS.find((c) => c.coinType === coinType);
			if (commonCoin) {
				metadata = {
					coinType: commonCoin.coinType,
					symbol: commonCoin.symbol,
					name: commonCoin.name,
					decimals: commonCoin.decimals,
					iconUrl: commonCoin.iconUrl,
					description: '',
					id: ''
				};
				loading = false;
				return;
			}

			// Fetch metadata from blockchain for non-common coins
			const coinService = createTestnetCoinService();
			metadata = await coinMetadataCache.fetchWithCache(coinType, (ct) =>
				coinService.getCoinMetadata(ct)
			);
		} catch (err) {
			console.error('Error loading coin metadata:', err);
			error = err instanceof Error ? err.message : String(err);
			// Set fallback metadata
			metadata = {
				symbol: '???',
				name: 'Unknown',
				decimals: 9,
				iconUrl: null
			};
		} finally {
			loading = false;
		}
	}

	// Format amount for display
	let formattedAmount = $derived(
		metadata
			? formatCoinAmount(amount, metadata.decimals, {
					compact,
					maxDecimals: compact ? 6 : metadata.decimals
				})
			: '...'
	);

	// Load metadata when coinType changes
	$effect(() => {
		if (coinType) {
			loadMetadata();
		}
	});
</script>

<div
	class="coin-display inline-flex items-center gap-2 {layout === 'vertical' ? 'flex-col' : ''}"
	role="group"
	aria-label="Coin amount display"
>
	{#if loading}
		<!-- Loading state -->
		<div class="flex items-center gap-2">
			{#if showIcon}
				<CoinIcon loading={true} {size} />
			{/if}
			<div class="animate-pulse">
				<div class="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
			</div>
		</div>
	{:else if error && !metadata}
		<!-- Error state -->
		<div class="flex items-center gap-2 text-red-500">
			{#if showIcon}
				<CoinIcon iconUrl={null} symbol="?" size={iconSizes[size]} />
			{/if}
			<span class={textSizeClasses[size]}>Error loading coin</span>
		</div>
	{:else if metadata}
		<!-- Display coin info -->
		{#if showIcon}
			<CoinIcon iconUrl={metadata?.iconUrl} symbol={metadata?.symbol || '?'} size={iconSizes[size]} />
		{/if}

		<div class="flex flex-col {layout === 'horizontal' ? 'items-start' : 'items-center'}">
			<div class="flex items-baseline gap-1">
				<span class="font-semibold {textSizeClasses[size]}" title={amount.toString()}>
					{formattedAmount}
				</span>
				{#if showSymbol}
					<span class="text-gray-600 dark:text-gray-400 {textSizeClasses[size]}">
						{metadata.symbol}
					</span>
				{/if}
			</div>

			{#if showName}
				<span class="text-xs text-gray-500 dark:text-gray-500">
					{metadata.name}
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.coin-display {
		user-select: none;
	}
</style>
