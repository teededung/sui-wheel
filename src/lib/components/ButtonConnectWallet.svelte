<script>
	import { onMount } from 'svelte';
	import {
		connectWithModal,
		useCurrentAccount,
		useAccounts,
		disconnect,
		connect,
		switchAccount,
		switchWallet,
		useCurrentWallet,
		suiBalance,
		suiBalanceLoading,
		suiNamesByAddress,
		refreshSuiBalance
	} from 'sui-svelte-wallet-kit';
	import { toast } from 'svelte-daisy-toaster';
	import { shortenAddress } from '$lib/utils/string';
	import { getNetworkDisplayName } from '$lib/utils/suiHelpers.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import { NETWORK } from '$lib/constants.js';

	// Translation hook
	const t = useTranslation();

	// rune-style props
	let { showSwitcher = true, showBalance = true } = $props();

	// mount guard to avoid SSR/hydration mismatch
	let isInitialized = $state(false);
	onMount(() => (isInitialized = true));

	// ensure UI reacts to account changes reliably
	let accAddr = $state(null);
	$effect(() => {
		accAddr = account?.address || null;
	});

	const account = $derived(useCurrentAccount());
	const accounts = $derived(useAccounts());
	const wallet = $derived(useCurrentWallet());

	let walletIcon = $derived(wallet?.iconUrl || null);
	let walletLabel = $derived(wallet?.displayName || '');
	let bal = $derived(suiBalance?.value / 1_000_000_000);
	let balLoading = $derived(Boolean(suiBalanceLoading?.value));
	let currrentNetwork = $derived(account?.chains[0] || 'sui:mainnet');
	let networkDisplayName = $derived(getNetworkDisplayName(currrentNetwork));
	let isNetworkMismatch = $derived(currrentNetwork !== NETWORK);

	// track dropdown open state and refresh balance when opened
	let dropdownOpen = $state(false);
	$effect(() => {
		if (dropdownOpen && accAddr) {
			try {
				// Call refresh when dropdown opens; ignore result
				const maybePromise = refreshSuiBalance?.();
				if (maybePromise && typeof maybePromise.then === 'function') {
					maybePromise.catch(() => {});
				}
			} catch (e) {
				// no-op if refresh throws
			}
		}
	});

	function display(acc) {
		if (!acc) return '';
		const names = suiNamesByAddress.value?.[acc.address];
		if (Array.isArray(names)) {
			return names.length > 0 ? names[0] : shortenAddress(acc.address);
		}
		return names || shortenAddress(acc.address);
	}

	function copy(addr) {
		navigator.clipboard
			.writeText(addr)
			.then(() =>
				toast.success(t('wallet.addressCopied'), { position: 'bottom-right', durationMs: 1500 })
			)
			.catch(() => toast.error(t('wallet.copyFailed'), { position: 'bottom-right' }));
	}

	function openAddressInSuiVision(addr) {
		let base;

		if (currrentNetwork === 'sui:mainnet') {
			base = 'https://suivision.xyz';
		} else if (currrentNetwork === 'sui:testnet') {
			base = 'https://testnet.suivision.xyz';
		} else if (currrentNetwork === 'sui:devnet') {
			base = 'https://devnet.suivision.xyz';
		} else {
			// Default to mainnet for unknown networks
			base = 'https://suivision.xyz';
		}

		window.open(`${base}/account/${addr}`, '_blank');
	}

	async function handleSwitchWallet() {
		try {
			const result = await switchWallet();
			console.log('switchWallet result', result);
		} catch (err) {
			console.error('switchWallet failed', err);
		}
	}

	async function handleDisconnect() {
		try {
			await disconnect();
			toast.success(t('wallet.disconnected'), { position: 'bottom-right' });
		} catch (e) {
			console.error('Disconnect failed', e);
			toast.error(t('wallet.disconnectFailed'), { position: 'bottom-right' });
		}
	}
</script>

