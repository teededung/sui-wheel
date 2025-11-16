<script lang="ts">
	/**
	 * CoinBalance Component
	 * Displays wallet balance for a specific coin type
	 */

	import CoinDisplay from './CoinDisplay.svelte';
	import { createTestnetCoinService } from '$lib/services/coinService';
	import { DEFAULT_COIN_TYPE, CoinError, CoinErrorType } from '$lib/utils/coinHelpers';
	import type { CoinBalance as CoinBalanceType } from '$lib/utils/coinHelpers';
	import { onMount } from 'svelte';

	// Props
	let {
		address,
		coinType = DEFAULT_COIN_TYPE,
		autoRefresh = false,
		refreshInterval = 30000,
		showIcon = true,
		showSymbol = true,
		size = 'md',
		showInsufficientWarning = false,
		requiredAmount = null
	}: {
		address: string;
		coinType?: string;
		autoRefresh?: boolean;
		refreshInterval?: number;
		showIcon?: boolean;
		showSymbol?: boolean;
		size?: 'sm' | 'md' | 'lg';
		showInsufficientWarning?: boolean;
		requiredAmount?: string | bigint | null;
	} = $props();

	// State
	let balance = $state<CoinBalanceType | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let refreshTimer = $state<ReturnType<typeof setInterval> | null>(null);

	// Computed
	let isInsufficient = $derived(
		showInsufficientWarning &&
			requiredAmount !== null &&
			balance &&
			BigInt(balance.totalBalance) < BigInt(requiredAmount)
	);

	// Fetch balance
	async function fetchBalance() {
		if (!address) {
			error = 'No address provided';
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			const coinService = createTestnetCoinService();
			balance = await coinService.getCoinBalance(address, coinType);
		} catch (err) {
			console.error('Error fetching coin balance:', err);

			if (err instanceof CoinError) {
				if (err.type === CoinErrorType.INVALID_COIN_TYPE) {
					error = 'Invalid coin type';
				} else if (err.type === CoinErrorType.NETWORK_ERROR) {
					error = 'Network error. Please try again.';
				} else {
					error = err.message;
				}
			} else {
				error = err instanceof Error ? err.message : 'Failed to fetch balance';
			}

			balance = null;
		} finally {
			loading = false;
		}
	}

	// Refresh balance
	function refresh() {
		fetchBalance();
	}

	// Setup auto-refresh
	function setupAutoRefresh() {
		if (autoRefresh && refreshInterval > 0) {
			refreshTimer = setInterval(() => {
				fetchBalance();
			}, refreshInterval);
		}
	}

	// Cleanup auto-refresh
	function cleanupAutoRefresh() {
		if (refreshTimer) {
			clearInterval(refreshTimer);
			refreshTimer = null;
		}
	}

	// Lifecycle
	onMount(() => {
		fetchBalance();
		setupAutoRefresh();

		return () => {
			cleanupAutoRefresh();
		};
	});

	// Watch for changes
	$effect(() => {
		if (address || coinType) {
			fetchBalance();
		}
	});

	$effect(() => {
		if (autoRefresh) {
			cleanupAutoRefresh();
			setupAutoRefresh();
		} else {
			cleanupAutoRefresh();
		}
	});
</script>

<div class="coin-balance" role="region" aria-label="Coin balance">
	{#if loading}
		<!-- Loading skeleton -->
		<div class="flex items-center gap-2">
			<div class="animate-pulse flex items-center gap-2">
				<div class="w-6 h-6 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
				<div class="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
			</div>
		</div>
	{:else if error}
		<!-- Error state -->
		<div class="flex items-center gap-2 text-red-500">
			<svg
				class="w-5 h-5"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span class="text-sm">{error}</span>
			<button
				onclick={refresh}
				class="ml-2 text-xs underline hover:no-underline"
				aria-label="Retry fetching balance"
			>
				Retry
			</button>
		</div>
	{:else if balance}
		<!-- Balance display -->
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
				<CoinDisplay
					{coinType}
					amount={balance.totalBalance}
					{showIcon}
					{showSymbol}
					{size}
					compact={true}
				/>
				{#if autoRefresh}
					<button
						onclick={refresh}
						class="ml-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
						aria-label="Refresh balance"
						title="Refresh balance"
					>
						<svg
							class="w-4 h-4 text-gray-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
				{/if}
			</div>

			{#if isInsufficient}
				<!-- Insufficient balance warning -->
				<div class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500" role="alert">
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>Insufficient balance</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.coin-balance {
		display: inline-block;
	}
</style>
