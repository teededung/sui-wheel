<script>
	import { onMount, onDestroy } from 'svelte';
	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { isValidSuiAddress, shortenAddress } from '$lib/utils/string.js';
	import { watch, AnimationFrames, IsIdle } from 'runed';
	import { gsap } from 'gsap';

	const idle = new IsIdle({ timeout: 5000 });

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
							>
								Spin
							</ButtonLoading>
						</div>
					</div>
					<div class="mt-4 flex items-center justify-center gap-3">
						<label class="label cursor-pointer gap-2">
							<span class="label-text">Mute</span>
							<input
								type="checkbox"
								class="toggle"
								bind:checked={muted}
								aria-label="Toggle sound"
							/>
						</label>
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

					<div class="mt-4 flex flex-wrap gap-2">
						<button
							class="btn btn-outline"
							disabled={spinning}
							onclick={shuffle}
							aria-label="Shuffle entries">Shuffle</button
						>
						<button class="btn btn-warning" disabled={spinning} onclick={clearAll}>Clear</button>
					</div>

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
