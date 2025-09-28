<script>
	import { onMount, onDestroy } from 'svelte';
	import { IsIdle, watch } from 'runed';
	import { gsap } from 'gsap';
	import { Transaction } from '@mysten/sui/transactions';
	import { toast } from 'svelte-daisy-toaster';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { wheelContext } from '$lib/context/wheel.js';
	import { shortenAddress } from '$lib/utils/string.js';
	import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';

	// Props from parent
	let { entries, spinning, createdWheelId, remainingSpins, isCancelled, accountConnected } =
		$props();

	// Context deps/APIs from parent
	const ctx = wheelContext.get();
	const {
		signAndExecuteTransaction,
		suiClient,
		packageId,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		RANDOM_OBJECT_ID,
		CLOCK_OBJECT_ID,
		fetchWheelFromChain,
		setSpinning,
		onShuffle,
		onClearAllEntries,
		removeEntry
	} = ctx;

	let isSpinDisabled = $derived.by(() => {
		if (spinning) return true;
		// On-chain: disable if no remaining spins
		if (createdWheelId) return isCancelled || remainingSpins === 0;
		// Off-chain: disable if not enough entries
		if (accountConnected && !createdWheelId) return true;
		// Not enough entries
		return entries.length < 2;
	});

	// Local state
	const idle = new IsIdle({ timeout: 15000 });
	let progressing = $state(false);
	let muted = $state(false);
	let selectedIndex = $state(null);
	let spinAngle = $state(0);
	let pointerIndex = $state(0);
	let pointerColor = $state('#ef4444');
	let pointerColorOverride = $state('');
	let lastWinner = $state('');
	let secondaryWinner = $state('');
	let usedCombinedSpin = $state(false);
	let postSpinFetchRequested = $state(false);

	// Canvas/layout
	let labelLayouts = $state([]);
	let canvasEl = $state(null);
	let canvasContainerEl = $state(null);
	let ctx2d;
	let wheelSize = $state(0);
	let offscreenCanvas;
	let offscreenCtx;

	// Audio
	let winAudio;

	// Modal
	let winnerModal = $state(null);

	// Animation state
	let currentTween;
	let idleTween;
	const idleAnimState = { angle: 0 };
	const animState = { angle: 0 };
	let lastTickIndex = null;
	let lastAngle = 0;

	const segmentColors = [
		'#22c55e',
		'#f59e0b',
		'#3b82f6',
		'#ef4444',
		'#14b8a6',
		'#a855f7',
		'#eab308',
		'#06b6d4'
	];

	onMount(() => {
		winAudio = new Audio('/crowd-reaction.mp3');
		winAudio.preload = 'auto';
		winAudio.volume = 0.5;
	});

	// Watch entries for layout updates
	watch(
		() => entries,
		() => {
			recomputeLabelLayouts();
			renderWheelBitmap();
			drawStaticWheel();
			updatePointerColor();
		}
	);

	// Resize/canvas setup
	let resizeObserver;
	function setupCanvas() {
		if (!canvasEl || !canvasContainerEl) return;
		const dpr = Math.max(1, window.devicePixelRatio || 1);
		const size = Math.min(canvasContainerEl.clientWidth, 560);
		const newWidth = Math.floor(size * dpr);
		const newHeight = Math.floor(size * dpr);

		if (newWidth === canvasEl.width && newHeight === canvasEl.height) {
			return;
		}
		wheelSize = size;

		canvasEl.style.width = `${size}px`;
		canvasEl.style.height = `${size}px`;
		canvasEl.width = newWidth;
		canvasEl.height = newHeight;
		ctx2d = canvasEl.getContext('2d');
		ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx2d.imageSmoothingEnabled = true;
		ctx2d.imageSmoothingQuality = 'high';

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
		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}
	});

	function mod(v, n) {
		return ((v % n) + n) % n;
	}

	function fireTickForIndex(idx) {}

	function updatePointerColor() {
		const n2 = Math.max(1, entries.length);
		const arc2 = (Math.PI * 2) / n2;
		const normalized = (((Math.PI / 2 - spinAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
		const newIndex = Math.floor(normalized / arc2) % n2;

		if (pointerColorOverride && pointerColorOverride.trim() !== '') {
			pointerColor = pointerColorOverride.trim();
		} else {
			pointerColor = segmentColors[newIndex % segmentColors.length];
		}

		if (!spinning) {
			pointerIndex = newIndex;
			lastTickIndex = newIndex;
			lastAngle = spinAngle;
			return;
		}

		const deltaAngle = spinAngle - lastAngle;

		if (lastTickIndex === null) {
			lastTickIndex = newIndex;
			lastAngle = spinAngle;
			pointerIndex = newIndex;
			return;
		}

		if (newIndex !== lastTickIndex && deltaAngle !== 0) {
			const dir = deltaAngle > 0 ? -1 : 1;
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

		const c = offscreenCtx;
		c.clearRect(0, 0, wheelSize, wheelSize);
		c.save();
		const baseStart = -Math.PI / 2;
		for (let i = 0; i < n; i++) {
			const start = baseStart + i * arc;
			const end = start + arc;
			c.beginPath();
			c.moveTo(centerX, centerY);
			c.arc(centerX, centerY, radius - 4, start, end);
			c.closePath();
			c.fillStyle = segmentColors[i % segmentColors.length];
			c.fill();
			c.strokeStyle = 'rgba(0,0,0,0.06)';
			c.lineWidth = 2;
			c.stroke();

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
				c.font = layout.font;
				c.fillStyle = '#111827';
				c.textAlign = 'right';
				c.textBaseline = 'middle';
				c.save();
				c.translate(centerX, centerY);
				c.rotate(mid);
				c.fillText(layout.displayText, innerRadius + available - padding, 0);
				c.restore();
			}
		}

		c.beginPath();
		c.arc(centerX, centerY, Math.max(22, radius * 0.08), 0, Math.PI * 2);
		c.fillStyle = '#ffffff';
		c.fill();

		c.restore();
	}

	function drawStaticWheel() {
		if (!ctx2d || !wheelSize) return;
		ctx2d.clearRect(0, 0, wheelSize, wheelSize);
		if (offscreenCanvas) {
			ctx2d.drawImage(
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

	function startIdleRotationIfNeeded() {
		if (spinning || currentTween || idleTween || !idle.current) return;
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
		const measureCtx = offscreenCtx || ctx2d;
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
		const normalized = (((Math.PI / 2 - spinAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
		const idx = Math.floor(normalized / arc) % n;
		return idx;
	}

	async function spinOnChainAndAnimate() {
		if (!accountConnected) return;
		if (isCancelled || !createdWheelId || spinning) return;
		if (createdWheelId && remainingSpins === 0) return;
		try {
			setSpinning?.(true);
			progressing = true;
			secondaryWinner = '';
			usedCombinedSpin = false;

			const tx = new Transaction();
			let remainingEntriesList = entries;
			try {
				remainingEntriesList = remainingEntriesList
					.map(s => String(s ?? '').trim())
					.filter(s => s.length > 0);
			} catch {}
			const uniqueLeft = (() => {
				try {
					const set = new Set(remainingEntriesList.map(s => s.toLowerCase()));
					return set.size;
				} catch {
					return Math.max(0, remainingEntriesList?.length || 0);
				}
			})();

			const shouldAssignLast = uniqueLeft === 2 && remainingSpins === 2 && !isCancelled;
			usedCombinedSpin = shouldAssignLast;
			const targetFn = shouldAssignLast
				? WHEEL_FUNCTIONS.SPIN_AND_ASSIGN_LAST
				: WHEEL_FUNCTIONS.SPIN;

			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${targetFn}`,
				arguments: [
					tx.object(createdWheelId),
					tx.object(RANDOM_OBJECT_ID),
					tx.object(CLOCK_OBJECT_ID)
				]
			});

			const res = await signAndExecuteTransaction(tx);
			progressing = false;
			const digest = res?.digest ?? res?.effects?.transactionDigest;
			if (!digest) throw new Error('Missing tx digest for spin');

			let targetIdx = -1;
			try {
				const txBlock = await suiClient.waitForTransaction({
					digest,
					options: { showEvents: true }
				});
				const spinEventType = `${packageId}::${WHEEL_MODULE}::SpinEvent`;
				const spinEvents = (txBlock?.events || []).filter(e => {
					const t = String(e?.type || '');
					return t === spinEventType || t.endsWith(`::${WHEEL_MODULE}::SpinEvent`);
				});
				const firstEv = spinEvents?.[0];
				const parsed = firstEv?.parsedJson || {};
				const winnerAddr = String(
					parsed?.winner ?? parsed?.winner_address ?? parsed?.winnerAddress ?? ''
				).toLowerCase();
				if (winnerAddr) {
					const candidateIdxs = entries.reduce((acc, a, i) => {
						if (String(a ?? '').toLowerCase() === winnerAddr) acc.push(i);
						return acc;
					}, []);
					targetIdx = candidateIdxs.length
						? candidateIdxs[Math.floor(Math.random() * candidateIdxs.length)]
						: -1;
				}
				if (usedCombinedSpin && spinEvents.length > 1) {
					const secondParsed = spinEvents[1]?.parsedJson || {};
					const secondAddr = String(
						secondParsed?.winner ??
							secondParsed?.winner_address ??
							secondParsed?.winnerAddress ??
							''
					).toLowerCase();
					if (secondAddr) secondaryWinner = secondAddr;
				}
			} catch {}

			if (
				!Number.isFinite(targetIdx) ||
				targetIdx < 0 ||
				targetIdx >= Math.max(1, entries.length)
			) {
				targetIdx = Math.floor(Math.random() * Math.max(1, entries.length));
			}

			postSpinFetchRequested = true;
			setSpinning?.(false);
			spinToIndex(targetIdx, {
				duration: 10000,
				extraTurnsMin: 6,
				extraTurnsMax: 10,
				marginFraction: 0.05,
				easePower: 3
			});
		} catch (e) {
			toast.error(e?.message || String(e), { position: 'bottom-right' });
			setSpinning?.(false);
			progressing = false;
		}
	}

	function spin() {
		if (accountConnected) return;
		if (spinning || entries.length < 2) return;
		const n = Math.max(1, entries.length);
		const randomIndex = Math.floor(Math.random() * n);
		spinToIndex(randomIndex, {
			duration: 10000,
			extraTurnsMin: 6,
			extraTurnsMax: 10,
			marginFraction: 0.05,
			easePower: 3
		});
	}

	function showConfetti() {
		try {
			const cf = typeof window !== 'undefined' ? window.confetti : undefined;
			if (typeof cf === 'function') {
				const duration = 3000;
				const animationEnd = Date.now() + duration;
				const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
				function randomInRange(min, max) {
					return Math.random() * (max - min) + min;
				}
				const interval = setInterval(function () {
					const timeLeft = animationEnd - Date.now();
					if (timeLeft <= 0) {
						return clearInterval(interval);
					}
					const particleCount = 50 * (timeLeft / duration);
					cf(
						Object.assign({}, defaults, {
							particleCount,
							origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
						})
					);
					cf(
						Object.assign({}, defaults, {
							particleCount,
							origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
						})
					);
				}, 250);
			}
		} catch {}
	}

	function spinToIndex(targetIndex, opts = {}) {
		const n = Math.max(1, entries.length);
		if (spinning || n < 1) return;
		const idx = Math.max(0, Math.min(n - 1, Number(targetIndex) | 0));
		setSpinning?.(true);
		selectedIndex = null;
		lastTickIndex = null;

		const startAngle = spinAngle;
		lastAngle = startAngle;
		const arc = (Math.PI * 2) / n;
		const marginFraction = Math.max(0, Math.min(0.49, opts.marginFraction ?? 0.05));
		const margin = arc * marginFraction;
		const innerWidth = Math.max(0, arc - 2 * margin);
		const randomWithin = margin + Math.random() * innerWidth;
		const targetTheta = idx * arc + randomWithin;
		const baseAligned = normalizeAngle(Math.PI / 2 - targetTheta);

		const extraTurnsMin = opts.extraTurnsMin ?? 5;
		const extraTurnsMax = opts.extraTurnsMax ?? 7;
		const duration = opts.duration ?? 5200;
		const extraTurnsFloat =
			extraTurnsMin + Math.random() * Math.max(0, extraTurnsMax - extraTurnsMin);
		const extraTurns = Math.max(0, Math.ceil(extraTurnsFloat));

		const tau = Math.PI * 2;
		const kBase = Math.ceil((startAngle - baseAligned) / tau);
		const targetAngle = baseAligned + (kBase + extraTurns) * tau;

		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}
		stopIdleRotation();
		animState.angle = startAngle;
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
				setSpinning?.(false);
				selectedIndex = pickSelectedIndex();
				updatePointerColor();
				if (!muted && winAudio) {
					try {
						winAudio.currentTime = 0;
						winAudio.play();
					} catch {}
				}
				const winnerIndex = selectedIndex;
				const winnerValue = entries[winnerIndex];
				lastWinner = String(winnerValue ?? '');
				if (usedCombinedSpin && secondaryWinner) {
					// keep secondaryWinner
				}
				if (lastWinner) {
					if (!postSpinFetchRequested) {
						removeEntry?.(String(winnerValue ?? ''));
					}
					selectedIndex = null;
					spinAngle = 0;
					if (winnerModal && !winnerModal.open) {
						winnerModal.showModal();
						showConfetti();
					}
				}
				if (postSpinFetchRequested) {
					postSpinFetchRequested = false;
					fetchWheelFromChain?.();
				}
			}
		});
	}

	$effect(() => {
		void spinAngle;
		if (!spinning && canvasEl) {
			canvasEl.style.transform = `rotate(${spinAngle}rad)`;
			updatePointerColor();
		}
	});

	$effect(() => {
		if (idle.current) {
			startIdleRotationIfNeeded();
		} else {
			stopIdleRotation();
		}
	});
</script>

<div class="relative mx-auto max-w-[560px]">
	<div class="rounded-box bg-base-200 p-3 shadow">
		<div
			bind:this={canvasContainerEl}
			class="border-base-300 relative mx-auto aspect-square w-full rounded-full border-1 shadow-lg"
		>
			<button
				class="btn btn-circle btn-sm tooltip absolute top-2 right-2 z-20 bg-white/90 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white"
				onclick={() => (muted = !muted)}
				aria-label={muted ? 'Sound: off' : 'Sound: on'}
				title={'Toggle sound'}
				data-tip={muted ? 'Sound: off' : 'Sound: on'}
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
				<div
					class="h-0 w-0 border-y-[24px] border-r-[48px] border-y-transparent"
					style="border-right-color: #ffffff; filter: drop-shadow(0 0 6px rgba(0,0,0,0.12)); transform: translateX(6px)"
				></div>
				<div
					class="absolute top-1/2 right-0 h-0 w-0 -translate-y-1/2 border-y-[20px] border-r-[40px] border-y-transparent"
					style={`border-right-color: ${pointerColor}; filter: drop-shadow(0 0 12px ${pointerColor}80)`}
				></div>
			</div>

			<canvas bind:this={canvasEl} class="rounded-box pointer-events-none mx-auto block"></canvas>

			<div
				class="pointer-events-none absolute top-1/2 left-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
			>
				<ButtonLoading
					formLoading={spinning}
					color="primary"
					size="lg"
					loadingText={progressing ? 'Confirming...' : 'Spinning...'}
					onclick={accountConnected ? spinOnChainAndAnimate : spin}
					aria-label="Spin the wheel"
					moreClass={`w-full h-full bg-white hover:bg-primary hover:text-white rounded-full text-black pointer-events-auto shadow-lg ${isSpinDisabled ? 'opacity-50' : ''}`}
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
					Remaining spins: {Math.max(0, remainingSpins || 0)}
				</div>
			</div>
		{/if}

		<div class="mt-4 flex flex-wrap justify-center gap-2">
			<button
				class="btn btn-outline"
				class:btn-disabled={spinning || entries.length < 2}
				disabled={spinning || entries.length < 2}
				onclick={onShuffle}
				aria-label="Shuffle entries">Shuffle</button
			>
			{#if !createdWheelId}
				<button class="btn btn-warning" disabled={spinning} onclick={onClearAllEntries}
					>Clear</button
				>
			{/if}
		</div>
	</div>
</div>

<dialog bind:this={winnerModal} class="modal">
	<div class="modal-box w-">
		<h3 class="mb-6 text-center text-2xl font-bold">🎉 Congratulations!</h3>
		<div class="text-center">
			<div class="relative">
				<div
					class="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 opacity-30 blur-xl"
				></div>
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
				{#if usedCombinedSpin && secondaryWinner}
					<div class="mt-3 text-center text-sm">
						<span class="opacity-80">Also assigned:</span>
						<strong class="ml-2 font-mono"
							>{isValidSuiAddress(secondaryWinner)
								? shortenAddress(secondaryWinner)
								: secondaryWinner}</strong
						>
					</div>
				{/if}
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
			<small class="mt-5 block text-gray-500"
				>The winner will be automatically removed from the list.</small
			>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>Close</button>
	</form>
</dialog>
