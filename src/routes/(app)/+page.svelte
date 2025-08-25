<script>
	import { onMount, onDestroy } from 'svelte';
	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { isValidSuiAddress, shortenAddress } from '$lib/utils/string.js';

	// State
	let entries = $state([
		'It is certain',
		'Reply hazy, try again',
		'As I see it, yes',
		"Don't count on it",
		'It is decidedly so',
		'Ask again later',
		'Most likely',
		'My reply is no',
		'Without a doubt',
		'Better not tell you now',
		'Outlook good',
		'My sources say no',
		'Yes - definitely',
		'Cannot predict now',
		'Probably, yes',
		'Outlook not so good',
		'You may rely on it',
		'Concentrate & ask again',
		'Signs point to yes',
		'Very doubtful'
	]);

	let newEntry = $state('');
	let entriesText = $state('');
	let spinning = $state(false);
	let muted = $state(false);
	let selectedIndex = $state(null);
	let spinAngle = $state(0); // radians
	let pointerIndex = $state(0);
	let pointerColor = $state('#ef4444');

	/** Canvas and layout refs */
	let canvasEl;
	let canvasContainerEl;
	let ctx;
	let wheelSize = $state(0); // CSS px size (square)

	/** Audio */
	let winAudio;
	onMount(() => {
		winAudio = new Audio('/success-sound.mp3');
		winAudio.preload = 'auto';
		winAudio.volume = 0.5;
	});

	/** Resize handling */
	let resizeObserver;
	function setupCanvas() {
		if (!canvasEl || !canvasContainerEl) return;
		const dpr = Math.max(1, window.devicePixelRatio || 1);
		const size = Math.min(canvasContainerEl.clientWidth, 560);
		wheelSize = size;

		canvasEl.style.width = `${size}px`;
		canvasEl.style.height = `${size}px`;
		canvasEl.width = Math.floor(size * dpr);
		canvasEl.height = Math.floor(size * dpr);
		ctx = canvasEl.getContext('2d');
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		drawWheel();
	}

	onMount(() => {
		resizeObserver = new ResizeObserver(() => setupCanvas());
		if (canvasContainerEl) resizeObserver.observe(canvasContainerEl);
		setupCanvas();
	});

	onDestroy(() => {
		if (resizeObserver && canvasContainerEl) resizeObserver.unobserve(canvasContainerEl);
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

	function drawWheel() {
		if (!ctx || !wheelSize) return;
		const n = Math.max(1, entries.length);
		const radius = wheelSize / 2;
		const centerX = radius;
		const centerY = radius;
		const arc = (Math.PI * 2) / n;

		ctx.clearRect(0, 0, wheelSize, wheelSize);

		// Background circle
		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.rotate(spinAngle);
		ctx.translate(-centerX, -centerY);

		const baseStart = -Math.PI / 2; // start at top
		for (let i = 0; i < n; i++) {
			const start = baseStart + i * arc;
			const end = start + arc;
			ctx.beginPath();
			ctx.moveTo(centerX, centerY);
			ctx.arc(centerX, centerY, radius - 4, start, end);
			ctx.closePath();
			ctx.fillStyle = segmentColors[i % segmentColors.length];
			ctx.fill();

			// Separator line
			ctx.strokeStyle = 'rgba(0,0,0,0.06)';
			ctx.lineWidth = 2;
			ctx.stroke();

			// Label: improved positioning to reduce overlap
			const mid = (start + end) / 2;
			const raw = String(entries[i]).trim();
			const label = isValidSuiAddress(raw) ? shortenAddress(raw) : raw;

			// Skip empty labels
			if (!label) continue;

			const arcDegrees = (arc * 180) / Math.PI;

			// Dynamic font sizing with better scaling
			let fontSize = Math.max(9, Math.min(17, arcDegrees * 0.75));

			let displayText = label;

			// Define inner and outer radius for text
			const innerRadius = Math.max(30, radius * 0.2);
			const outerRadius = radius - 10;
			const available = outerRadius - innerRadius;

			const padding = 10;
			const maxWidth = Math.max(0, available - padding);
			const len = displayText.length;
			if (len > 0) {
				// Base font
				ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;

				// Shrink-to-fit by width instead of distributing letters (right aligned)
				let measured = ctx.measureText(displayText).width;
				if (measured > maxWidth && maxWidth > 0) {
					const scale = maxWidth / measured;
					fontSize = Math.max(9, Math.floor(fontSize * scale));
					ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;
					measured = ctx.measureText(displayText).width;
				}

				// Ellipsis if still overflowing at minimum size
				if (measured > maxWidth && maxWidth > 0) {
					const ellipsis = '…';
					while (
						displayText.length > 1 &&
						ctx.measureText(displayText + ellipsis).width > maxWidth
					) {
						displayText = displayText.slice(0, -1);
					}
					displayText += ellipsis;
				}

				ctx.fillStyle = '#111827';
				ctx.textAlign = 'right';
				ctx.textBaseline = 'middle';

				ctx.save();
				ctx.translate(centerX, centerY);
				ctx.rotate(mid);
				ctx.fillText(displayText, innerRadius + available - padding, 0);
				ctx.restore();
			}

			// Removed an extra ctx.restore() here that broke the global rotation state
		}

		// Center circle
		ctx.beginPath();
		ctx.arc(centerX, centerY, Math.max(22, radius * 0.08), 0, Math.PI * 2);
		ctx.fillStyle = '#ffffff';
		ctx.fill();

		ctx.restore();

		// Update pointer color to match segment at right-hand pointer
		const n2 = Math.max(1, entries.length);
		const arc2 = (Math.PI * 2) / n2;
		const normalized = (((Math.PI / 2 - spinAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
		pointerIndex = Math.floor(normalized / arc2) % n2;
		pointerColor = segmentColors[pointerIndex % segmentColors.length];
	}

	/** Spin logic */
	let rafId;
	function easeOutCubic(t) {
		return 1 - Math.pow(1 - t, 3);
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
		spinning = true;
		selectedIndex = null;
		const startAngle = spinAngle;
		const extraTurns = 5 + Math.random() * 3; // 5-8 turns
		const randomOffset = Math.random() * Math.PI * 2;
		const targetAngle = startAngle + extraTurns * Math.PI * 2 + randomOffset;
		const duration = 4200; // ms
		const startTime = performance.now();

		cancelAnimationFrame(rafId);
		const step = now => {
			const elapsed = now - startTime;
			const t = Math.min(1, elapsed / duration);
			const eased = easeOutCubic(t);
			spinAngle = startAngle + (targetAngle - startAngle) * eased;
			drawWheel();
			if (t < 1) {
				rafId = requestAnimationFrame(step);
			} else {
				spinning = false;
				selectedIndex = pickSelectedIndex();
				if (!muted && winAudio) {
					try {
						winAudio.currentTime = 0;
						winAudio.play();
					} catch {}
				}
			}
		};
		rafId = requestAnimationFrame(step);
	}

	function shuffle() {
		entries = [...entries].sort(() => Math.random() - 0.5);
		drawWheel();
	}

	function clearAll() {
		entries = [];
		selectedIndex = null;
		spinAngle = 0;
		drawWheel();
	}

	function resetSample() {
		entries = [
			'It is certain',
			'Reply hazy, try again',
			'As I see it, yes',
			"Don't count on it",
			'It is decidedly so',
			'Ask again later',
			'Most likely',
			'My reply is no',
			'Without a doubt',
			'Better not tell you now',
			'Outlook good',
			'My sources say no',
			'Yes - definitely',
			'Cannot predict now',
			'Probably, yes',
			'Outlook not so good',
			'You may rely on it',
			'Concentrate & ask again',
			'Signs point to yes',
			'Very doubtful'
		];
		selectedIndex = null;
		spinAngle = 0;
		drawWheel();
	}

	function addEntry() {
		const v = newEntry.trim();
		if (!v) return;
		entries = [...entries, v];
		newEntry = '';
		drawWheel();
	}

	function onEntriesTextChange(text) {
		const list = text
			.split('\n')
			.map(s => s.trim())
			.filter(s => s.length > 0);
		entries = list;
		selectedIndex = null;
		spinAngle = 0;
		drawWheel();
	}

	$effect(() => {
		drawWheel();
	});

	$effect(() => {
		entriesText = entries.join('\n');
	});
</script>

<section class="container mx-auto px-4 py-6">
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="w-full">
			<div class="relative mx-auto max-w-[560px]">
				<div class="rounded-box bg-base-200 p-3 shadow">
					<div bind:this={canvasContainerEl} class="relative mx-auto aspect-square w-full">
						<div class="pointer-events-none absolute top-1/2 right-0 z-10 -translate-y-1/2">
							<div
								class="h-0 w-0 border-y-20 border-r-[40px] border-y-transparent"
								style={`border-right-color: ${pointerColor}; filter: drop-shadow(0 0 12px ${pointerColor}80)`}
							></div>
						</div>
						<canvas bind:this={canvasEl} class="rounded-box bg-base-100 mx-auto block"></canvas>
					</div>
					<div class="mt-4 flex items-center justify-center gap-3">
						<ButtonLoading
							formLoading={spinning}
							buttonStyle="primary"
							loadingText="Spinning..."
							onclick={spin}
						>
							Spin the wheel
						</ButtonLoading>
						<button class="btn" onclick={shuffle} aria-label="Shuffle entries">Shuffle</button>
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
							<div class="badge badge-lg badge-success">Result</div>
							<div class="mt-2 text-lg font-semibold">{entries[selectedIndex]}</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="w-full">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Wheel entries</h2>

					<fieldset class="fieldset border-base-300 rounded-box border p-4">
						<legend class="fieldset-legend">Manage entries</legend>

						<div class="join w-full">
							<input
								class="input join-item w-full"
								placeholder="Add new entry"
								bind:value={newEntry}
								onkeydown={e => {
									if (e.key === 'Enter') addEntry();
								}}
								aria-label="New entry"
							/>
							<button class="btn join-item" onclick={addEntry} aria-label="Add entry">Add</button>
						</div>

						<label class="floating-label mt-4">
							<textarea
								class="textarea h-48 w-full"
								placeholder="One entry per line"
								bind:value={entriesText}
								oninput={() => onEntriesTextChange(entriesText)}
							></textarea>
							<span>Entries list</span>
						</label>

						<div class="mt-4 flex flex-wrap gap-2">
							<button class="btn btn-ghost" onclick={resetSample}>Reset sample</button>
							<button class="btn btn-warning" onclick={clearAll}>Clear all</button>
						</div>
					</fieldset>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
</style>
