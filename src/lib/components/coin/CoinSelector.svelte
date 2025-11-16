<script lang="ts">
	/**
	 * CoinSelector Component
	 * Allows users to select a coin type from their wallet
	 */

	import { onMount } from 'svelte';
	import { createTestnetCoinService } from '$lib/services/coinService';
	import { coinMetadataCache } from '$lib/services/CoinMetadataCache.svelte';
	import CoinIcon from './CoinIcon.svelte';
	import ButtonCopy from '$lib/components/ButtonCopy.svelte';
	import { DEFAULT_COIN_TYPE } from '$lib/utils/coinHelpers';
	import { COMMON_COINS } from '$lib/constants';
	import type { CoinBalance } from '$lib/utils/coinHelpers';
	import { getExplorerLink } from '$lib/utils/suiHelpers';

	// Props
	let {
		selectedCoinType = $bindable(DEFAULT_COIN_TYPE),
		walletAddress = '',
		showBalance = true,
		filterFn = null,
		placeholder = 'Select a coin',
		disabled = false,
		onchange
	}: {
		selectedCoinType?: string;
		walletAddress?: string;
		showBalance?: boolean;
		filterFn?: ((coin: CoinBalance) => boolean) | null;
		placeholder?: string;
		disabled?: boolean;
		onchange?: (event: { coinType: string }) => void;
	} = $props();

	// State
	let coins = $state<CoinBalance[]>([]);
	let coinsWithMetadata = $state<Array<CoinBalance & { metadata: any }>>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let isOpen = $state(false);
	let searchQuery = $state('');
	let dropdownElement = $state<HTMLDivElement>();
	let selectedIndex = $state(-1);

	// Fetch available coins
	async function fetchCoins() {
		if (!walletAddress) {
			error = 'No wallet address provided';
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			const coinService = createTestnetCoinService();
			const allBalances = await coinService.getAllCoinBalances(walletAddress);

			// Apply filter if provided
			coins = filterFn ? allBalances.filter(filterFn) : allBalances;

			// Create a map of wallet balances by coinType
			const balanceMap = new Map(coins.map((coin) => [coin.coinType, coin]));

			// Merge common coins with wallet balances
			const commonCoinsWithBalance = COMMON_COINS.map((commonCoin) => {
				const walletBalance = balanceMap.get(commonCoin.coinType);
				return {
					coinType: commonCoin.coinType,
					totalBalance: walletBalance?.totalBalance || '0',
					coinObjectCount: walletBalance?.coinObjectCount || 0,
					formattedBalance: walletBalance?.formattedBalance || '0'
				};
			});

			// Add wallet coins that are not in common coins list
			const commonCoinTypes = new Set(COMMON_COINS.map((c) => c.coinType));
			const additionalCoins = coins.filter((coin) => !commonCoinTypes.has(coin.coinType));

			// Combine: common coins first, then additional wallet coins
			const allCoins = [...commonCoinsWithBalance, ...additionalCoins];

			// Fetch metadata for each coin
			const withMetadata = await Promise.all(
				allCoins.map(async (coin) => {
					try {
						// Check if it's a common coin with predefined metadata
						const commonCoin = COMMON_COINS.find((c) => c.coinType === coin.coinType);
						if (commonCoin) {
							return {
								...coin,
								metadata: {
									coinType: commonCoin.coinType,
									symbol: commonCoin.symbol,
									name: commonCoin.name,
									decimals: commonCoin.decimals,
									iconUrl: commonCoin.iconUrl,
									description: '',
									id: ''
								}
							};
						}

						// Fetch metadata from blockchain for non-common coins
						const metadata = await coinMetadataCache.fetchWithCache(coin.coinType, (ct) =>
							coinService.getCoinMetadata(ct)
						);
						return { ...coin, metadata };
					} catch (err) {
						console.error(`Failed to fetch metadata for ${coin.coinType}:`, err);
						return {
							...coin,
							metadata: {
								symbol: '???',
								name: 'Unknown',
								decimals: 9,
								iconUrl: null
							}
						};
					}
				})
			);

			coinsWithMetadata = withMetadata;
		} catch (err) {
			console.error('Error fetching coins:', err);
			error = err instanceof Error ? err.message : 'Failed to fetch coins';
			coins = [];
			coinsWithMetadata = [];
		} finally {
			loading = false;
		}
	}

	// Filter coins based on search query
	let filteredCoins = $derived(
		coinsWithMetadata.filter((coin) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				coin.metadata.symbol.toLowerCase().includes(query) ||
				coin.metadata.name.toLowerCase().includes(query) ||
				coin.coinType.toLowerCase().includes(query)
			);
		})
	);

	// Get selected coin metadata
	let selectedCoin = $derived(coinsWithMetadata.find((c) => c.coinType === selectedCoinType));

	// Handle coin selection
	function selectCoin(coinType: string) {
		selectedCoinType = coinType;
		isOpen = false;
		searchQuery = '';
		selectedIndex = -1;
		onchange?.({ coinType });
	}

	// Toggle dropdown
	function toggleDropdown() {
		if (disabled) return;
		isOpen = !isOpen;
		if (isOpen) {
			selectedIndex = filteredCoins.findIndex((c) => c.coinType === selectedCoinType);
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
			isOpen = false;
			searchQuery = '';
		}
	}

	// Keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggleDropdown();
			}
			return;
		}

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				isOpen = false;
				searchQuery = '';
				break;
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredCoins.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < filteredCoins.length) {
					selectCoin(filteredCoins[selectedIndex].coinType);
				}
				break;
		}
	}

	// Lifecycle
	onMount(() => {
		fetchCoins();
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	// Watch for wallet address changes
	$effect(() => {
		if (walletAddress) {
			fetchCoins();
		}
	});
</script>

<div
	class="coin-selector relative"
	bind:this={dropdownElement}
	role="combobox"
	aria-expanded={isOpen}
	aria-haspopup="listbox"
	aria-controls="coin-list"
	aria-label="Coin selector"
>
	<!-- Selector button -->
	<button
		type="button"
		onclick={toggleDropdown}
		onkeydown={handleKeydown}
		{disabled}
		class="w-full flex items-center justify-between gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors {disabled
			? 'opacity-50 cursor-not-allowed'
			: 'cursor-pointer'}"
		aria-label="Select coin type"
	>
		{#if loading}
			<div class="flex items-center gap-2">
				<div class="w-6 h-6 bg-gray-300 dark:bg-gray-700 rounded-full animate-pulse"></div>
				<span class="text-gray-500">Loading...</span>
			</div>
		{:else if selectedCoin}
			<div class="flex items-center gap-2">
				<CoinIcon
					iconUrl={selectedCoin.metadata?.iconUrl}
					symbol={selectedCoin.metadata?.symbol || '?'}
					size="md"
				/>
				<div class="flex flex-col items-start">
					<span class="font-medium">{selectedCoin.metadata?.symbol || 'Unknown'}</span>
					{#if showBalance}
						<span class="text-xs text-gray-500">{selectedCoin.formattedBalance}</span>
					{/if}
				</div>
			</div>
		{:else}
			<span class="text-gray-500">{placeholder}</span>
		{/if}

		<svg
			class="w-5 h-5 text-gray-400 transition-transform {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Dropdown menu -->
	{#if isOpen}
		<div
			id="coin-list"
			class="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden"
			role="listbox"
			aria-label="Available coins"
		>
			<!-- Search input -->
			<div class="p-2 border-b border-gray-200 dark:border-gray-700">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search coins..."
					class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					aria-label="Search coins"
				/>
			</div>

			<!-- Coin list -->
			<div class="overflow-y-auto max-h-64">
				{#if loading}
					<div class="p-4 text-center text-gray-500">Loading coins...</div>
				{:else if error}
					<div class="p-4 text-center text-red-500">
						<p>{error}</p>
						<button onclick={fetchCoins} class="mt-2 text-sm underline hover:no-underline">
							Retry
						</button>
					</div>
				{:else if filteredCoins.length === 0}
					<div class="p-4 text-center text-gray-500">
						{searchQuery ? 'No coins found' : 'No coins available'}
					</div>
				{:else}
					{#each filteredCoins as coin, index (coin.coinType)}
						<div
							class="group w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer {selectedIndex ===
							index
								? 'bg-gray-100 dark:bg-gray-700'
								: ''} {coin.coinType === selectedCoinType
								? 'bg-blue-50 dark:bg-blue-900/20'
								: ''}"
							role="option"
							tabindex="0"
							aria-selected={coin.coinType === selectedCoinType}
							onclick={() => selectCoin(coin.coinType)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectCoin(coin.coinType);
								}
							}}
						>
							<div class="flex items-center gap-3 flex-1 min-w-0">
								<CoinIcon
									iconUrl={coin.metadata.iconUrl}
									symbol={coin.metadata.symbol}
									size="md"
								/>
								<div class="flex flex-col items-start min-w-0">
									<span class="font-medium">{coin.metadata.symbol}</span>
									<div class="flex items-center gap-2 text-xs text-gray-500">
										<span title={coin.metadata.name}>{coin.metadata.name}</span>
										<span
											role="button"
											tabindex="0"
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.stopPropagation();
												}
											}}
											class="opacity-0 group-hover:opacity-100"
										>
											<ButtonCopy originText={coin.coinType} size="xs" />
										</span>
										<a
											href={getExplorerLink('testnet', 'object', coin.coinType)}
											target="_blank"
											rel="noopener noreferrer"
											class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-500 transition-colors"
											onclick={(e) => e.stopPropagation()}
											title="View on Suiscan"
										>
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>
									</div>
								</div>
							</div>
							{#if showBalance}
								<span class="text-sm flex-shrink-0">
									{coin.formattedBalance}
								</span>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.coin-selector {
		min-width: 200px;
	}
</style>
