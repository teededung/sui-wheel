<script>
	import { onMount, onDestroy } from 'svelte';
	import { watch, IsIdle } from 'runed';
	import { gsap } from 'gsap';
	import { SuiClient } from '@mysten/sui/client';
	import { Transaction } from '@mysten/sui/transactions';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-daisy-toaster';
	import { formatDistanceToNow } from 'date-fns';
	import {
		account,
		wallet,
		signAndExecuteTransaction,
		suiBalance,
		suiBalanceLoading
	} from 'sui-svelte-wallet-kit';
	import { shortenAddress } from '$lib/utils/string.js';
	import {
		isValidSuiAddress,
		parseSuiToMist,
		formatMistToSuiCompact,
		formatMistToSui
	} from '$lib/utils/suiHelpers.js';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import QRCode from 'qrcode';

	import {
		PACKAGE_ID,
		MIST_PER_SUI,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		MINIMUM_PRIZE_AMOUNT,
		RANDOM_OBJECT_ID,
		CLOCK_OBJECT_ID
	} from '$lib/constants.js';

	const idle = new IsIdle({ timeout: 15000 });

	// Testnet Sui client for reading transaction details
	const testnetClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

	// State
	let entries = $state([
		'0x4e4ab932a358e66e79cce1d94457d50029af1e750482ca3619ea3dd41f1c62b4',
		'0x860de660df6f748354e7a6d44b36d302f9dbe70938b957837bf8556d258ca35f',
		'0xf4be218d73c57b9622de671b683221274f9f5a306a2825c470563249e2c718e5'
	]);

	// Blockchain setup state
	let packageId = $state(PACKAGE_ID);
	let prizeAmounts = $state(['']); // SUI amounts as strings (decimal supported)
	let delayMs = $state(0);
	let claimWindowMs = $state(1440); // 24 hours
	let setupLoading = $state(false);
	let setupError = $state('');
	let setupSuccessMsg = $state('');
	let createdWheelId = $state('');

	// finished wheelId: 0xa7196b65c4134e4a22dac5abb668269dfa8f6cb8c2578306d9a8fd931d8167bf
	// finished wheelId: 0xc7e2f2a1d0bd5e9d4584cd1b21be2052597856b91e57c3efc19bba08c8b5a006
	// not spin: 0x57012fe0a3d3f1d4e6eacb102dd39c4cea0ed7c9d8fa29d349aca309b783dd43

	// View/Edit and on-chain fetched state
	let isEditing = $state(false);
	let wheelFetched = $state(false);
	let wheelLoading = $state(false);
	let entriesOnChain = $state([]);
	let prizesOnChainMist = $state([]);
	let spunCountOnChain = $state(0);
	let delayMsOnChain = $state(0);
	let claimWindowMsOnChain = $state(0);
	let poolBalanceMistOnChain = $state(0n);
	let winnersOnChain = $state([]);
	let spinTimesOnChain = $state([]);
	let postSpinFetchRequested = $state(false);
	// Cancellation state
	let isCancelled = $state(false);

	// QR code for results link when wheel is finished
	let qrDataUrl = $state('');
	$effect(() => {
		try {
			if (createdWheelId && remainingSpins === 0 && typeof window !== 'undefined') {
				const url = `${window.location.origin}/wheel-result?wheelId=${createdWheelId}`;
				QRCode.toDataURL(url, { width: 220, margin: 1 })
					.then(u => (qrDataUrl = u))
					.catch(() => (qrDataUrl = ''));
			} else {
				qrDataUrl = '';
			}
		} catch {
			qrDataUrl = '';
		}
	});

	// Action loading states
	let updateLoading = $state(false);
	let cancelLoading = $state(false);

	// Compute additional SUI (in MIST) needed to top up the pool when editing
	let topUpMist = $derived.by(() => {
		try {
			const desired = prizeAmounts.reduce((acc, v) => acc + parseSuiToMist(v), 0n);
			const currentPool = poolBalanceMistOnChain || 0n;
			return desired > currentPool ? desired - currentPool : 0n;
		} catch {
			return 0n;
		}
	});
	let isOnTestnet = $derived.by(() => {
		// Treat as pending (true) until account and chain are resolved to avoid warning flicker
		if (!account.value) return true;
		const chain = account.value?.chains?.[0];
		if (!chain) return true;
		return chain === 'sui:testnet';
	});

	const spinAnimationConfig = {
		duration: 10000,
		extraTurnsMin: 6,
		extraTurnsMax: 10,
		marginFraction: 0.05,
		easePower: 3
	};

	// UI: active tab in settings (entries | prizes | others)
	let activeTab = $state('entries');

	let newEntry = $state('');
	let entriesText = $state('');
	let serverTargetIndex = $state(null);
	let spinning = $state(false);
	let muted = $state(false);
	let selectedIndex = $state(null);
	let spinAngle = $state(0); // radians
	let pointerIndex = $state(0);
	let pointerColor = $state('#ef4444');
	// If empty string -> auto color while spinning; if hex -> fixed color
	let pointerColorOverride = $state('');
	// Store last winner to display after removal
	let lastWinner = $state('');
	// Duplicate entries tracking
	let duplicateEntries = $state([]);
	// GSAP animation state
	let currentTween;
	// Idle rotation state
	let idleTween;
	const idleAnimState = { angle: 0 };
	const animState = { angle: 0 };

	let totalDonationMist = $derived.by(() => {
		try {
			return prizeAmounts.reduce((acc, v) => acc + parseSuiToMist(v), 0n);
		} catch {
			return 0n;
		}
	});

	// Remaining spins based on on-chain prizes and spun count
	let remainingSpins = $derived.by(() =>
		Math.max(0, (prizesOnChainMist.length || 0) - (spunCountOnChain || 0))
	);

	// Disable spin in both modes (off-chain and on-chain)
	let isSpinDisabled = $derived.by(() => {
		// On-chain: disable if no remaining spins
		if (createdWheelId) return isCancelled || remainingSpins === 0;
		// Off-chain: disable if wallet connected (requires on-chain flow) or not enough entries
		return (Boolean(account.value) && !createdWheelId) || entries.length < 2;
	});

	let invalidEntriesCount = $derived.by(() => {
		const lines = entries.map(s => String(s ?? '').trim()).filter(s => s.length > 0);
		return lines.filter(s => !isValidSuiAddress(s)).length;
	});

	let uniqueValidEntriesCount = $derived.by(() => {
		const valid = entries
			.map(s => String(s ?? '').trim())
			.filter(s => s.length > 0 && isValidSuiAddress(s))
			.map(s => s.toLowerCase());
		return new Set(valid).size;
	});

	let prizesCount = $derived.by(() => prizeAmounts.filter(v => parseSuiToMist(v) > 0n).length);

	let invalidPrizeAmountsCount = $derived.by(() => {
		return prizeAmounts.filter(v => {
			const mist = parseSuiToMist(v);
			return mist > 0n && mist < MINIMUM_PRIZE_AMOUNT.MIST;
		}).length;
	});

	let hasInsufficientBalance = $derived.by(() => {
		// Do not warn about balance until wallet and balance are fully loaded
		if (!account.value) return false;
		if (suiBalanceLoading?.value) return false;
		try {
			return suiBalance.value - 1_000_000_000 < totalDonationMist;
		} catch {
			return false;
		}
	});

	// Consolidated warnings visibility
	let hasSetupWarnings = $derived.by(
		() =>
			invalidEntriesCount > 0 ||
			uniqueValidEntriesCount < 2 ||
			prizesCount === 0 ||
			prizesCount > uniqueValidEntriesCount ||
			invalidPrizeAmountsCount > 0 ||
			entries.length > 200 ||
			hasInsufficientBalance ||
			!isOnTestnet
	);

	// Final condition to show setup warnings
	let shouldShowSetupWarnings = $derived.by(() => {
		return hasSetupWarnings && ((isEditing && createdWheelId) || !createdWheelId);
	});

	function addPrize() {
		prizeAmounts = [...prizeAmounts, ''];
	}

	function removePrize(idx) {
		if (prizeAmounts.length <= 1) return;
		prizeAmounts = prizeAmounts.filter((_, i) => i !== idx);
	}

	function updatePrizeAmount(index, value) {
		prizeAmounts = prizeAmounts.map((v, i) => (i === index ? value : v));
	}

	function handlePrizeKeydown(index, e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addPrize();
			setTimeout(() => {
				const els = document.querySelectorAll('.prize-input');
				const el = els[els.length - 1];
				if (el && typeof el.focus === 'function') el.focus();
			}, 0);
		}
	}

	function getAddressEntries() {
		return entries
			.map(s => String(s ?? '').trim())
			.filter(s => s.length > 0 && isValidSuiAddress(s));
	}

	function validateSetup() {
		const errors = [];
		if (!account.value) errors.push('Wallet is not connected.');
		if (!isOnTestnet) errors.push('Wallet must be on Testnet.');
		if (!packageId || packageId.trim().length === 0) errors.push('Package ID is required.');
		const addrList = getAddressEntries();
		if (addrList.length < 2) errors.push('At least 2 valid addresses are required.');
		if (addrList.length > 200) errors.push('Entries count must be ≤ 200.');
		const prizesCount = prizeAmounts.filter(v => parseSuiToMist(v) > 0n).length;
		if (prizesCount === 0) errors.push('Please add at least 1 prize with amount > 0.');
		if (addrList.length < prizesCount)
			errors.push('Number of entries must be >= number of prizes.');
		// unique addresses check
		const uniqueCount = new Set(addrList.map(a => a.toLowerCase())).size;
		if (uniqueCount < prizesCount) errors.push('Unique address count must be >= number of prizes.');
		// Check minimum prize amount
		const invalidPrizes = prizeAmounts.filter(v => {
			const mist = parseSuiToMist(v);
			return mist > 0n && mist < MINIMUM_PRIZE_AMOUNT.MIST;
		});
		if (invalidPrizes.length > 0) {
			errors.push(`Each prize must be at least ${MINIMUM_PRIZE_AMOUNT.SUI} SUI.`);
		}
		return errors;
	}

	async function createWheelAndFund() {
		setupError = '';
		setupSuccessMsg = '';
		const errors = validateSetup();
		if (errors.length) {
			setupError = errors.join('\n');
			return;
		}
		setupLoading = true;
		try {
			const addrList = getAddressEntries();
			const prizeMistList = prizeAmounts.map(v => parseSuiToMist(v)).filter(v => v > 0n);
			const total = totalDonationMist;
			if (total <= 0n) throw new Error('Total donation must be greater than 0');

			// Combine into a single PTB
			const tx = new Transaction();

			// Split the donation coin from gas first
			const [donationCoin] = tx.splitCoins(tx.gas, [total]);

			// Call create_wheel and capture the returned Wheel
			const wheel = tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CREATE}`,
				arguments: [
					tx.pure.vector('address', addrList),
					tx.pure.vector('u64', prizeMistList),
					tx.pure.u64(BigInt(Number(delayMs || 0)) * 60000n),
					tx.pure.u64(BigInt(Number(claimWindowMs || 0)) * 60000n)
				]
			});

			// Call donate_to_pool using the wheel (as mutable ref) and donationCoin
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
				arguments: [wheel, donationCoin]
			});

			// Share the wheel object using the new share_wheel function
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::share_wheel`,
				arguments: [wheel]
			});

			// Sign and execute the combined PTB
			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Failed to get transaction digest');

			// Fetch transaction block to get the created Wheel object ID
			const txBlock = await testnetClient.getTransactionBlock({
				digest,
				options: { showObjectChanges: true }
			});
			const created = (txBlock?.objectChanges || []).find(
				ch =>
					ch.type === 'created' && String(ch.objectType || '').endsWith(`::${WHEEL_MODULE}::Wheel`)
			);

			const finalWheelId = created?.objectId;
			if (!finalWheelId) throw new Error('Wheel object id not found after creation');
			createdWheelId = finalWheelId;

			// Immediately fetch on-chain data to populate UI
			await fetchWheelFromChain();

			setupSuccessMsg = `Successfully created and funded. We can spin it now.`;

			// Notify and update current URL with wheelId param so reload keeps context
			toast.success('Wheel created and funded successfully', {
				position: 'bottom-right',
				durationMs: 5000,
				button: {
					text: 'View Tx',
					class: 'btn btn-primary btn-sm',
					callback: () => {
						window.open(`https://testnet.suivision.xyz/txblock/${digest}`, '_blank', 'noopener');
					}
				}
			});
			goto(`?wheelId=${finalWheelId}`, { replaceState: true, keepfocus: true, noScroll: true });
		} catch (e) {
			setupError = e?.message || String(e);
			toast.error(setupError || 'Failed to create wheel', { position: 'bottom-right' });
		} finally {
			setupLoading = false;
		}
	}

	/**
	 * Fetch wheel data from testnet by createdWheelId and populate read-only state
	 */
	async function fetchWheelFromChain() {
		if (!createdWheelId) return;
		try {
			wheelLoading = true;
			const res = await testnetClient.getObject({
				id: createdWheelId,
				options: { showContent: true, showOwner: true, showType: true }
			});
			const content = res?.data?.content;
			if (!content || content?.dataType !== 'moveObject') return;
			const f = content.fields || {};

			// Cancellation flag
			isCancelled = Boolean(f['is_cancelled']);

			// Entries (addresses)
			entriesOnChain = (f['remaining_entries'] || []).map(v => String(v));

			// Prizes (mist amounts)
			prizesOnChainMist = (f['prize_amounts'] || []).map(v => {
				try {
					return BigInt(v);
				} catch {
					return 0n;
				}
			});

			// Winners list
			winnersOnChain = (f['winners'] || []).map(w => ({
				addr: String(w?.fields?.addr ?? w?.addr ?? ''),
				prize_index: Number(w?.fields?.prize_index ?? w?.prize_index ?? 0),
				claimed: Boolean(w?.fields?.claimed ?? w?.claimed ?? false)
			}));

			// Spin times (ms since epoch) aligned with prize indices
			try {
				spinTimesOnChain = (f['spin_times'] || []).map(v => Number(v));
			} catch {
				spinTimesOnChain = [];
			}

			// Spun count and Delay / ClaimWindow (ms -> minutes)
			try {
				spunCountOnChain = Number(f['spun_count'] || 0);
			} catch {
				spunCountOnChain = 0;
			}
			const delayMsRaw = Number(f['delay_ms']);
			delayMsOnChain = Math.max(0, Math.round(delayMsRaw / 60000));

			const claimRaw = Number(f['claim_window_ms']);
			claimWindowMsOnChain = Math.max(0, Math.round(claimRaw / 60000));

			// Pool balance
			let poolMist = 0n;
			const poolCandidates = ['pool'];
			for (const k of poolCandidates) {
				const v = f['pool'];
				if (v == null) continue;
				try {
					if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') {
						poolMist = BigInt(v);
						break;
					}
					if (typeof v === 'object') {
						const val =
							v?.fields?.balance?.fields?.value ?? v?.fields?.value ?? v?.value ?? v?.balance;
						if (val != null) {
							poolMist = BigInt(val);
							break;
						}
					}
				} catch {}
			}
			poolBalanceMistOnChain = poolMist;

			// Sync form states for edit mode convenience
			entriesText = entriesOnChain.join('\n');
			entries = [...entriesOnChain];
			prizeAmounts = prizesOnChainMist.map(m => formatMistToSuiCompact(m));
			delayMs = delayMsOnChain;
			claimWindowMs = claimWindowMsOnChain;

			wheelFetched = true;
		} catch (e) {
			console.error('Failed to fetch wheel:', e);
		} finally {
			wheelLoading = false;
		}
	}

	async function updateWheel() {
		if (!createdWheelId) return;
		updateLoading = true;
		setupError = '';
		try {
			// Top up only if needed
			if (topUpMist > 0n) {
				const tx = new Transaction();
				const [coin] = tx.splitCoins(tx.gas, [topUpMist]);
				tx.moveCall({
					target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
					arguments: [tx.object(createdWheelId), coin]
				});
				await signAndExecuteTransaction(tx);
			}
			setupSuccessMsg = 'Wheel updated successfully.';
			isEditing = false;
			await fetchWheelFromChain();
		} catch (e) {
			setupError = e?.message || String(e);
		} finally {
			updateLoading = false;
		}
	}

	async function cancelWheel() {
		if (!createdWheelId) return;
		cancelLoading = true;
		setupError = '';
		try {
			const tx = new Transaction();

			// Get mutable ref to Wheel
			const wheelRef = tx.object(createdWheelId);

			// Call cancel_wheel_and_reclaim_pool and capture the optional Coin
			const optCoin = tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::cancel_wheel_and_reclaim_pool`,
				arguments: [wheelRef]
			});

			// Handle the optional reclaim by transferring to sender if present
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::transfer_optional_reclaim`,
				arguments: [optCoin, tx.pure.address(account.value.address)] // Assume walletAddress is the connected organizer's address
			});

			// Sign and execute the PTB
			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) {
				setupError = 'Failed to cancel wheel.';
				toast.error(setupError || 'Failed to cancel wheel.', { position: 'bottom-right' });
				return;
			}
			setupSuccessMsg = 'Wheel cancelled and pool reclaimed if any.';
			toast.success('Wheel cancelled successfully.', {
				position: 'bottom-right',
				durationMs: 3000,
				button: {
					text: 'View Tx',
					class: 'btn btn-primary btn-sm',
					callback: () => {
						window.open(`https://testnet.suivision.xyz/txblock/${digest}`, '_blank', 'noopener');
					}
				}
			});
			// Reset local state
			createdWheelId = '';
			wheelFetched = false;
			entriesOnChain = [];
			prizesOnChainMist = [];
			poolBalanceMistOnChain = 0n;
		} catch (e) {
			setupError = e?.message || String(e);
		} finally {
			cancelLoading = false;
		}
	}

	// Precomputed label layouts to avoid per-frame text measurement
	let labelLayouts = $state([]); // [{ displayText: string, font: string }] aligned with entries

	/** Canvas and layout refs */
	let canvasEl = $state(null);
	let canvasContainerEl = $state(null);
	let entriesTextareaEl = $state(null);
	let ctx;
	let wheelSize = $state(0); // CSS px size (square)
	// Offscreen canvas for pre-rendering the wheel
	let offscreenCanvas;
	let offscreenCtx;

	/** Audio */
	let winAudio;

	/** Modal */
	let winnerModal = $state(null);

	// Angle tracking for multi-crossing detection
	let lastAngle = 0;
	onMount(() => {
		winAudio = new Audio('/crowd-reaction.mp3');
		winAudio.preload = 'auto';
		winAudio.volume = 0.5;
	});

	watch(
		() => entries,
		() => {
			recomputeLabelLayouts();
			renderWheelBitmap();
			drawStaticWheel();
			updatePointerColor();
			updateDuplicateEntries();
		}
	);

	/** Resize handling */
	let resizeObserver;
	function setupCanvas() {
		if (!canvasEl || !canvasContainerEl) return;
		const dpr = Math.max(1, window.devicePixelRatio || 1);
		const size = Math.min(canvasContainerEl.clientWidth, 560);
		const newWidth = Math.floor(size * dpr);
		const newHeight = Math.floor(size * dpr);

		//canvas size unchanged, skipping resize
		if (newWidth === canvasEl.width && newHeight === canvasEl.height) {
			return;
		}
		wheelSize = size;

		canvasEl.style.width = `${size}px`;
		canvasEl.style.height = `${size}px`;
		canvasEl.width = newWidth;
		canvasEl.height = newHeight;
		ctx = canvasEl.getContext('2d');
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		// initialize offscreen canvas for static wheel bitmap
		offscreenCanvas = document.createElement('canvas');
		offscreenCanvas.width = newWidth;
		offscreenCanvas.height = newHeight;
		offscreenCtx = offscreenCanvas.getContext('2d');
		offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
		offscreenCtx.imageSmoothingEnabled = true;
		offscreenCtx.imageSmoothingQuality = 'high';

		recomputeLabelLayouts();
		renderWheelBitmap();
		drawStaticWheel();
		if (canvasEl) {
			canvasEl.style.transform = `rotate(${spinAngle}rad)`;
		}
		updatePointerColor();

		// start idle rotation when not spinning
		startIdleRotationIfNeeded();
	}

	onMount(() => {
		resizeObserver = new ResizeObserver(() => setupCanvas());
		if (canvasContainerEl) resizeObserver.observe(canvasContainerEl);
		setupCanvas();
		if (canvasEl) {
			canvasEl.style.willChange = 'transform';
			canvasEl.style.transformOrigin = '50% 50%';
			canvasEl.style.backfaceVisibility = 'hidden';
		}
		// Also fetch wheel data if an id is preset
		// Try to read wheelId from URL to restore state on reload
		try {
			const params = new URLSearchParams(window.location.search);
			const w = params.get('wheelId');
			if (w && !createdWheelId) createdWheelId = w;
		} catch {}
		if (createdWheelId) {
			fetchWheelFromChain();
		}
	});

	onDestroy(() => {
		if (resizeObserver && canvasContainerEl) resizeObserver.unobserve(canvasContainerEl);
		// Kill GSAP tween on destroy to avoid leaks
		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}
	});

	/** Drawing */
	const segmentColors = [
		'#22c55e', // green-500
		'#f59e0b', // amber-500
		'#3b82f6', // blue-500
		'#ef4444', // red-500
		'#14b8a6', // teal-500
		'#a855f7', // purple-500
		'#eab308', // yellow-500
		'#06b6d4' // cyan-500
	];

	let lastTickIndex = null;

	function mod(v, n) {
		return ((v % n) + n) % n;
	}

	function fireTickForIndex(idx) {
		// console.log('Pointer passed entry:', entries[idx]);
	}

	function updatePointerColor() {
		const n2 = Math.max(1, entries.length);
		const arc2 = (Math.PI * 2) / n2;
		const normalized = (((Math.PI / 2 - spinAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
		const newIndex = Math.floor(normalized / arc2) % n2;

		// update color (fixed override if provided)
		if (pointerColorOverride && pointerColorOverride.trim() !== '') {
			pointerColor = pointerColorOverride.trim();
		} else {
			pointerColor = segmentColors[newIndex % segmentColors.length];
		}

		// No tick calculation if not spinning
		if (!spinning) {
			pointerIndex = newIndex;
			lastTickIndex = newIndex;
			lastAngle = spinAngle;
			return;
		}

		// Compute angle delta for direction and multi-crossing detection
		const deltaAngle = spinAngle - lastAngle; // rad

		// Initialize lastTickIndex on spin start
		if (lastTickIndex === null) {
			lastTickIndex = newIndex;
			lastAngle = spinAngle;
			pointerIndex = newIndex;
			return;
		}

		if (newIndex !== lastTickIndex && deltaAngle !== 0) {
			// Determine traversal direction: angle increases => pointer index decreases
			const dir = deltaAngle > 0 ? -1 : 1;
			// How many segment boundaries passed this frame along that direction
			const steps = dir > 0 ? mod(newIndex - lastTickIndex, n2) : mod(lastTickIndex - newIndex, n2);

			const MAX_TICKS_PER_FRAME = 12;
			const toFire = Math.min(steps, MAX_TICKS_PER_FRAME);

			for (let i = 0; i < toFire; i++) {
				lastTickIndex = mod(lastTickIndex + dir, n2);
				fireTickForIndex(lastTickIndex);
			}
		}

		pointerIndex = newIndex;
		lastAngle = spinAngle;
	}

	function renderWheelBitmap() {
		if (!offscreenCtx || !wheelSize) return;

		const n = Math.max(1, entries.length);
		const radius = wheelSize / 2;
		const centerX = radius;
		const centerY = radius;
		const arc = (Math.PI * 2) / n;

		const ctx2 = offscreenCtx;
		ctx2.clearRect(0, 0, wheelSize, wheelSize);

		ctx2.save();
		const baseStart = -Math.PI / 2; // start at top
		for (let i = 0; i < n; i++) {
			const start = baseStart + i * arc;
			const end = start + arc;
			ctx2.beginPath();
			ctx2.moveTo(centerX, centerY);
			ctx2.arc(centerX, centerY, radius - 4, start, end);
			ctx2.closePath();
			ctx2.fillStyle = segmentColors[i % segmentColors.length];
			ctx2.fill();

			// Separator line
			ctx2.strokeStyle = 'rgba(0,0,0,0.06)';
			ctx2.lineWidth = 2;
			ctx2.stroke();

			// Label rendering
			const mid = (start + end) / 2;
			const raw = String(entries[i]).trim();
			const label = isValidSuiAddress(raw) ? shortenAddress(raw) : raw;
			if (!label) continue;

			const innerRadius = Math.max(30, radius * 0.2);
			const outerRadius = radius - 10;
			const available = outerRadius - innerRadius;
			const padding = 10;
			const layout = labelLayouts[i];
			if (layout && layout.displayText) {
				ctx2.font = layout.font;
				ctx2.fillStyle = '#111827';
				ctx2.textAlign = 'right';
				ctx2.textBaseline = 'middle';
				ctx2.save();
				ctx2.translate(centerX, centerY);
				ctx2.rotate(mid);
				ctx2.fillText(layout.displayText, innerRadius + available - padding, 0);
				ctx2.restore();
			}
		}

		// Center circle
		ctx2.beginPath();
		ctx2.arc(centerX, centerY, Math.max(22, radius * 0.08), 0, Math.PI * 2);
		ctx2.fillStyle = '#ffffff';
		ctx2.fill();

		ctx2.restore();
	}

	function drawStaticWheel() {
		if (!ctx || !wheelSize) return;
		ctx.clearRect(0, 0, wheelSize, wheelSize);
		if (offscreenCanvas) {
			ctx.drawImage(
				offscreenCanvas,
				0,
				0,
				offscreenCanvas.width,
				offscreenCanvas.height,
				0,
				0,
				wheelSize,
				wheelSize
			);
		}
	}

	// Idle rotation helpers
	function startIdleRotationIfNeeded() {
		if (spinning || currentTween || idleTween || !idle.current) return;
		// sync starting angle
		idleAnimState.angle = spinAngle;
		idleTween = gsap.to(idleAnimState, {
			angle: idleAnimState.angle + Math.PI * 2,
			duration: 40,
			ease: 'linear',
			repeat: -1,
			onUpdate: () => {
				if (!spinning && !currentTween) {
					spinAngle = idleAnimState.angle;
					if (canvasEl) canvasEl.style.transform = `rotate(${spinAngle}rad)`;
				}
			}
		});
	}

	function stopIdleRotation() {
		if (idleTween) {
			idleTween.kill();
			idleTween = null;
		}
	}

	function recomputeLabelLayouts() {
		const measureCtx = offscreenCtx || ctx;
		if (!measureCtx || !wheelSize) {
			labelLayouts = [];
			return;
		}
		const n = Math.max(1, entries.length);
		const radius = wheelSize / 2;
		const arc = (Math.PI * 2) / n;
		const innerRadius = Math.max(30, radius * 0.2);
		const outerRadius = radius - 10;
		const available = outerRadius - innerRadius;
		const padding = 10;
		const maxWidth = Math.max(0, available - padding);

		const layouts = new Array(n);
		for (let i = 0; i < n; i++) {
			const raw = String(entries[i] ?? '').trim();
			const baseLabel = isValidSuiAddress(raw) ? shortenAddress(raw) : raw;
			if (!baseLabel) {
				layouts[i] = { displayText: '', font: '' };
				continue;
			}
			const arcDegrees = (arc * 180) / Math.PI;
			let fontSize = Math.max(9, Math.min(17, arcDegrees * 0.75));
			let displayText = baseLabel;
			let font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;
			measureCtx.font = font;
			let measured = measureCtx.measureText(displayText).width;
			if (measured > maxWidth && maxWidth > 0) {
				const scale = maxWidth / measured;
				fontSize = Math.max(9, Math.floor(fontSize * scale));
				font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;
				measureCtx.font = font;
				measured = measureCtx.measureText(displayText).width;
			}
			if (measured > maxWidth && maxWidth > 0) {
				const ellipsis = '…';
				while (
					displayText.length > 1 &&
					measureCtx.measureText(displayText + ellipsis).width > maxWidth
				) {
					displayText = displayText.slice(0, -1);
				}
				displayText += ellipsis;
			}
			layouts[i] = { displayText, font };
		}
		labelLayouts = layouts;
	}

	/** Spin logic */
	function getGsapEaseFromPower(power = 4) {
		const p = Math.max(1, Math.min(4, Math.floor(Number(power) || 4)));
		return `power${p}.out`;
	}

	function normalizeAngle(radians) {
		const tau = Math.PI * 2;
		return ((radians % tau) + tau) % tau;
	}

	function pickSelectedIndex() {
		const n = Math.max(1, entries.length);
		const arc = (Math.PI * 2) / n;
		// Pointer at right (0 rad) stable after spin
		const normalized = (((Math.PI / 2 - spinAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
		const idx = Math.floor(normalized / arc) % n;
		return idx;
	}

	async function spinOnChainAndAnimate() {
		if (!createdWheelId || spinning || isCancelled) return;
		if (!account.value) return;
		try {
			// Mark as busy while the transaction is pending
			spinning = true;
			// call move function spin_wheel
			const tx = new Transaction();
			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.SPIN}`,
				arguments: [
					tx.object(createdWheelId),
					tx.object(RANDOM_OBJECT_ID),
					tx.object(CLOCK_OBJECT_ID)
				]
			});
			const res = await signAndExecuteTransaction(tx);
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Missing tx digest for spin');

			// Try to read SpinEvent from the transaction to get the exact winner and prize index
			let targetIdx = -1;
			try {
				const txBlock = await testnetClient.getTransactionBlock({
					digest,
					options: { showEvents: true }
				});
				const spinEventType = `${packageId}::${WHEEL_MODULE}::SpinEvent`;
				const ev = (txBlock?.events || []).find(e => {
					const t = String(e?.type || '');
					return t === spinEventType || t.endsWith(`::${WHEEL_MODULE}::SpinEvent`);
				});
				const parsed = ev?.parsedJson || {};
				const winnerAddr = String(
					parsed?.winner ?? parsed?.winner_address ?? parsed?.winnerAddress ?? ''
				).toLowerCase();
				if (winnerAddr) {
					targetIdx = entries.findIndex(a => String(a ?? '').toLowerCase() === winnerAddr);
				}
			} catch {}

			if (
				!Number.isFinite(targetIdx) ||
				targetIdx < 0 ||
				targetIdx >= Math.max(1, entries.length)
			) {
				// Fallback to a random index if event parsing fails
				targetIdx = Math.floor(Math.random() * Math.max(1, entries.length));
			}

			// Fetch on-chain data after animation completes to avoid flicker
			postSpinFetchRequested = true;
			// Release busy flag so spinToIndex can start the animation
			spinning = false;
			spinToIndex(targetIdx, spinAnimationConfig);
		} catch (e) {
			setupError = e?.message || String(e);
			spinning = false;
		}
	}

	function spin() {
		if (spinning || entries.length < 2) return;
		// Guard: in blockchain mode require created wheel id
		if (account.value && !createdWheelId) return;
		const n = Math.max(1, entries.length);
		const idxValue = serverTargetIndex;
		if (Number.isFinite(idxValue) && idxValue >= 0 && idxValue < n) {
			spinToIndex(Math.floor(idxValue), spinAnimationConfig);
			return;
		}
		const randomIndex = Math.floor(Math.random() * n);
		spinToIndex(randomIndex, spinAnimationConfig);
	}

	function spinToIndex(targetIndex, opts = {}) {
		const n = Math.max(1, entries.length);
		if (spinning || n < 1) return;
		const idx = Math.max(0, Math.min(n - 1, Number(targetIndex) | 0));
		spinning = true;
		selectedIndex = null;
		// reset tick tracker for this spin
		lastTickIndex = null;

		const startAngle = spinAngle;
		// sync angle for high-speed tick detection right at spin start
		lastAngle = startAngle;
		const arc = (Math.PI * 2) / n;
		// Choose a random angle within the target segment (uniform, avoid edges)
		const marginFraction = Math.max(0, Math.min(0.49, opts.marginFraction ?? 0.05));
		const margin = arc * marginFraction;
		const innerWidth = Math.max(0, arc - 2 * margin);
		const randomWithin = margin + Math.random() * innerWidth;
		const targetTheta = idx * arc + randomWithin;
		const baseAligned = normalizeAngle(Math.PI / 2 - targetTheta);

		const extraTurnsMin = opts.extraTurnsMin ?? 5;
		const extraTurnsMax = opts.extraTurnsMax ?? 7;
		const duration = opts.duration ?? 5200; // ms
		const extraTurnsFloat =
			extraTurnsMin + Math.random() * Math.max(0, extraTurnsMax - extraTurnsMin);
		const extraTurns = Math.max(0, Math.ceil(extraTurnsFloat)); // ensure integer full turns for exact alignment

		const tau = Math.PI * 2;
		const kBase = Math.ceil((startAngle - baseAligned) / tau);
		const targetAngle = baseAligned + (kBase + extraTurns) * tau;

		// Kill any running tween
		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}
		// stop idle rotation when starting a spin
		stopIdleRotation();
		// Sync animState with current angle
		animState.angle = startAngle;
		// Start GSAP tween
		currentTween = gsap.to(animState, {
			angle: targetAngle,
			duration: duration / 1000,
			ease: getGsapEaseFromPower(opts.easePower ?? 4),
			onUpdate: () => {
				spinAngle = animState.angle;
				if (canvasEl) {
					canvasEl.style.transform = `rotate(${spinAngle}rad)`;
				}
				updatePointerColor();
			},
			onComplete: () => {
				currentTween = null;
				spinning = false;
				selectedIndex = pickSelectedIndex();
				updatePointerColor();
				if (!muted && winAudio) {
					try {
						winAudio.currentTime = 0;
						winAudio.play();
					} catch {}
				}
				// capture winner and remove from list
				const winnerIndex = selectedIndex;
				const winnerValue = entries[winnerIndex];
				lastWinner = String(winnerValue ?? '');
				if (lastWinner) {
					// do not remove winner from list if fetch is requested
					if (!postSpinFetchRequested) {
						entries = entries.filter(
							entry => String(entry ?? '').trim() !== String(winnerValue ?? '').trim()
						);
						entriesText = entries.join('\n');
					}
					selectedIndex = null;
					spinAngle = 0;
					// show winner modal
					if (winnerModal && !winnerModal.open) winnerModal.showModal();
				}
				// Fetch wheel data if requested
				if (postSpinFetchRequested) {
					postSpinFetchRequested = false;
					fetchWheelFromChain();
				}
			}
		});
	}

	function spinToValue(value, opts = {}) {
		const v = String(value ?? '').trim();
		if (!v) return;
		const idx = entries.findIndex(e => String(e ?? '').trim() === v);
		if (idx === -1) return;
		spinToIndex(idx, opts);
	}

	function shuffle() {
		if (entries.length < 2) return;
		if (spinning) return;
		selectedIndex = null;
		entries = [...entries].sort(() => Math.random() - 0.5);
		entriesText = entries.join('\n');
	}

	function clearAll() {
		if (spinning) return;
		entriesText = '';
		entries = [];
		selectedIndex = null;
		spinAngle = 0;
	}

	function arraysShallowEqual(a, b) {
		// Compare two string arrays by value and order
		if (a === b) return true;
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	function onEntriesTextChange(text) {
		if (spinning) return;
		const list = text
			.split('\n')
			.map(s => s.trim())
			.filter(s => s.length > 0);
		if (arraysShallowEqual(entries, list)) {
			return;
		}
		entries = list;
		selectedIndex = null;
		spinAngle = 0;
	}

	function updateDuplicateEntries() {
		const entryCount = {};
		entries.forEach(entry => {
			const trimmed = entry.trim();
			if (trimmed) {
				entryCount[trimmed] = (entryCount[trimmed] || 0) + 1;
			}
		});

		// Filter entries that appear more than once
		const duplicates = Object.entries(entryCount)
			.filter(([entry, count]) => count > 1)
			.map(([entry, count]) => ({ entry, count }))
			.sort((a, b) => b.count - a.count); // Sort by count descending

		duplicateEntries = duplicates;
	}

	$effect(() => {
		// If the entries textarea is focused, don't overwrite user edits
		if (!entriesTextareaEl || document.activeElement !== entriesTextareaEl) {
			entriesText = entries.join('\n');
		}
	});

	$effect(() => {
		// Keep CSS transform in sync when not animating (e.g., after reset)
		void spinAngle;
		if (!spinning && canvasEl) {
			canvasEl.style.transform = `rotate(${spinAngle}rad)`;
			updatePointerColor();
		}
	});

	$effect(() => {
		// Auto rotate wheel when user is idle
		if (idle.current) {
			startIdleRotationIfNeeded();
		} else {
			stopIdleRotation();
		}
	});
</script>

{#snippet showDuplicateEntries()}
	{#if duplicateEntries.length > 0}
		<div class="mt-4">
			<h4 class="text-base-content/70 mb-2 text-sm font-semibold">Duplicate Entries:</h4>
			<div class="bg-base-300 max-h-32 overflow-y-auto rounded-lg p-2">
				{#each duplicateEntries as duplicate}
					<div class="flex items-center justify-between gap-2 text-sm">
						<span class="flex-1 truncate font-medium">
							{isValidSuiAddress(duplicate.entry)
								? shortenAddress(duplicate.entry)
								: duplicate.entry}
						</span>
						<span class="badge badge-secondary badge-sm">{duplicate.count}x</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

<section class="container mx-auto px-4 py-6">
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="w-full">
			<div class="relative mx-auto max-w-[560px]">
				<div class="rounded-box bg-base-200 p-3 shadow">
					<div
						bind:this={canvasContainerEl}
						class="border-base-300 relative mx-auto aspect-square w-full rounded-full border-1 shadow-lg"
					>
						<!-- Voice toggle icon in top-right corner -->
						<button
							class="btn btn-circle btn-sm tooltip absolute top-2 right-2 z-20 bg-white/90 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white"
							onclick={() => (muted = !muted)}
							aria-label={muted ? 'Enable sound' : 'Disable sound'}
							title={muted ? 'Enable sound' : 'Disable sound'}
							data-tip={muted ? 'Enable sound' : 'Disable sound'}
						>
							{#if muted}
								<span class="icon-[lucide--volume-off] text-base text-gray-600"></span>
							{:else}
								<span class="icon-[lucide--volume-2] text-base text-gray-700"></span>
							{/if}
						</button>
						<div
							class="pointer-events-none absolute top-1/2 -right-6 z-10 -translate-y-1/2"
							aria-hidden="true"
						>
							<!-- Outline triangle to create a subtle white border for contrast -->
							<div
								class="h-0 w-0 border-y-[24px] border-r-[48px] border-y-transparent"
								style="border-right-color: #ffffff; filter: drop-shadow(0 0 6px rgba(0,0,0,0.12)); transform: translateX(6px)"
							></div>

							<!-- Colored pointer on top of outline -->
							<div
								class="absolute top-1/2 right-0 h-0 w-0 -translate-y-1/2 border-y-[20px] border-r-[40px] border-y-transparent"
								style={`border-right-color: ${pointerColor}; filter: drop-shadow(0 0 12px ${pointerColor}80)`}
							></div>
						</div>
						<canvas bind:this={canvasEl} class="rounded-box pointer-events-none mx-auto block"
						></canvas>

						<!-- Centered Spin Button overlay -->
						<div
							class="pointer-events-none absolute top-1/2 left-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
						>
							<ButtonLoading
								formLoading={spinning}
								color="primary"
								loadingText="Spinning..."
								onclick={createdWheelId ? spinOnChainAndAnimate : spin}
								aria-label="Spin the wheel"
								moreClass="w-full h-full rounded-full bg-white text-black pointer-events-auto animate-pulse shadow-lg"
								disabled={isSpinDisabled}
							>
								Spin
							</ButtonLoading>
						</div>
					</div>

					{#if selectedIndex !== null && entries[selectedIndex]}
						<div class="mt-3 text-center">
							<div class="badge badge-lg badge-success animate-pulse">🎯 Winner</div>
							<div
								class="text-success bg-success/10 border-success/20 mt-2 rounded-lg border px-4 py-2 text-lg font-bold break-words"
							>
								{entries[selectedIndex]}
							</div>
						</div>
					{/if}

					{#if createdWheelId}
						<div class="mt-4 flex justify-center">
							<div
								class="badge badge-lg badge-primary rounded px-2 py-1 text-center text-xs font-medium shadow"
							>
								Remaining spins: {Math.max(
									0,
									(prizesOnChainMist.length || 0) - (spunCountOnChain || 0)
								)}
							</div>
						</div>
					{/if}

					<!-- Wheel control buttons -->
					<div class="mt-4 flex flex-wrap justify-center gap-2">
						<button
							class="btn btn-outline"
							class:btn-disabled={spinning || entries.length < 2}
							disabled={spinning || entries.length < 2}
							onclick={shuffle}
							aria-label="Shuffle entries">Shuffle</button
						>
						{#if !createdWheelId}
							<button class="btn btn-warning" disabled={spinning} onclick={clearAll}>Clear</button>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div class="w-full">
			<div class="card bg-base-200 shadow">
				<div class="card-body">
					<!-- Header actions for view/edit -->
					{#if createdWheelId && wheelFetched}
						<div class="mb-3 flex items-center justify-between gap-2">
							<div class="flex items-center gap-2 text-sm opacity-70">
								<span
									>Wheel ID: <span class="font-mono">{shortenAddress(createdWheelId)}</span></span
								>
								{#if remainingSpins === 0}
									<span class="badge badge-neutral badge-sm">Finished</span>
								{/if}
								{#if isCancelled}
									<span class="badge badge-warning badge-sm">Cancelled</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								{#if remainingSpins === 0}
									<button
										class="btn btn-primary btn-sm"
										onclick={() => {
											// reset to create new wheel
											createdWheelId = '';
											isEditing = false;
											wheelFetched = false;
											entriesText = '';
											entries = [];
											entriesOnChain = [];
											prizeAmounts = [];
											prizesOnChainMist = [];
											winnersOnChain = [];
											spunCountOnChain = 0;
											poolBalanceMistOnChain = 0n;
											goto('/');
										}}>New wheel</button
									>
								{:else}
									{#if isEditing}
										<ButtonLoading
											formLoading={updateLoading}
											color="primary"
											loadingText="Updating..."
											onclick={updateWheel}>Update wheel</ButtonLoading
										>
										<button
											class="btn"
											onclick={() => (isEditing = false)}
											disabled={spunCountOnChain > 0}>Cancel edit</button
										>
									{:else}
										<!-- <button
											class="btn btn-sm btn-outline"
											onclick={() => (isEditing = true)}
											disabled={spunCountOnChain > 0 || isCancelled}>Edit wheel</button
										> -->
									{/if}
									{#if isCancelled}
										<!-- If cancelled, hide Cancel button and show New wheel instead -->
										<button
											class="btn btn-primary btn-sm"
											onclick={() => {
												createdWheelId = '';
												isEditing = false;
												wheelFetched = false;
												entriesText = '';
												entries = [];
												entriesOnChain = [];
												prizeAmounts = [];
												prizesOnChainMist = [];
												winnersOnChain = [];
												spunCountOnChain = 0;
												poolBalanceMistOnChain = 0n;
												goto('/');
											}}>New wheel</button
										>
									{:else}
										<ButtonLoading
											formLoading={cancelLoading}
											color="error"
											loadingText="Cancelling..."
											onclick={cancelWheel}
											disabled={spunCountOnChain > 0}>Cancel wheel</ButtonLoading
										>
									{/if}
								{/if}
							</div>
						</div>
					{/if}

					{#if createdWheelId && !wheelFetched && !isEditing}
						<!-- Loading state to avoid flicker before on-chain data replaces off-chain forms -->
						<div class="space-y-3">
							<div class="skeleton h-8 w-40"></div>
							<div class="skeleton h-32 w-full"></div>
							<div class="skeleton h-8 w-56"></div>
						</div>
					{:else}
						<!-- Tabs -->
						<div class="tabs tabs-lift">
							<input
								type="radio"
								name="wheel_tabs"
								class="tab"
								aria-label="Entries"
								checked={activeTab === 'entries'}
								onclick={() => (activeTab = 'entries')}
							/>
							<div class="tab-content bg-base-100 border-base-300 p-6">
								<h3 class="mb-4 text-lg font-semibold">Entries ({entriesOnChain.length})</h3>

								{#if createdWheelId && wheelFetched && !isEditing}
									{#if entriesOnChain.length > 0}
										<div class="overflow-x-auto">
											<table class="table-zebra table">
												<thead>
													<tr>
														<th>#</th>
														<th>Address</th>
													</tr>
												</thead>
												<tbody>
													{#each entriesOnChain as addr, i}
														<tr>
															<td class="w-12">{i + 1}</td>
															<td class="font-mono">{shortenAddress(String(addr))}</td>
														</tr>
													{/each}
												</tbody>
											</table>

											{@render showDuplicateEntries()}
										</div>
									{:else}
										<div class="text-center text-sm text-gray-500">No entries</div>
									{/if}
								{:else}
									<textarea
										class="textarea h-48 w-full text-base"
										placeholder="One entry per line"
										bind:value={entriesText}
										oninput={() => onEntriesTextChange(entriesText)}
										bind:this={entriesTextareaEl}
										disabled={spinning}
									></textarea>

									{@render showDuplicateEntries()}
								{/if}
							</div>

							{#if account.value}
								<input
									type="radio"
									name="wheel_tabs"
									class="tab"
									aria-label="Prizes"
									checked={activeTab === 'prizes'}
									onclick={() => (activeTab = 'prizes')}
								/>
								<div class="tab-content bg-base-100 border-base-300 p-6">
									<h3 class="mb-4 text-lg font-semibold">Prizes (SUI)</h3>

									{#if createdWheelId && wheelFetched && !isEditing}
										<div class="overflow-x-auto">
											<table class="table-zebra table">
												<thead>
													<tr>
														<th>#</th>
														<th>Amount</th>
														<th>Winner</th>
													</tr>
												</thead>
												<tbody>
													{#each prizesOnChainMist as m, i}
														<tr>
															<td class="w-12">{i + 1}</td>
															<td class="font-mono">{formatMistToSuiCompact(m)}</td>
															<td class="flex items-center font-mono">
																{#if winnersOnChain.find(w => w.prize_index === i)}
																	{shortenAddress(
																		winnersOnChain.find(w => w.prize_index === i).addr
																	)}
																	{#if Number(spinTimesOnChain[i] || 0) > 0}
																		<span
																			class="badge badge-success badge-sm ml-2 text-xs opacity-70"
																			>{formatDistanceToNow(spinTimesOnChain[i], {
																				addSuffix: true
																			})}</span
																		>
																	{/if}
																{:else}
																	<span class="opacity-60">—</span>
																{/if}
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{:else}
										<!-- Prize repeater -->
										{#each prizeAmounts as prize, i}
											<div class="join mb-2 w-full">
												<button class="btn btn-disabled join-item">Prize #{i + 1}</button>
												<input
													type="text"
													class="input join-item prize-input w-full"
													placeholder={`Amount (e.g. 0.5)`}
													value={prizeAmounts[i] ?? ''}
													oninput={e => updatePrizeAmount(i, e.currentTarget.value)}
													onchange={e => updatePrizeAmount(i, e.currentTarget.value)}
													onkeydown={e => handlePrizeKeydown(i, e)}
													aria-label={`Prize #${i + 1} amount in SUI`}
												/>
												<button
													class="btn btn-error btn-soft join-item"
													onclick={() => removePrize(i)}
													disabled={prizeAmounts.length <= 1}
													aria-label="Remove prize"
													><span class="icon-[lucide--x] h-4 w-4"></span></button
												>
											</div>
										{/each}
										<div class="mt-2 flex items-center justify-between">
											<button class="btn btn-outline" onclick={addPrize}>Add prize</button>
											<div class="text-sm">
												<strong>Need:</strong>
												<span>{formatMistToSuiCompact(totalDonationMist)} SUI</span>
											</div>
										</div>

										{#if createdWheelId && wheelFetched}
											<div class="mt-2 text-sm">
												<span class="opacity-70">Top-up required:</span>
												<strong class="ml-1">{formatMistToSuiCompact(topUpMist)} SUI</strong>
											</div>
										{/if}
									{/if}
								</div>

								<input
									type="radio"
									name="wheel_tabs"
									class="tab"
									aria-label="Others"
									checked={activeTab === 'others'}
									onclick={() => (activeTab = 'others')}
								/>
								<div class="tab-content bg-base-100 border-base-300 p-6">
									<h3 class="mb-4 text-lg font-semibold">Settings</h3>
									<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
										<label class="floating-label">
											<input
												type="number"
												class="input"
												min="0"
												step="1"
												bind:value={delayMs}
												aria-label="Delay (minutes)"
												disabled={createdWheelId && wheelFetched && !isEditing}
											/>
											<span>Delay (minutes)</span>
										</label>
										<label class="floating-label">
											<input
												type="number"
												class="input"
												min="0"
												step="1"
												bind:value={claimWindowMs}
												aria-label="Claim window (minutes)"
												disabled={createdWheelId && wheelFetched && !isEditing}
											/>
											<span>Claim window (minutes)</span>
										</label>
									</div>
									<div class="alert alert-info alert-soft">
										<ul class="list-inside list-disc">
											<li class="mb-1">
												<strong>Delay (minutes):</strong> Time to wait after spinning completes before
												claiming the prize.
											</li>
											<li>
												<strong>Claim window (minutes):</strong> Deadline time to claim the prize. After
												this time, the prize cannot be claimed (minimum 1 hour, default 24 hours).
											</li>
										</ul>
									</div>
								</div>
							{/if}
						</div>

						{#if createdWheelId && remainingSpins === 0}
							<div class="mt-3">
								<a class="link link-primary" href={`/wheel-result?wheelId=${createdWheelId}`}>
									View results and claim prizes →
								</a>
								{#if qrDataUrl}
									<div class="mt-3 flex items-center gap-3">
										<img
											src={qrDataUrl}
											alt="Result QR"
											class="rounded-box border-base-300 bg-base-100 mb-3 h-60 w-60 border p-2 shadow"
										/>
									</div>
									<div class="opacity-80">Scan to open results on your phone</div>
								{/if}
							</div>
						{/if}

						<!-- Common alerts and button (always visible) -->
						{#if account.value}
							{#if setupError}
								<div class="alert alert-error mt-3 whitespace-pre-wrap">{setupError}</div>
							{/if}
							{#if setupSuccessMsg}
								<div class="alert alert-success mt-3 break-words">{setupSuccessMsg}</div>
							{/if}

							{#if shouldShowSetupWarnings}
								<div class="alert alert-soft alert-warning mt-3">
									<ul class="list-inside list-disc">
										{#if !isOnTestnet}
											<li>Please switch wallet to Testnet.</li>
										{/if}
										{#if invalidEntriesCount > 0}
											<li>
												Please fix <strong>{invalidEntriesCount}</strong> invalid entries (must be SUI
												addresses).
											</li>
										{/if}
										{#if uniqueValidEntriesCount < 2}
											<li>At least <strong>2 unique</strong> entries are required.</li>
										{/if}
										{#if prizesCount === 0}
											<li>
												You need to add at least <strong>1 prize</strong>.
												<button
													class="btn btn-link btn-sm ml-1 align-baseline"
													onclick={() => (activeTab = 'prizes')}
													aria-label="Go to Prizes tab"
												>
													Open Prizes
												</button>
											</li>
										{/if}
										{#if prizesCount > uniqueValidEntriesCount}
											<li>
												Prizes count (<strong>{prizesCount}</strong>) must be ≤ unique entries (<strong
													>{uniqueValidEntriesCount}</strong
												>).
											</li>
										{/if}
										{#if invalidPrizeAmountsCount > 0}
											<li>
												<strong>{invalidPrizeAmountsCount}</strong> prize(s) must be at least {MINIMUM_PRIZE_AMOUNT.SUI}
												SUI.
											</li>
										{/if}
										{#if entries.length > 200}
											<li>
												Entries count (<strong>{entries.length}</strong>) must be ≤ 200.
											</li>
										{/if}
										{#if isOnTestnet && hasInsufficientBalance}
											<li>
												Wallet balance (<strong
													>{formatMistToSuiCompact(suiBalance.value)} SUI</strong
												>) is less than total required (<strong
													>{formatMistToSuiCompact(totalDonationMist)} SUI</strong
												>).
											</li>
										{/if}
									</ul>
								</div>
							{/if}

							{#if !createdWheelId}
								<div class="mt-4">
									<ButtonLoading
										formLoading={setupLoading}
										color="primary"
										loadingText="Setting up..."
										onclick={createWheelAndFund}
										aria-label="Create wheel and fund"
										size="lg"
										disabled={invalidEntriesCount > 0 ||
											uniqueValidEntriesCount < 2 ||
											prizesCount === 0 ||
											prizesCount > uniqueValidEntriesCount ||
											invalidPrizeAmountsCount > 0 ||
											entries.length > 200 ||
											getAddressEntries().length < 2 ||
											hasInsufficientBalance}
									>
										{#if totalDonationMist > 0n}
											Create wheel and fund <span class="text-success text-bold font-mono"
												>{formatMistToSuiCompact(totalDonationMist)}</span
											> SUI
										{:else}
											Create wheel
										{/if}
									</ButtonLoading>
								</div>
							{/if}
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Winner Modal -->
<dialog bind:this={winnerModal} class="modal">
	<div class="modal-box w-">
		<h3 class="mb-6 text-center text-2xl font-bold">🎉 Congratulations!</h3>
		<div class="text-center">
			<!-- Winner's name is highlighted with enhanced visual effects -->
			<div class="relative">
				<!-- Glow effect background -->
				<div
					class="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 opacity-30 blur-xl"
				></div>

				<!-- Main winner display -->
				<div
					class="relative block transform rounded-xl border-4 border-yellow-400 bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-4 text-3xl font-black text-white shadow-2xl transition-all duration-300 hover:scale-101"
				>
					<div class="flex items-center justify-center gap-3">
						<span class="text-4xl">🏆</span>
						<span class="drop-shadow-lg"
							>{isValidSuiAddress(lastWinner) ? shortenAddress(lastWinner) : lastWinner}</span
						>
						<span class="text-4xl">🏆</span>
					</div>
				</div>

				<!-- Sparkle effects -->
				<div class="absolute -top-2 -right-2 animate-ping text-2xl">✨</div>
				<div class="absolute -bottom-2 -left-2 animate-ping text-2xl" style="animation-delay: 0.5s">
					🌟
				</div>
				<div class="absolute top-1/2 -left-4 animate-pulse text-xl" style="animation-delay: 1s">
					⭐
				</div>
				<div class="absolute top-1/2 -right-4 animate-pulse text-xl" style="animation-delay: 1.5s">
					⭐
				</div>
			</div>
			<small class="mt-5 block text-gray-500">
				The winner will be automatically removed from the list for the next spin.
			</small>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>Close</button>
	</form>
</dialog>
