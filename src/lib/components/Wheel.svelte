<script>
	import { onMount, onDestroy } from 'svelte';
	import { IsIdle, watch } from 'runed';
	import { gsap } from 'gsap';
	import { Transaction } from '@mysten/sui/transactions';
	import { toast } from 'svelte-daisy-toaster';
	import { useSuiClient, signAndExecuteTransaction } from 'sui-svelte-wallet-kit';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { wheelContext } from '$lib/context/wheel.js';
	import { shortenAddress } from '$lib/utils/string.js';
	import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';

	const suiClient = $derived(useSuiClient());

	// Props from parent
	let {
		entries,
		spinning,
		createdWheelId,
		remainingSpins,
		isCancelled,
		entryFormEnabled,
		accountConnected,
		shuffledIndexOrder = []
	} = $props();

	// Context deps/APIs from parent
	const ctx = wheelContext.get();
	const {
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
		// Disable if online entry form is active
		if (entryFormEnabled) return true;
		// On-chain: disable if no remaining spins
		if (createdWheelId) {
			if (accountConnected) {
				return isCancelled || remainingSpins === 0;
			} else {
				return entries.length < 2;
			}
		}
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
	let pointerColorOverride = $state(''); // sea color #4DA2FF
	let lastWinner = $state('');
	let secondaryWinner = $state('');
	let usedCombinedSpin = $state(false);
	let postSpinFetchRequested = $state(false);
	let pointerBounce = $state(false);

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
	let audioContext;
	let tickBuffer;
	let tickGainNode;
	let tickSourceIndex = 0;

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

	onMount(async () => {
		winAudio = new Audio('/crowd-reaction.mp3');
		winAudio.preload = 'auto';
		winAudio.volume = 0.5;

		// Initialize Web Audio API for instant tick sounds
		try {
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
			tickGainNode = audioContext.createGain();
			tickGainNode.connect(audioContext.destination);
			tickGainNode.gain.value = 1; // Volume control

			// Load tick sound as AudioBuffer for instant playback
			const response = await fetch('/tick.mp3');
			const arrayBuffer = await response.arrayBuffer();
			tickBuffer = await audioContext.decodeAudioData(arrayBuffer);
		} catch (e) {
			console.warn('Web Audio API not supported or failed to load tick sound:', e);
		}
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

	function fireTickForIndex(idx) {
		// Play a short tick sound when the pointer passes an entry boundary
		if (muted) return;
		if (!audioContext || !tickBuffer || !tickGainNode) return;

		try {
			// Resume audio context if suspended (required by some browsers)
			if (audioContext.state === 'suspended') {
				audioContext.resume();
			}

			// Create a new AudioBufferSourceNode for each tick
			const source = audioContext.createBufferSource();
			source.buffer = tickBuffer;
			source.connect(tickGainNode);
			source.start(0); // Start immediately
		} catch (e) {
			console.warn('Failed to play tick sound:', e);
		}

		// Trigger pointer bounce animation
		triggerPointerBounce();
	}

	function triggerPointerBounce() {
		if (pointerBounce) return; // Prevent overlapping animations

		pointerBounce = true;
		gsap.to(
			{},
			{
				duration: 0.15,
				ease: 'power2.out',
				onComplete: () => {
					pointerBounce = false;
				}
			}
		);
	}

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
		// Clip all drawing operations to the wheel's circle so that shadows do not overflow
		c.beginPath();
		c.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
		c.closePath();
		c.clip();

		// Pin size controller: 1 = default, >1 bigger, <1 smaller
		const pinSizeScale = 0.5; // adjust if you want larger/smaller rivets

		// Defer drawing of rim pins until after all slices are filled so they stay on top
		const deferredPins = [];
		const baseStart = -Math.PI / 2;
		for (let i = 0; i < n; i++) {
			const start = baseStart + i * arc;
			const end = start + arc;
			c.beginPath();
			c.moveTo(centerX, centerY);
			c.arc(centerX, centerY, radius - 4, start, end);
			c.closePath();

			// Fine shadow along the tangent to make current slice look like it's on top of previous slice
			const mid = (start + end) / 2;
			c.shadowColor = 'rgba(0,0,0,0.18)';
			c.shadowBlur = 8;
			const off = Math.max(2, Math.min(6, radius * 0.012));
			c.shadowOffsetX = Math.cos(mid - Math.PI / 2) * off;
			c.shadowOffsetY = Math.sin(mid - Math.PI / 2) * off;
			c.fillStyle = segmentColors[i % segmentColors.length];
			c.fill();

			// Reset shadow to not affect stroke/label
			c.shadowColor = 'transparent';
			c.shadowBlur = 0;
			c.shadowOffsetX = 0;
			c.shadowOffsetY = 0;
			c.strokeStyle = 'rgba(0,0,0,0.06)';
			c.lineWidth = 2;
			c.stroke();

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

			// Save pin position to draw later (so next slice won't cover it)
			const pinAngle = end; // boundary end of current slice
			const rimClip = radius - 4; // same as clip radius
			const pinRadius = Math.max(3, Math.min(6, radius * 0.03 * pinSizeScale));
			const pinDistance = rimClip - pinRadius - 1.5; // keep inside clip
			const pinX = centerX + Math.cos(pinAngle) * pinDistance;
			const pinY = centerY + Math.sin(pinAngle) * pinDistance;
			deferredPins.push({ x: pinX, y: pinY, r: pinRadius });
		}

		// Draw pins on top of all slices/labels
		for (const pin of deferredPins) {
			c.save();
			c.shadowColor = 'rgba(0,0,0,0.25)';
			c.shadowBlur = 5;
			c.shadowOffsetX = 0;
			c.shadowOffsetY = 1.5;
			const g = c.createRadialGradient(
				pin.x - pin.r * 0.35,
				pin.y - pin.r * 0.35,
				0.5,
				pin.x,
				pin.y,
				pin.r
			);
			g.addColorStop(0, 'rgba(255,255,255,0.96)');
			g.addColorStop(1, 'rgba(172,172,172,0.95)');
			c.fillStyle = g;
			c.beginPath();
			c.arc(pin.x, pin.y, pin.r, 0, Math.PI * 2);
			c.fill();
			c.shadowColor = 'transparent';
			c.shadowBlur = 0;
			c.lineWidth = 1;
			c.strokeStyle = 'rgba(0,0,0,0.25)';
			c.stroke();
			c.restore();
		}

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

			// Check if order is shuffled (different from sequential order)
			const isOrderShuffled =
				shuffledIndexOrder.length > 0 && !shuffledIndexOrder.every((val, idx) => val === idx);

			let targetFn;
			if (shouldAssignLast) {
				targetFn = isOrderShuffled
					? WHEEL_FUNCTIONS.SPIN_AND_ASSIGN_LAST_WITH_ORDER
					: WHEEL_FUNCTIONS.SPIN_AND_ASSIGN_LAST;
			} else {
				targetFn = isOrderShuffled ? WHEEL_FUNCTIONS.SPIN_WITH_ORDER : WHEEL_FUNCTIONS.SPIN;
			}

			// Build transaction arguments
			const txArgs = [tx.object(createdWheelId)];

			// Add shuffled order if needed (must come after wheel object)
			if (isOrderShuffled) {
				txArgs.push(tx.pure.vector('u64', shuffledIndexOrder));
			}

			// Add remaining arguments
			txArgs.push(tx.object(RANDOM_OBJECT_ID));
			txArgs.push(tx.object(CLOCK_OBJECT_ID));

			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${targetFn}`,
				arguments: txArgs
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
				const spinEventType = `${packageId}::${WHEEL_MODULE}::${WHEEL_EVENTS}`;
				const spinEvents = (txBlock?.events || []).filter(e => {
					const t = String(e?.type || '');
					return t === spinEventType || t.endsWith(`::${WHEEL_MODULE}::${WHEEL_EVENTS.SPIN}`);
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
	<div class="rounded-box p-3">
		<div
			bind:this={canvasContainerEl}
			class="relative mx-auto aspect-square w-full rounded-full border-1 border-amber-300/60 shadow-lg"
		>
			<!-- Sound toggle -->
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

			<!-- Pointer -->
			<div
				class="pointer-events-none absolute top-1/2 -right-9 z-10 -translate-y-1/2"
				class:bounce={pointerBounce}
				aria-hidden="true"
			>
				<svg
					width="52"
					height="52"
					viewBox="0 0 96 123"
					xmlns="http://www.w3.org/2000/svg"
					class="block"
					style={`transform: rotate(-90deg); filter: drop-shadow(0 0 12px ${pointerColor}80)`}
					aria-hidden="true"
				>
					<!-- Outer silhouette fill (white) -->
					<path
						fill-rule="evenodd"
						clip-rule="evenodd"
						d="M76.2403 51.397C81.2079 57.6341 84.1784 65.5221 84.1784 74.1025C84.1784 82.6829 81.1176 90.8117 76.0195 97.084L75.5779 97.6259L75.4625 96.9385C75.3622 96.3564 75.2468 95.7643 75.1113 95.1722C72.5572 83.9524 64.2377 74.3333 50.5442 66.5407C41.2964 61.2921 36.0026 54.9797 34.6127 47.7992C33.7145 43.1577 34.3819 38.4962 35.6715 34.5021C36.961 30.5129 38.8778 27.166 40.5086 25.1539L45.8375 18.6408C46.7708 17.4968 48.522 17.4968 49.4553 18.6408L76.2453 51.397H76.2403ZM84.6652 44.8889L48.9586 1.23409C48.2761 0.401137 47.0016 0.401137 46.3192 1.23409L10.6176 44.8889L10.5022 45.0344C3.93395 53.1883 0 63.5501 0 74.8301C0 101.098 21.3306 122.394 47.6389 122.394C73.9472 122.394 95.2778 101.098 95.2778 74.8301C95.2778 63.5501 91.3438 53.1883 84.7755 45.0394L84.6601 44.8939L84.6652 44.8889ZM19.1629 51.2565L22.3542 47.3476L22.4496 48.0702C22.5249 48.6422 22.6202 49.2142 22.7306 49.7913C24.7979 60.6347 32.1791 69.6718 44.5178 76.6716C55.2459 82.7783 61.493 89.7981 63.2894 97.4954C64.042 100.707 64.1725 103.868 63.8463 106.633L63.8263 106.803L63.6707 106.879C58.8286 109.242 53.3843 110.572 47.6339 110.572C27.4573 110.572 11.0993 94.2439 11.0993 74.0975C11.0993 65.4468 14.115 57.5036 19.1529 51.2465L19.1629 51.2565Z"
						fill="#ffffff"
					/>
					<!-- Inner two shapes fill (Sui blue) -->
					<path
						fill-rule="nonzero"
						clip-rule="nonzero"
						d="M76.2403 51.397C81.2079 57.6341 84.1784 65.5221 84.1784 74.1025C84.1784 82.6829 81.1176 90.8117 76.0195 97.084L75.5779 97.6259L75.4625 96.9385C75.3622 96.3564 75.2468 95.7643 75.1113 95.1722C72.5572 83.9524 64.2377 74.3333 50.5442 66.5407C41.2964 61.2921 36.0026 54.9797 34.6127 47.7992C33.7145 43.1577 34.3819 38.4962 35.6715 34.5021C36.961 30.5129 38.8778 27.166 40.5086 25.1539L45.8375 18.6408C46.7708 17.4968 48.522 17.4968 49.4553 18.6408L76.2453 51.397H76.2403Z M19.1629 51.2565L22.3542 47.3476L22.4496 48.0702C22.5249 48.6422 22.6202 49.2142 22.7306 49.7913C24.7979 60.6347 32.1791 69.6718 44.5178 76.6716C55.2459 82.7783 61.493 89.7981 63.2894 97.4954C64.042 100.707 64.1725 103.868 63.8463 106.633L63.8263 106.803L63.6707 106.879C58.8286 109.242 53.3843 110.572 47.6339 110.572C27.4573 110.572 11.0993 94.2439 11.0993 74.0975C11.0993 65.4468 14.115 57.5036 19.1529 51.2465L19.1629 51.2565Z"
						fill={pointerColor}
					/>
				</svg>
			</div>

			<!-- Wheel -->
			<canvas bind:this={canvasEl} class="rounded-box pointer-events-none mx-auto block"></canvas>

			<!-- Spin button -->
			<div
				class="pointer-events-none absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
			>
				<div class="relative h-16 w-16 sm:h-18 sm:w-18">
					<ButtonLoading
						formLoading={spinning}
						size="lg"
						loadingText={progressing ? 'Confirming...' : 'Spinning...'}
						onclick={accountConnected ? spinOnChainAndAnimate : spin}
						aria-label="Spin the wheel"
						className={`border-0 w-full h-full rounded-full text-gray-800 !pointer-events-auto cursor-pointer disabled:cursor-not-allowed disabled:!shadow-lg disabled:opacity-70 disabled:text-gray-500 shadow-lg ring-2 ring-amber-300/80 bg-gradient-to-b from-amber-200 to-amber-500 hover:from-amber-200 hover:to-amber-600 transition-all duration-200 font-extrabold uppercase ${isSpinDisabled ? 'text-xs' : ''}`}
						disabled={isSpinDisabled}
					>
						Spin
					</ButtonLoading>
				</div>
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

		{#if accountConnected && createdWheelId}
			<div class="mt-4 flex justify-center">
				<div
					class="badge badge-lg badge-primary rounded px-2 py-1 text-center text-xs font-medium shadow"
				>
					Remaining spins: {Math.max(0, remainingSpins || 0)}
				</div>
			</div>
		{/if}

		{#if !createdWheelId || (createdWheelId && remainingSpins > 0)}
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
		{/if}
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

<style>
	.bounce {
		animation: pointerBounce 0.2s ease-out;
	}

	@keyframes pointerBounce {
		0% {
			transform: rotate(-20deg);
		}
		70% {
			transform: rotate(5deg);
		}
		100% {
			transform: rotate(-20deg);
		}
	}
</style>
