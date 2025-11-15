<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { gsap } from 'gsap';
	import logo from '$lib/assets/sui-wheel-logo.png';

	interface LabelLayout {
		displayText: string;
		font: string;
	}

	interface Props {
		entries?: string[];
		colors?: string[];
		rotationSpeed?: number;
		logoSize?: number;
		fontSize?: number | null;
		className?: string;
	}

	// Props - allow customization of entries and colors
	let {
		entries = [
			'Prize 1',
			'Prize 2',
			'Prize 3',
			'Prize 4',
			'Prize 5',
			'Prize 6',
			'Prize 7',
			'Prize 8'
		],
		colors = [
			'#22c55e',
			'#f59e0b',
			'#3b82f6',
			'#ef4444',
			'#14b8a6',
			'#a855f7',
			'#eab308',
			'#06b6d4'
		],
		rotationSpeed = 20, // seconds for one full rotation
		logoSize = 20,
		fontSize = null, // Custom font size for entries (null = auto)
		className = ''
	}: Props = $props();

	// Canvas/layout
	let labelLayouts = $state<LabelLayout[]>([]);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let canvasContainerEl = $state<HTMLDivElement | null>(null);
	let ctx2d: CanvasRenderingContext2D | null = null;
	let wheelSize = $state(0);
	let offscreenCanvas: HTMLCanvasElement | null = null;
	let offscreenCtx: CanvasRenderingContext2D | null = null;

	// Animation
	let currentTween: ReturnType<typeof gsap.to> | null = null;
	let animState = { angle: 0 };

	const segmentColors = colors;

	// Track previous entries to avoid unnecessary re-renders
	let previousEntries = $state<string[]>([]);

	// Reactive effect to re-render when entries change
	$effect(() => {
		if (entries && canvasEl && offscreenCtx && wheelSize > 0) {
			// Check if entries actually changed
			const entriesChanged = JSON.stringify(entries) !== JSON.stringify(previousEntries);
			if (entriesChanged) {
				previousEntries = [...entries];
				recomputeLabelLayouts();
				renderWheelBitmap();
				drawStaticWheel();
			}
		}
	});

	onMount(async () => {
		setupCanvas();
		startContinuousRotation();
	});

	onDestroy(() => {
		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}
	});

	// Resize/canvas setup
	let resizeObserver: ResizeObserver | null = null;
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
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		ctx2d = ctx;
		ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx2d.imageSmoothingEnabled = true;
		ctx2d.imageSmoothingQuality = 'high';

		offscreenCanvas = document.createElement('canvas');
		offscreenCanvas.width = newWidth;
		offscreenCanvas.height = newHeight;
		const offCtx = offscreenCanvas.getContext('2d');
		if (!offCtx) return;
		offscreenCtx = offCtx;
		offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
		offscreenCtx.imageSmoothingEnabled = true;
		offscreenCtx.imageSmoothingQuality = 'high';

		recomputeLabelLayouts();
		renderWheelBitmap();
		drawStaticWheel();
		if (canvasEl) {
			canvasEl.style.transform = `rotate(${animState.angle}rad)`;
		}
	}

	function startContinuousRotation() {
		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}

		currentTween = gsap.to(animState, {
			angle: animState.angle + Math.PI * 2,
			duration: rotationSpeed,
			ease: 'linear',
			repeat: -1,
			onUpdate: () => {
				if (canvasEl) {
					canvasEl.style.transform = `rotate(${animState.angle}rad)`;
				}
			}
		});
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
		// Clip all drawing operations to the wheel's circle
		c.beginPath();
		c.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
		c.closePath();
		c.clip();

		// Defer drawing of rim pins until after all slices are filled
		const deferredPins = [];
		const baseStart = -Math.PI / 2;
		for (let i = 0; i < n; i++) {
			const start = baseStart + i * arc;
			const end = start + arc;
			c.beginPath();
			c.moveTo(centerX, centerY);
			c.arc(centerX, centerY, radius - 4, start, end);
			c.closePath();

			// Fine shadow along the tangent
			const mid = (start + end) / 2;
			c.shadowColor = 'rgba(0,0,0,0.18)';
			c.shadowBlur = 8;
			const off = Math.max(2, Math.min(6, radius * 0.012));
			c.shadowOffsetX = Math.cos(mid - Math.PI / 2) * off;
			c.shadowOffsetY = Math.sin(mid - Math.PI / 2) * off;
			c.fillStyle = segmentColors[i % segmentColors.length];
			c.fill();

			// Reset shadow
			c.shadowColor = 'transparent';
			c.shadowBlur = 0;
			c.shadowOffsetX = 0;
			c.shadowOffsetY = 0;
			c.strokeStyle = 'rgba(0,0,0,0.06)';
			c.lineWidth = 2;
			c.stroke();

			const label = String(entries[i]).trim();
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

			// Save pin position to draw later
			const pinAngle = end;
			const rimClip = radius - 4;
			const pinRadius = Math.max(3, Math.min(6, radius * 0.03 * 0.5));
			const pinDistance = rimClip - pinRadius - 1.5;
			const pinX = centerX + Math.cos(pinAngle) * pinDistance;
			const pinY = centerY + Math.sin(pinAngle) * pinDistance;
			deferredPins.push({ x: pinX, y: pinY, r: pinRadius });
		}

		// Draw pins on top
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
			const baseLabel = String(entries[i] ?? '').trim();
			if (!baseLabel) {
				layouts[i] = { displayText: '', font: '' };
				continue;
			}
			const arcDegrees = (arc * 180) / Math.PI;
			let calculatedFontSize =
				fontSize !== null ? fontSize : Math.max(9, Math.min(17, arcDegrees * 0.75));
			let displayText = baseLabel;
			let font = `600 ${calculatedFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;
			measureCtx.font = font;
			let measured = measureCtx.measureText(displayText).width;
			if (measured > maxWidth && maxWidth > 0 && fontSize === null) {
				const scale = maxWidth / measured;
				calculatedFontSize = Math.max(9, Math.floor(calculatedFontSize * scale));
				font = `600 ${calculatedFontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"`;
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
	});
</script>

<div class="relative mx-auto max-w-[560px] rounded-box {className}">
	<div
		bind:this={canvasContainerEl}
		class="relative mx-auto aspect-square w-full overflow-hidden rounded-full border-1 border-amber-300/60 shadow-lg"
	>
		<!-- Wheel -->
		<canvas bind:this={canvasEl} class="pointer-events-none mx-auto block rounded-box"></canvas>

		<!-- Logo in center -->
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<img src={logo} alt="Sui Wheel Logo" class="h-{logoSize} w-auto" />
		</div>
	</div>
</div>
