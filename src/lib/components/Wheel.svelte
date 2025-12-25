<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { IsIdle, watch, useEventListener } from 'runed';
	import { Transaction, type TransactionArgument } from '@mysten/sui/transactions';
	import { toast } from 'svelte-daisy-toaster';
	import { useSuiClient, signAndExecuteTransaction } from 'sui-svelte-wallet-kit';

	import ButtonLoading from '$lib/components/ButtonLoading.svelte';
	import { wheelContext } from '$lib/context/wheel.js';
	import { shortenAddress } from '$lib/utils/string.js';
	import { isValidSuiAddress } from '$lib/utils/suiHelpers.js';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import { WHEEL_EVENTS, DEFAULT_COIN_TYPE } from '$lib/constants.js';
	import type { Reward } from '$lib/types/wheel.js';

	interface LabelLayout {
		displayText: string;
		font: string;
	}

	interface Props {
		entries: string[];
		spinning: boolean;
		createdWheelId?: string;
		remainingSpins?: number;
		isCancelled?: boolean;
		entryFormEnabled?: boolean;
		accountFromWallet?: boolean;
		isNotOrganizer?: boolean;
		shuffledIndexOrder?: number[];
		selectedCoinType?: string;
		mode?: 'participants' | 'rewards';
		rewards?: Reward[];
		equalSlices?: boolean;
		muted?: boolean;
	}

	interface SpinOptions {
		marginFraction?: number;
		extraTurnsMin?: number;
		extraTurnsMax?: number;
		duration?: number;
		easePower?: number;
	}

	const t = useTranslation();
	const suiClient = $derived(useSuiClient());

	// Props from parent
	let {
		entries,
		spinning,
		createdWheelId,
		remainingSpins,
		isCancelled,
		entryFormEnabled,
		accountFromWallet,
		isNotOrganizer,
		shuffledIndexOrder = [],
		selectedCoinType = DEFAULT_COIN_TYPE,
		mode = 'participants',
		rewards = [],
		equalSlices = false,
		muted = $bindable(false)
	}: Props = $props();

	// Context deps/APIs from parent
	const ctx = wheelContext.get();
	const {
		packageId,
		WHEEL_MODULE,
		WHEEL_FUNCTIONS,
		RANDOM_OBJECT_ID,
		CLOCK_OBJECT_ID,
		VERSION_OBJECT_ID,
		fetchWheelFromChain,
		setSpinning,
		onShuffle,
		onClearAllEntries,
		removeEntry,
		onOffchainWinner
	} = ctx;

	let isSpinDisabled = $derived.by(() => {
		if (spinning) return true;
		// Disable if online entry form is active
		if (entryFormEnabled) return true;
		// Disable if not organizer
		if (isNotOrganizer) return true;
		// On-chain: disable if no remaining spins
		if (createdWheelId) {
			if (accountFromWallet) {
				return isCancelled || remainingSpins === 0;
			} else {
				return entries.length < 2;
			}
		}
		// Off-chain: disable if not enough entries
		if (accountFromWallet && !createdWheelId) return true;
		const itemCount = mode === 'rewards' ? rewards.length : entries.length;
		// Not enough items to spin
		return itemCount < 2;
	});

	// Local state
	const idle = new IsIdle({ timeout: 15000 });
	let progressing = $state(false);
	let selectedIndex = $state<number | null>(null);
	let spinAngle = $state(0);
	let pointerIndex = 0;
	let pointerColor = $state('#ef4444');
	let pointerColorOverride = $state(''); // sea color #4DA2FF
	let lastWinner = $state('');
	let lastWinnerIcon = $state('');
	let secondaryWinner = $state('');
	let usedCombinedSpin = $state(false);
	let postSpinFetchRequested = $state(false);
	let unfoldProgress = $state(0); // 0 to 1, controls how many slices are visible
	let previousItemCount = $state(0); // Track previous count to detect new entries
	let previousWheelId = $state<string | undefined>(undefined); // Track wheel ID changes

	// Canvas/layout
	let labelLayouts = $state<LabelLayout[]>([]);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let canvasContainerEl = $state<HTMLDivElement | null>(null);
	let ctx2d: CanvasRenderingContext2D | null = null;
	let wheelSize = $state(0);
	let offscreenCanvas: HTMLCanvasElement | null = null;
	let offscreenCtx: CanvasRenderingContext2D | null = null;
	let loadedImages = $state<Record<string, HTMLImageElement>>({});

	// Elements
	let pointerLogoEl = $state<SVGElement | null>(null);

	// Audio
	// Use Web Audio API for better timing validation on mobile
	let audioContext: AudioContext | null = null;
	let tickBuffer: AudioBuffer | null = null;
	let tickGainNode: GainNode | null = null;
	let winBuffer: AudioBuffer | null = null;
	let winGainNode: GainNode | null = null;

	// Modal
	let winnerModal = $state<HTMLDialogElement | null>(null);

	// Animation state
	type TweenLike = { kill: () => void };
	let currentTween: TweenLike | null = null;
	let idleTween: TweenLike | null = null;
	const idleAnimState = { angle: 0 };
	const animState = { angle: 0 };
	let lastTickIndex: number | null = null;
	let lastAngle = 0;

	let gsap: any = null;
	async function ensureGsap() {
		if (gsap) return gsap;
		const mod: any = await import('gsap');
		gsap = mod?.gsap ?? mod?.default ?? mod;
		gsap.ticker.fps(-1);
		return gsap;
	}

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

	// Helper function to adjust color brightness for gradients
	function adjustBrightness(color: string, amount: number): string {
		const hex = color.replace('#', '');
		const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount * 255));
		const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount * 255));
		const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount * 255));
		return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
	}

	// Handle Space key to spin the wheel
	function handleKeyDown(event: KeyboardEvent) {
		// Only handle Space key
		if (event.code !== 'Space') return;

		// Don't trigger if user is typing in an input/textarea
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		// Don't trigger if spin is disabled
		if (isSpinDisabled) return;

		// Prevent default space behavior (scrolling)
		event.preventDefault();

		// Trigger the appropriate spin function
		if (accountFromWallet) {
			spinOnChainAndAnimate();
		} else {
			spin();
		}
	}

	// Use runed's useEventListener for automatic cleanup
	useEventListener(() => window, 'keydown', handleKeyDown);

	onMount(async () => {
		const gsapLib = await ensureGsap();

		// Animate unfold progress from 0 to 1
		gsapLib.to(
			{ value: 0 },
			{
				value: 1,
				duration: 1.2,
				ease: 'power2.out',
				onUpdate: function () {
					unfoldProgress = this.targets()[0].value;
				},
				onComplete: () => {
					unfoldProgress = 1;
					startIdleRotationIfNeeded();
				}
			}
		);

		// Initialize Web Audio API for instant tick sounds
		try {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			audioContext = new AudioContextClass();

			// Setup tick sound
			tickGainNode = audioContext.createGain();
			tickGainNode.connect(audioContext.destination);
			tickGainNode.gain.value = 1; // Volume control

			// Setup win sound
			winGainNode = audioContext.createGain();
			winGainNode.connect(audioContext.destination);
			winGainNode.gain.value = 0.5; // Win sound is louder/longer, keep it reasonable

			// Load tick sound as AudioBuffer for instant playback
			const response = await fetch('/tick.mp3');
			const arrayBuffer = await response.arrayBuffer();
			tickBuffer = await audioContext.decodeAudioData(arrayBuffer);

			// Load win sound
			const winResponse = await fetch('/crowd-reaction.mp3');
			const winArrayBuffer = await winResponse.arrayBuffer();
			winBuffer = await audioContext.decodeAudioData(winArrayBuffer);
		} catch (e) {
			console.warn('Web Audio API not supported or failed to load sounds:', e);
		}
	});

	// Watch entries for layout updates
	watch(
		() => [entries, rewards, mode, loadedImages, equalSlices, unfoldProgress],
		() => {
			recomputeLabelLayouts();
			renderWheelBitmap();
			drawStaticWheel();
			updatePointerColor();
		}
	);

	// Watch for entries changes and animate
	watch(
		() => [mode === 'rewards' ? rewards.length : entries.length],
		() => {
			const currentItemCount = mode === 'rewards' ? rewards.length : entries.length;

			// If items increased, animate the new slice
			if (previousItemCount > 0 && currentItemCount > previousItemCount && unfoldProgress >= 1) {
				// Calculate progress to show only the new slice unfolding
				const startProgress = previousItemCount / currentItemCount;
				unfoldProgress = startProgress;

				// Animate to full
				void ensureGsap().then((gsapLib) => {
					gsapLib.to(
						{ value: startProgress },
						{
							value: 1,
							duration: 0.4,
							ease: 'back.out(1.7)',
							onUpdate: function () {
								unfoldProgress = this.targets()[0].value;
							}
						}
					);
				});
			}

			// If items decreased (winner removed), animate unfold from 0
			if (previousItemCount > 0 && currentItemCount < previousItemCount && unfoldProgress >= 1) {
				unfoldProgress = 0;

				// Animate unfold effect like onMount
				void ensureGsap().then((gsapLib) => {
					gsapLib.to(
						{ value: 0 },
						{
							value: 1,
							duration: 1.2,
							ease: 'power2.out',
							onUpdate: function () {
								unfoldProgress = this.targets()[0].value;
							}
						}
					);
				});
			}

			previousItemCount = currentItemCount;
		}
	);

	// Watch for wheel creation on-chain and animate unfold
	watch(
		() => [createdWheelId, entries.length],
		() => {
			// When createdWheelId changes from undefined/null to a value (wheel just created)
			if (!previousWheelId && createdWheelId && entries.length > 0) {
				unfoldProgress = 0;

				// Animate unfold effect for newly created wheel
				void ensureGsap().then((gsapLib) => {
					gsapLib.to(
						{ value: 0 },
						{
							value: 1,
							duration: 1.2,
							ease: 'power2.out',
							onUpdate: function () {
								unfoldProgress = this.targets()[0].value;
							}
						}
					);
				});
			}

			previousWheelId = createdWheelId;
		}
	);

	// Preload reward icons
	$effect(() => {
		if (mode === 'rewards' && rewards.length > 0) {
			rewards.forEach((r) => {
				if (r.icon && !loadedImages[r.icon]) {
					// Use Iconify API to get SVG icon as image with explicit dimensions
					const iconUrl = `https://api.iconify.design/lucide/${r.icon}.svg?color=black&width=48&height=48`;
					const img = new Image();
					img.crossOrigin = 'anonymous';
					img.onload = () => {
						// Ensure reactivity in Svelte 5 by replacing the object
						loadedImages = { ...loadedImages, [r.icon!]: img };
					};
					img.onerror = () => {
						console.error('Failed to load icon:', iconUrl);
					};
					img.src = iconUrl;
				}
			});
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
			const angle = (spinAngle * 180) / Math.PI;
			canvasEl.style.transform = `rotate(${angle}deg) translateZ(0)`;
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
			// Add hardware acceleration hints
			canvasEl.style.transform = 'translateZ(0)';
			canvasEl.style.perspective = '1000px';
		}
	});

	onDestroy(() => {
		if (resizeObserver && canvasContainerEl) resizeObserver.unobserve(canvasContainerEl);
		if (currentTween) {
			currentTween.kill();
			currentTween = null;
		}
	});

	function mod(v: number, n: number): number {
		return ((v % n) + n) % n;
	}

	let lastTickTime = 0;
	function fireTickForIndex(idx: number) {
		// Throttle tick rate to avoid audio engine overload and GC stutter (max ~20-25 ticks/sec)
		const now = Date.now();
		if (now - lastTickTime < 40) return;
		lastTickTime = now;

		// Trigger pointer bounce animation
		triggerPointerBounce();

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
	}

	function playWinSound() {
		if (muted) return;
		if (!audioContext || !winBuffer || !winGainNode) return;

		try {
			if (audioContext.state === 'suspended') {
				audioContext.resume();
			}
			const source = audioContext.createBufferSource();
			source.buffer = winBuffer;
			source.connect(winGainNode);
			source.start(0);
		} catch (e) {
			console.warn('Failed to play win sound:', e);
		}
	}

	function triggerPointerBounce() {
		if (!pointerLogoEl || !gsap) return;
		// Use GSAP for performant animation instead of CSS class toggling
		gsap.fromTo(
			pointerLogoEl,
			{ rotation: -90 },
			{
				rotation: -115,
				duration: 0.05,
				yoyo: true,
				repeat: 1,
				ease: 'power1.out',
				overwrite: true // Important: kill previous tweens to prevent conflict/memory leak
			}
		);
	}

	function updatePointerColor(currentAngle?: number) {
		const angleToUse = currentAngle ?? spinAngle;
		const sliceCount =
			mode === 'rewards' && rewards.length > 0 ? rewards.length : Math.max(1, entries.length);
		const normalized = (((Math.PI / 2 - angleToUse) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

		let newIndex = 0;
		if (mode === 'rewards' && rewards.length > 0) {
			if (equalSlices) {
				const count = rewards.length;
				const arc = (Math.PI * 2) / count;
				newIndex = Math.floor(normalized / arc) % count;
			} else {
				const totalProb = rewards.reduce((acc, r) => acc + r.probability, 0);
				let currentAngle = 0;
				for (let i = 0; i < rewards.length; i++) {
					const arcSize = (rewards[i].probability / totalProb) * Math.PI * 2;
					if (normalized >= currentAngle && normalized < currentAngle + arcSize) {
						newIndex = i;
						break;
					}
					currentAngle += arcSize;
				}
			}
		} else {
			const arc = (Math.PI * 2) / sliceCount;
			newIndex = Math.floor(normalized / arc) % sliceCount;
		}

		if (pointerColorOverride && pointerColorOverride.trim() !== '') {
			const newColor = pointerColorOverride.trim();
			if (pointerColor !== newColor) pointerColor = newColor;
		} else {
			const newColor = segmentColors[newIndex % segmentColors.length];
			if (pointerColor !== newColor) pointerColor = newColor;
		}

		if (!spinning) {
			pointerIndex = newIndex;
			lastTickIndex = newIndex;
			lastAngle = angleToUse;
			return;
		}

		const deltaAngle = angleToUse - lastAngle;

		if (lastTickIndex === null) {
			lastTickIndex = newIndex;
			lastAngle = angleToUse;
			pointerIndex = newIndex;
			return;
		}

		if (newIndex !== lastTickIndex && deltaAngle !== 0) {
			const dir = deltaAngle > 0 ? -1 : 1;
			const steps =
				dir > 0
					? mod(newIndex - lastTickIndex, sliceCount)
					: mod(lastTickIndex - newIndex, sliceCount);
			const MAX_TICKS_PER_FRAME = 12;
			const toFire = Math.min(steps, MAX_TICKS_PER_FRAME);

			for (let i = 0; i < toFire; i++) {
				lastTickIndex = mod(lastTickIndex + dir, sliceCount);
				fireTickForIndex(lastTickIndex);
			}
		}

		pointerIndex = newIndex;
		lastAngle = angleToUse;
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
		const pinSizeScale = 0.6; // Slightly larger for better visibility

		// Defer drawing of rim pins until after all slices are filled so they stay on top
		const deferredPins = [];
		const baseStart = -Math.PI / 2;
		let currentStart = baseStart;

		const itemCount = mode === 'rewards' ? rewards.length : entries.length;
		const totalProb =
			mode === 'rewards' ? rewards.reduce((acc, r) => acc + r.probability, 0) : itemCount;

		// Calculate how many slices to show based on unfoldProgress
		const visibleSlices = Math.ceil(itemCount * unfoldProgress);

		for (let i = 0; i < itemCount; i++) {
			// Skip slices that haven't unfolded yet
			if (i >= visibleSlices) {
				currentStart +=
					equalSlices && mode === 'rewards'
						? (Math.PI * 2) / itemCount
						: ((mode === 'rewards' ? rewards[i].probability : 1) / totalProb) * Math.PI * 2;
				continue;
			}

			const itemProb = mode === 'rewards' ? rewards[i].probability : 1;
			const arcSize =
				equalSlices && mode === 'rewards'
					? (Math.PI * 2) / itemCount
					: (itemProb / totalProb) * Math.PI * 2;
			const start = currentStart;
			let end = start + arcSize;

			// Animate the currently unfolding slice
			if (i === visibleSlices - 1 && unfoldProgress < 1) {
				const sliceProgress = unfoldProgress * itemCount - i;
				end = start + arcSize * sliceProgress;
			}

			currentStart = start + arcSize; // Always advance by full arc

			c.beginPath();
			c.moveTo(centerX, centerY);
			c.arc(centerX, centerY, radius - 4, start, end);
			c.closePath();

			// Enhanced shadow for better depth perception
			const mid = (start + end) / 2;
			c.shadowColor = 'rgba(0,0,0,0.22)';
			c.shadowBlur = 10;
			const off = Math.max(3, Math.min(8, radius * 0.015));
			c.shadowOffsetX = Math.cos(mid - Math.PI / 2) * off;
			c.shadowOffsetY = Math.sin(mid - Math.PI / 2) * off;

			// Apply color with subtle gradient for depth
			const baseColor =
				mode === 'rewards' && rewards[i].color
					? (rewards[i].color as string)
					: segmentColors[i % segmentColors.length];

			// Create subtle radial gradient for each segment
			const gradient = c.createRadialGradient(
				centerX + Math.cos(mid) * radius * 0.3,
				centerY + Math.sin(mid) * radius * 0.3,
				0,
				centerX,
				centerY,
				radius
			);
			gradient.addColorStop(0, baseColor);
			gradient.addColorStop(1, adjustBrightness(baseColor, -0.15));
			c.fillStyle = gradient;
			c.fill();

			// Reset shadow to not affect stroke/label
			c.shadowColor = 'transparent';
			c.shadowBlur = 0;
			c.shadowOffsetX = 0;
			c.shadowOffsetY = 0;
			c.strokeStyle = 'rgba(0,0,0,0.08)';
			c.lineWidth = 2;
			c.stroke();

			const raw = mode === 'rewards' ? rewards[i].text : String(entries[i]).trim();
			const label = mode === 'participants' && isValidSuiAddress(raw) ? shortenAddress(raw) : raw;

			const innerRadius = Math.max(30, radius * 0.2);
			const outerRadius = radius - 10;
			const available = outerRadius - innerRadius;
			const padding = 10;

			// Draw icon as background watermark if exists
			if (mode === 'rewards' && rewards[i].icon && loadedImages[rewards[i].icon!]) {
				const img = loadedImages[rewards[i].icon!];
				c.save();
				c.translate(centerX, centerY);
				c.rotate(mid);

				// Draw icon with low opacity
				c.globalAlpha = 0.15;
				const imgSize = Math.min(available * 0.5, arcSize * radius * 0.6, 80);
				const imgX = innerRadius + (available - imgSize) / 2;
				const imgY = -imgSize / 2;

				c.drawImage(img, imgX, imgY, imgSize, imgSize);
				c.restore();
			}

			// Draw label on top
			if (label) {
				const layout = labelLayouts[i];
				if (layout && layout.displayText) {
					c.font = layout.font;
					c.fillStyle = '#111827';
					c.textAlign = mode === 'rewards' ? 'center' : 'right';
					c.textBaseline = 'middle';
					c.save();
					c.translate(centerX, centerY);
					c.rotate(mid);
					if (mode === 'rewards') {
						c.fillText(layout.displayText, innerRadius + available / 2, 0);
					} else {
						c.fillText(layout.displayText, innerRadius + available - padding, 0);
					}
					c.restore();
				}
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

		// Draw pins on top of all slices/labels with enhanced metallic effect
		for (const pin of deferredPins) {
			c.save();
			// Enhanced shadow for pins
			c.shadowColor = 'rgba(0,0,0,0.35)';
			c.shadowBlur = 6;
			c.shadowOffsetX = 0;
			c.shadowOffsetY = 2;

			// More realistic metallic gradient
			const g = c.createRadialGradient(
				pin.x - pin.r * 0.4,
				pin.y - pin.r * 0.4,
				0,
				pin.x,
				pin.y,
				pin.r
			);
			g.addColorStop(0, 'rgba(255,255,255,1)');
			g.addColorStop(0.4, 'rgba(230,230,230,0.98)');
			g.addColorStop(0.7, 'rgba(180,180,180,0.96)');
			g.addColorStop(1, 'rgba(140,140,140,0.94)');
			c.fillStyle = g;
			c.beginPath();
			c.arc(pin.x, pin.y, pin.r, 0, Math.PI * 2);
			c.fill();

			// Add subtle highlight
			c.shadowColor = 'transparent';
			c.shadowBlur = 0;
			c.strokeStyle = 'rgba(255,255,255,0.6)';
			c.lineWidth = 0.5;
			c.beginPath();
			c.arc(pin.x - pin.r * 0.3, pin.y - pin.r * 0.3, pin.r * 0.4, 0, Math.PI * 2);
			c.stroke();

			// Outer rim
			c.strokeStyle = 'rgba(0,0,0,0.3)';
			c.lineWidth = 1;
			c.beginPath();
			c.arc(pin.x, pin.y, pin.r, 0, Math.PI * 2);
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
		if (!gsap) return;
		if (spinning || currentTween || idleTween || !idle.current) return;
		idleAnimState.angle = spinAngle;
		idleTween = gsap.to(idleAnimState, {
			angle: idleAnimState.angle + Math.PI * 2,
			duration: 50, // Slower, more gentle rotation
			ease: 'linear',
			repeat: -1,
			onUpdate: () => {
				if (!spinning && !currentTween) {
					spinAngle = idleAnimState.angle;
					if (canvasEl) {
						// Use transform3d for better performance
						const angle = (spinAngle * 180) / Math.PI;
						canvasEl.style.transform = `rotate(${angle}deg) translateZ(0)`;
					}
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
		const n = mode === 'rewards' ? rewards.length : Math.max(1, entries.length);
		const radius = wheelSize / 2;
		const arc = (Math.PI * 2) / n;
		const innerRadius = Math.max(30, radius * 0.2);
		const outerRadius = radius - 10;
		const available = outerRadius - innerRadius;
		const padding = 10;
		const maxWidth = Math.max(0, available - padding);

		const layouts = new Array(n);
		const totalProb = mode === 'rewards' ? rewards.reduce((acc, r) => acc + r.probability, 0) : n;

		for (let i = 0; i < n; i++) {
			const itemProb = mode === 'rewards' ? rewards[i].probability : 1;
			const arcSize =
				equalSlices && mode === 'rewards'
					? (Math.PI * 2) / n
					: (itemProb / totalProb) * Math.PI * 2;
			const raw = mode === 'rewards' ? rewards[i].text : String(entries[i] ?? '').trim();
			const baseLabel =
				mode === 'participants' && isValidSuiAddress(raw) ? shortenAddress(raw) : raw;
			if (!baseLabel) {
				layouts[i] = { displayText: '', font: '' };
				continue;
			}
			const arcDegrees = (arcSize * 180) / Math.PI;
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

	function getGsapEaseFromPower(power = 4): string {
		const p = Math.max(1, Math.min(4, Math.floor(Number(power) || 4)));
		return `power${p}.out`;
	}

	function normalizeAngle(radians: number): number {
		const tau = Math.PI * 2;
		return ((radians % tau) + tau) % tau;
	}

	function pickSelectedIndex() {
		const normalized = (((Math.PI / 2 - spinAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

		if (mode === 'rewards' && rewards.length > 0) {
			if (equalSlices) {
				const arc = (Math.PI * 2) / rewards.length;
				return Math.floor(normalized / arc) % rewards.length;
			}
			const totalProb = rewards.reduce((acc, r) => acc + r.probability, 0);
			let currentAngle = 0;
			for (let i = 0; i < rewards.length; i++) {
				const arcSize = (rewards[i].probability / totalProb) * Math.PI * 2;
				if (normalized >= currentAngle && normalized <= currentAngle + arcSize) {
					return i;
				}
				currentAngle += arcSize;
			}
			return rewards.length - 1;
		} else {
			const n = Math.max(1, entries.length);
			const arc = (Math.PI * 2) / n;
			const idx = Math.floor(normalized / arc) % n;
			return idx;
		}
	}

	async function spinOnChainAndAnimate() {
		if (audioContext && audioContext.state === 'suspended') {
			void audioContext.resume();
		}
		if (!accountFromWallet) return;
		if (isNotOrganizer) {
			return toast({ type: 'error', message: t('wheel.notOrganizer'), position: 'top-right' });
		}
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
					.map((s: string) => String(s ?? '').trim())
					.filter((s: string) => s.length > 0);
			} catch {}
			const uniqueLeft = (() => {
				try {
					const set = new Set(remainingEntriesList.map((s: string) => s.toLowerCase()));
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

			let targetFn: string;
			if (shouldAssignLast) {
				targetFn = isOrderShuffled
					? (WHEEL_FUNCTIONS?.SPIN_AND_ASSIGN_LAST_WITH_ORDER ?? 'spin_and_assign_last_with_order')
					: (WHEEL_FUNCTIONS?.SPIN_AND_ASSIGN_LAST ?? 'spin_and_assign_last');
			} else {
				targetFn = isOrderShuffled
					? (WHEEL_FUNCTIONS?.SPIN_WITH_ORDER ?? 'spin_with_order')
					: (WHEEL_FUNCTIONS?.SPIN ?? 'spin');
			}

			// Build transaction arguments
			const txArgs: TransactionArgument[] = [tx.object(createdWheelId)];

			// Add shuffled order if needed (must come after wheel object)
			if (isOrderShuffled) {
				txArgs.push(tx.pure.vector('u64', shuffledIndexOrder));
			}

			// Add remaining arguments
			if (RANDOM_OBJECT_ID) txArgs.push(tx.object(RANDOM_OBJECT_ID));
			if (CLOCK_OBJECT_ID) txArgs.push(tx.object(CLOCK_OBJECT_ID));

			// Version object validates transaction against current contract version
			if (VERSION_OBJECT_ID) txArgs.push(tx.object(VERSION_OBJECT_ID));

			tx.moveCall({
				target: `${packageId}::${WHEEL_MODULE}::${targetFn}`,
				typeArguments: [selectedCoinType],
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
				const spinEventType = `${packageId}::${WHEEL_MODULE}::${WHEEL_EVENTS.SPIN}`;
				const spinEvents = (txBlock?.events || []).filter((e) => {
					const t = String(e?.type || '');
					return t === spinEventType || t.endsWith(`::${WHEEL_MODULE}::${WHEEL_EVENTS.SPIN}`);
				});
				const firstEv = spinEvents?.[0];
				const parsed = (firstEv?.parsedJson || {}) as Record<string, unknown>;
				const winnerAddr = String(
					parsed?.winner ?? parsed?.winner_address ?? parsed?.winnerAddress ?? ''
				).toLowerCase();
				if (winnerAddr) {
					const candidateIdxs = entries.reduce((acc: number[], a: string, i: number) => {
						if (String(a ?? '').toLowerCase() === winnerAddr) acc.push(i);
						return acc;
					}, []);
					targetIdx = candidateIdxs.length
						? candidateIdxs[Math.floor(Math.random() * candidateIdxs.length)]
						: -1;
				}

				// Persist winner to Database API
				try {
					const prizeIndexRaw = Number((parsed?.prize_index ?? parsed?.prizeIndex ?? -1) as number);
					if (
						createdWheelId &&
						winnerAddr &&
						Number.isFinite(prizeIndexRaw) &&
						prizeIndexRaw >= 0
					) {
						await fetch('/api/wheels/winner', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								wheelId: createdWheelId,
								winnerAddress: winnerAddr,
								prizeIndex: prizeIndexRaw,
								spinTxDigest: digest,
								spinTime: new Date().toISOString()
							})
						});
					}
				} catch (persistErr) {
					console.error('Failed to persist spin winner:', persistErr);
				}
				if (usedCombinedSpin && spinEvents.length > 1) {
					const secondParsed = (spinEvents[1]?.parsedJson || {}) as Record<string, unknown>;
					const secondAddr = String(
						secondParsed?.winner ??
							secondParsed?.winner_address ??
							secondParsed?.winnerAddress ??
							''
					).toLowerCase();
					if (secondAddr) secondaryWinner = secondAddr;

					// Handle combined spin second winner persist (best effort without prize_index)
					try {
						const secondPrizeIndex = Number((secondParsed?.prize_index ?? -1) as number);
						if (
							createdWheelId &&
							secondAddr &&
							Number.isFinite(secondPrizeIndex) &&
							secondPrizeIndex >= 0
						) {
							await fetch('/api/wheels/winner', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									wheelId: createdWheelId,
									winnerAddress: secondAddr,
									prizeIndex: secondPrizeIndex,
									spinTxDigest: digest,
									spinTime: new Date().toISOString()
								})
							});
						}
					} catch (persistErr2) {
						console.error('Failed to persist second winner:', persistErr2);
					}
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
			const error = e as { message?: string } | Error;
			toast({
				type: 'error',
				message: error?.message || String(e),
				position: 'bottom-right'
			});
			setSpinning?.(false);
			progressing = false;
		}
	}

	function spin() {
		if (audioContext && audioContext.state === 'suspended') {
			void audioContext.resume();
		}
		if (accountFromWallet) return;

		const itemCount = mode === 'rewards' ? rewards.length : entries.length;
		if (spinning || itemCount < 2) return;

		let targetIndex = 0;
		if (mode === 'rewards') {
			const totalProb = rewards.reduce((acc, r) => acc + r.probability, 0);
			const random = Math.random() * totalProb;
			let currentProbSum = 0;
			for (let i = 0; i < rewards.length; i++) {
				currentProbSum += rewards[i].probability;
				if (random <= currentProbSum) {
					targetIndex = i;
					break;
				}
			}
		} else {
			targetIndex = Math.floor(Math.random() * itemCount);
		}

		spinToIndex(targetIndex, {
			duration: 10000,
			extraTurnsMin: 6,
			extraTurnsMax: 10,
			marginFraction: 0.1, // Increase margin for safety with variable sizes
			easePower: 3
		});
	}

	function showConfetti() {
		try {
			const cf =
				typeof window !== 'undefined'
					? (window as unknown as { confetti?: (opts: unknown) => void }).confetti
					: undefined;
			if (typeof cf === 'function') {
				const duration = 3000;
				const animationEnd = Date.now() + duration;
				const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
				function randomInRange(min: number, max: number): number {
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

	function spinToIndex(targetIndex: number, opts: SpinOptions = {}) {
		const itemCount = mode === 'rewards' ? rewards.length : entries.length;
		const n = Math.max(1, itemCount);
		if (spinning || itemCount < 1) return;
		if (!gsap) {
			void ensureGsap().then(() => spinToIndex(targetIndex, opts));
			return;
		}
		const idx = Math.max(0, Math.min(n - 1, Number(targetIndex) | 0));
		setSpinning?.(true);
		selectedIndex = null;
		lastTickIndex = null;

		const startAngle = spinAngle;
		lastAngle = startAngle;

		let arc = 0;
		let startTheta = 0;

		if (mode === 'rewards' && rewards.length > 0) {
			const totalProb = rewards.reduce((acc, r) => acc + r.probability, 0);
			if (equalSlices) {
				arc = (Math.PI * 2) / rewards.length;
				startTheta = idx * arc;
			} else {
				arc = (rewards[idx].probability / totalProb) * Math.PI * 2;
				// Calculate start angle of this segment
				for (let i = 0; i < idx; i++) {
					startTheta += (rewards[i].probability / totalProb) * Math.PI * 2;
				}
			}
		} else {
			arc = (Math.PI * 2) / n;
			startTheta = idx * arc;
		}

		const marginFraction = Math.max(0, Math.min(0.49, opts.marginFraction ?? 0.05));
		const margin = arc * marginFraction;
		const innerWidth = Math.max(0, arc - 2 * margin);
		const randomWithin = margin + Math.random() * innerWidth;
		const targetTheta = startTheta + randomWithin;
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
				const currentAngle = animState.angle;
				if (canvasEl) {
					// Use degree for better browser optimization
					const angle = (currentAngle * 180) / Math.PI;
					canvasEl.style.transform = `rotate(${angle}deg) translateZ(0)`;
				}
				updatePointerColor(currentAngle);
			},
			onComplete: () => {
				spinAngle = animState.angle;
				currentTween = null;
				setSpinning?.(false);
				selectedIndex = pickSelectedIndex(); // Restore this call
				const winnerIndex = selectedIndex;
				const isLossReward =
					mode === 'rewards' &&
					winnerIndex !== null &&
					(rewards[winnerIndex]?.isLoss || rewards[winnerIndex]?.icon === 'x');

				updatePointerColor();
				if (!muted && !isLossReward) {
					playWinSound();
				}

				if (winnerIndex !== null) {
					if (mode === 'rewards') {
						lastWinner = rewards[winnerIndex].text;
						lastWinnerIcon = rewards[winnerIndex].icon || 'gift';
					} else {
						lastWinner = String(entries[winnerIndex] ?? '');
						lastWinnerIcon = '';
					}
				}
				if (usedCombinedSpin && secondaryWinner) {
					// keep secondaryWinner
				}
				if (lastWinner) {
					// Notify parent about off-chain winner for history tracking
					if (!postSpinFetchRequested && !createdWheelId) {
						onOffchainWinner?.(lastWinner);
						if (selectedIndex !== null && mode === 'participants') {
							const winnerValue = entries[selectedIndex];
							removeEntry?.(String(winnerValue ?? ''));
						}
					}
					selectedIndex = null;
					if (!createdWheelId) spinAngle = 0;
					if (winnerModal) {
						winnerModal.showModal();
						if (!isLossReward) {
							showConfetti();
						}
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
			const angle = (spinAngle * 180) / Math.PI;
			canvasEl.style.transform = `rotate(${angle}deg) translateZ(0)`;
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

<div class="relative mx-auto max-w-[560px] overflow-visible">
	<div class="rounded-box p-8 sm:p-6">
		<div
			bind:this={canvasContainerEl}
			class="relative mx-auto aspect-square w-full rounded-full border-4 border-amber-400/70 shadow-2xl"
			style="box-shadow: 0 0 40px rgba(251, 191, 36, 0.3), 0 20px 60px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(251, 191, 36, 0.1);"
		>
			<!-- Pointer -->
			<div
				class="pointer-events-none absolute top-1/2 -right-6 z-10 -translate-y-1/2 sm:-right-9"
				aria-hidden="true"
				style="transition: filter 0.15s ease-out;"
			>
				<svg
					bind:this={pointerLogoEl}
					width="52"
					height="52"
					viewBox="0 0 96 123"
					xmlns="http://www.w3.org/2000/svg"
					class="pointer-logo block h-10 w-10 sm:h-[52px] sm:w-[52px]"
					style={`filter: drop-shadow(0 0 16px ${pointerColor}95) drop-shadow(0 0 8px ${pointerColor})`}
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
			<canvas bind:this={canvasEl} class="pointer-events-none mx-auto block rounded-box"></canvas>

			<!-- Spin button -->
			<div
				class="pointer-events-none absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
			>
				<div class="relative h-16 w-16 sm:h-20 sm:w-20">
					<!-- Glow effect behind button -->
					<div class="absolute inset-0 animate-pulse rounded-full bg-amber-400/30 blur-xl"></div>
					<ButtonLoading
						formLoading={spinning}
						size="lg"
						loadingText={progressing ? t('wheel.confirming') : t('wheel.spinning')}
						onclick={accountFromWallet ? spinOnChainAndAnimate : spin}
						aria-label={t('wheel.spinTheWheel')}
						className={`border-0 w-full h-full rounded-full text-gray-800 !pointer-events-auto cursor-pointer disabled:cursor-not-allowed disabled:!shadow-lg disabled:opacity-70 disabled:text-gray-500 shadow-2xl ring-4 ring-amber-400/90 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 hover:from-amber-300 hover:via-amber-400 hover:to-amber-600 active:scale-95 transition-all duration-200 font-extrabold uppercase ${isSpinDisabled ? 'text-xs' : 'text-sm'}`}
						disabled={isSpinDisabled}
					>
						{t('wheel.spin')}
					</ButtonLoading>
				</div>
			</div>
		</div>

		{#if selectedIndex !== null && ((mode === 'participants' && entries[selectedIndex]) || (mode === 'rewards' && rewards[selectedIndex]))}
			<div class="mt-3 text-center">
				<div class="badge animate-pulse badge-lg badge-success">🎯 {t('wheel.winner')}</div>
				<div
					class="mt-2 rounded-lg border border-success/20 bg-success/10 px-4 py-2 text-lg font-bold break-words text-success"
				>
					{mode === 'rewards' ? rewards[selectedIndex].text : entries[selectedIndex]}
				</div>
			</div>
		{/if}

		{#if mode === 'participants' && (!createdWheelId || (createdWheelId && (remainingSpins ?? 0) > 0))}
			<div class="mt-4 flex flex-col flex-wrap items-center justify-center gap-3">
				<button
					class="btn btn-outline"
					class:btn-disabled={spinning || entries.length < 2}
					disabled={spinning || entries.length < 2}
					onclick={onShuffle}
					aria-label={t('wheel.shuffleEntries')}
				>
					<span class="icon-[lucide--shuffle] h-4 w-4"></span>
					{t('wheel.shuffle')}
				</button>

				<!-- Keyboard shortcut hint - only on desktop, when spin is available -->
				{#if !isSpinDisabled && !spinning}
					<div class="hidden items-center gap-1.5 text-xs text-base-content/50 md:flex">
						<span>{t('wheel.pressToSpin') || 'Press'}</span>
						<kbd class="kbd kbd-sm">Space</kbd>
						<span>{t('wheel.toSpin') || 'to spin'}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<dialog bind:this={winnerModal} class="modal">
	<div class="w- modal-box">
		<h3 class="mb-6 text-center text-2xl font-bold">
			{#if mode === 'rewards'}
				✨ {t('wheel.result')} ✨
			{:else}
				🎉 {t('wheel.congratulations')}!
			{/if}
		</h3>
		<div class="text-center">
			<div class="relative">
				<div
					class="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-r opacity-30 blur-xl {mode ===
					'rewards'
						? 'from-blue-400 via-indigo-500 to-purple-500'
						: 'from-green-400 via-emerald-500 to-teal-500'}"
				></div>
				<div
					class="relative block transform overflow-hidden rounded-xl border-4 border-yellow-400 bg-gradient-to-r px-8 py-4 text-3xl font-black text-white shadow-2xl transition-all duration-300 hover:scale-101 {mode ===
					'rewards'
						? 'from-blue-500 to-indigo-600'
						: 'from-green-500 to-emerald-600'}"
				>
					{#if mode === 'rewards'}
						<div
							class="icon-[lucide--{lastWinnerIcon ||
								'gift'}] pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl opacity-15"
						></div>
					{/if}

					<div class="relative flex items-center justify-center gap-3">
						{#if mode === 'rewards'}
							<span class="icon-[lucide--{lastWinnerIcon || 'gift'}] text-4xl"></span>
						{:else}
							<span class="text-4xl">🏆</span>
						{/if}

						<span class="drop-shadow-lg"
							>{isValidSuiAddress(lastWinner) ? shortenAddress(lastWinner) : lastWinner}</span
						>

						{#if mode === 'rewards'}
							<span class="icon-[lucide--{lastWinnerIcon || 'gift'}] text-4xl"></span>
						{:else}
							<span class="text-4xl">🏆</span>
						{/if}
					</div>
				</div>
				{#if usedCombinedSpin && secondaryWinner}
					<div class="mt-3 text-center text-sm">
						<span class="opacity-80">{t('wheel.alsoAssigned')}:</span>
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
			{#if mode === 'participants'}
				<small class="mt-5 block text-gray-500">{t('wheel.winnerWillBeAutomaticallyRemoved')}</small
				>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>{t('wheel.close')}</button>
	</form>
</dialog>

<style>
	/* Base rotation for pointer logo */
	.pointer-logo {
		transform: rotate(-90deg);
		transform-origin: center center;
	}

	/* Wheel unfold animation - like a paper fan opening */
	.wheel-unfold {
		animation: wheelUnfold 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes wheelUnfold {
		0% {
			clip-path: circle(0% at 50% 50%);
			transform: scale(0.3) rotate(-180deg) translateZ(0);
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
		100% {
			clip-path: circle(100% at 50% 50%);
			transform: scale(1) rotate(0deg) translateZ(0);
			opacity: 1;
		}
	}
</style>