<div class="flex items-center gap-2">
	{#if isInitialized && accAddr && showBalance}
		<div
			class="badge badge-soft badge-primary px-2 font-mono text-xs leading-none whitespace-nowrap"
			title={`${Number(bal ?? 0).toFixed(6)} SUI`}
			aria-label={`Balance ${Number(bal ?? 0).toFixed(6)} SUI`}
		>
			{#if balLoading}
				<span class="loading loading-dots loading-xs"></span>
			{:else}
				<span class="sm:hidden">{Number(bal ?? 0).toFixed(2)}</span>
				<span class="hidden sm:inline md:hidden">{Number(bal ?? 0).toFixed(3)}</span>
				<span class="hidden md:inline">{Number(bal ?? 0).toFixed(4)}</span>
				<span class="opacity-80">SUI</span>
			{/if}
		</div>
	{/if}

	{#if isInitialized && accAddr}
		<!-- connected -->
		{#if showSwitcher && (walletLabel || walletIcon)}
			<!-- full dropdown / switcher as before -->
			<div
				class="dropdown dropdown-end {isNetworkMismatch
					? 'tooltip tooltip-bottom tooltip-error tooltip-open border-error border'
					: ''}"
				onfocusin={() => (dropdownOpen = true)}
				onfocusout={() => (dropdownOpen = false)}
				data-tip={isNetworkMismatch ? 'Network mismatch' : ''}
			>
				<div class="btn" role="button" tabindex="0">
					{#if walletIcon}
						<img src={walletIcon} class="h-6 w-6" loading="lazy" alt={walletLabel || 'Wallet'} />
					{/if}
					<div class="flex flex-col items-start text-[11px] leading-tight">
						<span class="font-semibold">{walletLabel || 'Wallet'}</span>
						<span class="opacity-70">{display(account)}</span>
					</div>
					<span class="icon-[lucide--chevron-down] h-4 w-4"></span>
				</div>

				<div
					tabindex="-1"
					class="dropdown-content menu bg-base-100 rounded-box border-base-300 z-50 w-80 border p-0 shadow-xl"
				>
					{#if isInitialized && accAddr}
						<div class="absolute top-2 right-2">
							<div
								class="tooltip badge badge-sm badge-soft badge-primary px-2 font-mono leading-none whitespace-nowrap"
								aria-label={`Balance ${Number(bal ?? 0).toFixed(6)} SUI`}
								data-tip={`${Number(bal ?? 0).toFixed(6)} SUI`}
							>
								{#if balLoading}
									<span class="loading loading-dots loading-xs"></span>
								{:else}
									<span>{Number(bal ?? 0).toFixed(3)}</span>
									<span class="opacity-80">SUI</span>
								{/if}
							</div>
						</div>
					{/if}

					<!-- header -->
					<div class="border-base-300 flex items-center gap-3 border-b px-4 py-3">
						{#if walletIcon}
							<img src={walletIcon} class="h-6 w-6" alt={`${walletLabel || 'Wallet'} icon`} />
						{/if}
						<div>
							<h3 class="text-sm font-semibold">{walletLabel || 'Wallet'}</h3>
							<p class="text-secondary text-xs opacity-70">
								{networkDisplayName}
							</p>
						</div>
					</div>

					<!-- account list -->
					<div class="max-h-64 overflow-y-auto">
						{#each accounts as acc (acc.address)}
							<div
								class="hover:bg-base-200 px-4 py-3 {acc.address === account.address
									? 'bg-primary/10'
									: ''}"
							>
								<div class="flex items-center justify-between gap-2">
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<span class="text-sm font-medium">{display(acc)}</span>
											{#if acc.address === account.address}
												<div class="badge badge-primary badge-xs">{t('wallet.active')}</div>
											{/if}
										</div>
										{#if display(acc).includes('.sui')}
											<p class="font-mono text-xs opacity-60">{shortenAddress(acc.address)}</p>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										<button
											class="btn btn-ghost btn-xs"
											aria-label="Copy address"
											onclick={e => {
												e.stopPropagation();
												copy(acc.address);
											}}
										>
											<span class="icon-[lucide--copy] h-3 w-3"></span>
										</button>
										<button
											class="btn btn-ghost btn-xs"
											aria-label="Open in SuiVision"
											onclick={e => {
												e.stopPropagation();
												openAddressInSuiVision(acc.address);
											}}
										>
											<span class="icon-[lucide--external-link] h-3 w-3"></span>
										</button>
										{#if acc.address !== account.address}
											<button
												class="btn btn-primary btn-xs"
												onclick={e => {
													e.stopPropagation();
													switchAccount(acc.address);
												}}
											>
												{t('wallet.switch')}
											</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- footer -->
					<div class="border-base-300 space-y-2 border-t px-4 py-3">
						<button class="btn btn-ghost btn-sm w-full justify-start" onclick={handleSwitchWallet}>
							<span class="icon-[lucide--refresh-cw] h-4 w-4"></span>
							{t('wallet.switchWallet')}
						</button>
						<button
							class="btn btn-ghost btn-sm text-error hover:bg-error/10 w-full justify-start"
							onclick={handleDisconnect}
						>
							<span class="icon-[lucide--unlink] h-4 w-4"></span>
							{t('wallet.disconnect')}
						</button>
					</div>
				</div>
			</div>
		{:else}
			<!-- single account display or switcher disabled -->
			<div class="relative">
				<div class="inline-flex items-center gap-1">
					{#if walletIcon}
						<img src={walletIcon} class="h-4 w-4" alt="wallet" />
					{/if}
					<div class="btn btn-sm flex cursor-default items-center gap-1 select-text">
						{shortenAddress(accAddr)}
					</div>
				</div>

				<!-- When the switcher is disabled, still show a small menu for switch/disconnect -->
				<div
					class="dropdown dropdown-end"
					onfocusin={() => (dropdownOpen = true)}
					onfocusout={() => (dropdownOpen = false)}
				>
					<button
						tabindex="0"
						class="btn btn-ghost btn-xs ml-1"
						aria-label={t('wallet.moreOptions')}
						data-toggle="dropdown"
					>
						<span class="icon-[lucide--ellipsis] h-4 w-4"></span>
					</button>
					<ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box w-44 p-2 shadow">
						<li>
							<button onclick={handleSwitchWallet}>
								<span class="icon-[lucide--refresh-cw] mr-1"></span>
								{t('wallet.switchWallet')}
							</button>
						</li>
						<li>
							<button onclick={handleDisconnect}>
								<span class="icon-[lucide--unlink] mr-1"></span>
								{t('wallet.disconnect')}
							</button>
						</li>
					</ul>
				</div>
			</div>
		{/if}
	{:else}
		<!-- not connected -->
		<button class="btn btn-soft btn-sm hover:bg-primary" onclick={connectWithModal}>
			<span class="icon-[lucide--wallet] h-4 w-4"></span>
			{t('wallet.connectSuiWallet')}
		</button>
	{/if}
</div>
