<script>
	import { onMount, onDestroy } from 'svelte';
	import { watch, IsIdle } from 'runed';
	import { gsap } from 'gsap';
	import { SuiClient } from '@mysten/sui/client';
	import { Transaction } from '@mysten/sui/transactions';
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
		formatMistToSuiCompact
	} from '$lib/utils/suiHelpers.js';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';

	import {
		DEFAULT_PACKAGE_ID,
		MIST_PER_SUI,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS
	} from '$lib/constants.js';

	const idle = new IsIdle({ timeout: 10000 });

	// Testnet Sui client for reading transaction details
	const testnetClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

	// State
	let entries = $state([
		'It is certain',
		'Reply hazy, try again',
		'As I see it, yes',
		"Don't count on it",
		'It is decidedly so',
		'Ask again later',
		'Most likely',
		'Most likely',
		'Most likely'
	]);

	// Blockchain setup state
	let packageId = $state(DEFAULT_PACKAGE_ID);
	let prizeAmounts = $state(['']); // SUI amounts as strings (decimal supported)
	let delayMs = $state(0);
	let claimWindowMs = $state(1440); // 24 hours
	let setupLoading = $state(false);
	let setupError = $state('');
	let setupSuccessMsg = $state('');
	let createdWheelId = $state('');
	let isOnTestnet = $derived(Boolean(account.value?.chains?.[0] === 'sui:testnet'));

	// Disable spin when wallet is connected but wheel hasn't been created
	let isSpinDisabled = $derived.by(() => Boolean(account.value) && !createdWheelId);

	const spinAnimationConfig = {
		duration: 10000,
		extraTurnsMin: 6,
		extraTurnsMax: 10,
		marginFraction: 0.05,
		easePower: 3
	};

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

	let hasInsufficientBalance = $derived.by(
		() => suiBalance.value - 1_000_000_000 < totalDonationMist
	);

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
		const prizesCount = prizeAmounts.filter(v => parseSuiToMist(v) > 0n).length;
		if (prizesCount === 0) errors.push('Please add at least 1 prize with amount > 0.');
		if (addrList.length < prizesCount)
			errors.push('Number of entries must be >= number of prizes.');
		// unique addresses check
		const uniqueCount = new Set(addrList.map(a => a.toLowerCase())).size;
		if (uniqueCount < prizesCount) errors.push('Unique address count must be >= number of prizes.');
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
			// TX 1: create_wheel
			const tx1 = new Transaction();
			tx1.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.CREATE}`,
				arguments: [
					tx1.pure.vector('address', addrList),
					tx1.pure.vector('u64', prizeMistList),
					tx1.pure.u64(BigInt(Number(delayMs || 0)) * 60000n),
					tx1.pure.u64(BigInt(Number(claimWindowMs || 0)) * 60000n)
				]
			});
			const res1 = await signAndExecuteTransaction(tx1);
			const digest = res1?.digest ?? res1?.effects?.transactionDigest;
			if (!digest) throw new Error('Failed to get transaction digest for create_wheel');
			const txBlock = await testnetClient.getTransactionBlock({
				digest,
				options: { showObjectChanges: true }
			});
			const created = (txBlock?.objectChanges || []).find(
				ch =>
					ch.type === 'created' && String(ch.objectType || '').endsWith(`::${WHEEL_MODULE}::Wheel`)
			);
			const wheelId = created?.objectId;
			if (!wheelId) throw new Error('Wheel object id not found after creation');
			createdWheelId = wheelId;

			// TX 2: donate_to_pool with total donation
			const total = totalDonationMist;
			if (total <= 0n) throw new Error('Total donation must be greater than 0');
			const tx2 = new Transaction();
			const [donationCoin] = tx2.splitCoins(tx2.gas, [total]);
			tx2.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${WHEEL_FUNCTIONS.DONATE}`,
				arguments: [tx2.object(wheelId), donationCoin]
			});
			await signAndExecuteTransaction(tx2);

			// Clear web2 entries after successful setup
			entries = [];
			selectedIndex = null;
			spinAngle = 0;
			setupSuccessMsg = `Wheel created and funded successfully. ID: ${wheelId}`;
		} catch (e) {
			setupError = e?.message || String(e);
		} finally {
			setupLoading = false;
		}
	}

	// Precomputed label layouts to avoid per-frame text measurement
	let labelLayouts = $state([]); // [{ displayText: string, font: string }] aligned with entries

	/** Canvas and layout refs */
	let canvasEl;
	let canvasContainerEl;
	let entriesTextareaEl;
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
					entries = entries.filter(
						entry => String(entry ?? '').trim() !== String(winnerValue ?? '').trim()
					);
					selectedIndex = null;
					spinAngle = 0;
					// show winner modal
					if (winnerModal && !winnerModal.open) winnerModal.showModal();
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
		selectedIndex = null;
		entries = [...entries].sort(() => Math.random() - 0.5);
	}

	function clearAll() {
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
								onclick={spin}
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

					<!-- Wheel control buttons -->
					<div class="mt-4 flex flex-wrap justify-center gap-2">
						<button
							class="btn btn-outline"
							disabled={spinning}
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
					<h2 class="card-title">Wheel entries</h2>

					<textarea
						class="textarea h-48 w-full"
						placeholder="One entry per line"
						bind:value={entriesText}
						oninput={() => onEntriesTextChange(entriesText)}
						bind:this={entriesTextareaEl}
						disabled={spinning}
					></textarea>

					{#if duplicateEntries.length > 0}
						<div class="mt-4">
							<h3 class="text-base-content/70 mb-2 text-sm font-semibold">Duplicate Entries:</h3>
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

					<!-- Blockchain Setup Section (visible when wallet connected) -->
					{#if account.value}
						<!-- Prize repeater -->
						<fieldset class="fieldset bg-base-300 border-base-300 rounded-box mb-3 border p-4">
							<legend class="fieldset-legend">Prizes (SUI)</legend>
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
										aria-label="Remove prize"><span class="icon-[lucide--x] h-4 w-4"></span></button
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
						</fieldset>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="floating-label">
								<input
									type="number"
									class="input"
									min="0"
									step="1"
									bind:value={delayMs}
									aria-label="Delay (minutes)"
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
								/>
								<span>Claim window (minutes)</span>
							</label>
						</div>

						{#if setupError}
							<div class="alert alert-error mt-3 whitespace-pre-wrap">{setupError}</div>
						{/if}
						{#if setupSuccessMsg}
							<div class="alert alert-success mt-3 break-words">{setupSuccessMsg}</div>
						{/if}

						{#if invalidEntriesCount > 0 || uniqueValidEntriesCount < 2 || prizesCount > uniqueValidEntriesCount || hasInsufficientBalance || !isOnTestnet}
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
									{#if prizesCount > uniqueValidEntriesCount}
										<li>
											Prizes count (<strong>{prizesCount}</strong>) must be ≤ unique entries (<strong
												>{uniqueValidEntriesCount}</strong
											>).
										</li>
									{/if}
									{#if isOnTestnet && hasInsufficientBalance}
										<li>
											Wallet balance (<strong>{formatMistToSuiCompact(suiBalance.value)} SUI</strong
											>) is less than total required (<strong
												>{formatMistToSuiCompact(totalDonationMist)} SUI</strong
											>).
										</li>
									{/if}
								</ul>
							</div>
						{/if}

						<div class="mt-4">
							<ButtonLoading
								formLoading={setupLoading}
								color="primary"
								loadingText="Setting up..."
								onclick={createWheelAndFund}
								aria-label="Create wheel and fund"
								disabled={invalidEntriesCount > 0 ||
									uniqueValidEntriesCount < 2 ||
									prizesCount > uniqueValidEntriesCount ||
									hasInsufficientBalance}
							>
								{#if totalDonationMist > 0n}
									Create wheel and fund {formatMistToSuiCompact(totalDonationMist)} SUI
								{:else}
									Create wheel
								{/if}
							</ButtonLoading>
						</div>
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
