<script>
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';

	// Props
	let {
		segments = [
			'100$',
			'200$',
			'500$',
			'Jackpot!',
			'Try again',
			'50$',
			'Free spin',
			'250$',
			'100$',
			'200$',
			'500$',
			'Jackpot!'
		],
		colors = [
			'#F44336',
			'#9C27B0',
			'#2196F3',
			'#4CAF50',
			'#CDDC39',
			'#FF9800',
			'#F44336',
			'#9C27B0',
			'#2196F3',
			'#4CAF50',
			'#CDDC39',
			'#FF9800'
		],
		size = 500,
		targetIndex = null, // Index from server (0-11)
		onSpinComplete = () => {}
	} = $props();

	// State
	let wheelElement;
	let currentElement;
	let isSpinning = $state(false);
	let iteration = $state(0);
	let rotationLast = $state(0);

	// Text handling
	const segmentAngle = $derived(360 / segments.length);
	const innerRadius = $derived(Math.max(30, size * 0.1));
	const outerRadius = $derived(size * 0.4 - 10);

	// Function to get responsive font size based on segment angle and text length
	function getTextFontSize(text, index) {
		const arcDegrees = segmentAngle;
		const baseSize = Math.max(9, Math.min(17, arcDegrees * 0.75));
		const textLength = String(text).length;
		// Scale down for longer text
		const lengthScale = Math.max(0.6, 1 - (textLength - 5) * 0.05);
		return Math.max(9, Math.floor(baseSize * lengthScale));
	}

	// Function to truncate text if too long
	function getTruncatedText(text) {
		const str = String(text);
		const maxLength = Math.max(8, Math.floor(segmentAngle * 0.3));
		if (str.length <= maxLength) return str;
		return str.slice(0, maxLength - 1) + '…';
	}

	// Constants
	const angleOffset = 271;

	// Spin the wheel
	function spin() {
		if (isSpinning) return;

		isSpinning = true;
		rotationLast = gsap.getProperty(wheelElement, 'rotation') || 0;

		// Determine target index (from server or random)
		let selectedIndex;
		if (targetIndex !== null && targetIndex >= 0 && targetIndex < segments.length) {
			selectedIndex = targetIndex;
		} else {
			selectedIndex = Math.floor(Math.random() * segments.length);
		}

		// Calculate where target segment should be positioned
		const segmentAngle = 360 / segments.length;
		const currentNorm = ((rotationLast % 360) + 360) % 360; // 0-359

		// Calculate target segment boundaries
		// Text layout: segments[0] at -90°, segments[1] at -90° + segmentAngle, etc.
		// Pointer is at 0° (right side)
		const segmentStartAngle = 120 - (selectedIndex + 1) * segmentAngle; // Start of target segment
		const segmentEndAngle = 120 - selectedIndex * segmentAngle; // End of target segment

		// Add randomization WITHIN the target segment boundaries (never goes outside)
		const segmentMargin = segmentAngle * 0.15; // 15% margin from edges
		const safeStartAngle = segmentStartAngle + segmentMargin;
		const safeEndAngle = segmentEndAngle - segmentMargin;
		const randomAngleInSegment = safeStartAngle + Math.random() * (safeEndAngle - safeStartAngle);

		const targetAngleNorm = ((randomAngleInSegment % 360) + 360) % 360;

		// Debug: Verify we're within target segment
		console.log('Segment Boundaries Debug:', {
			selectedIndex,
			segmentAngle,
			segmentStartAngle,
			segmentEndAngle,
			safeStartAngle,
			safeEndAngle,
			randomAngleInSegment,
			targetAngleNorm
		});

		// Delta needed from current normalized rotation to reach target normalized angle
		const delta = (targetAngleNorm - currentNorm + 360) % 360;

		// Add a few full spins for visual effect (with slight randomization)
		const spins = 4 + Math.floor(Math.random() * 2); // 4 or 5 full rotations for natural feel
		const rotationNext = rotationLast + spins * 360 + delta;

		// Create timelines
		const indicator = gsap.timeline();
		const luckywheel = gsap.timeline();

		// Indicator animation
		indicator
			.to(currentElement, {
				duration: 0.13,
				rotation: -10,
				transformOrigin: '65% 36%'
			})
			.to(currentElement, {
				duration: 0.13,
				rotation: 3,
				ease: 'power4'
			})
			.add('end');

		// Track last rotation during updates to detect sector crossings
		let lastRotationForIndicator = rotationLast;

		// Wheel animation
		luckywheel.to(wheelElement, {
			duration: 5,
			rotation: rotationNext,
			transformOrigin: '50% 50%',
			ease: 'power4',
			onComplete: () => {
				isSpinning = false;
				iteration++;

				// Debug: Verify final result
				const finalRotation = gsap.getProperty(wheelElement, 'rotation');
				const finalNorm = ((finalRotation % 360) + 360) % 360;
				const finalSegmentIndex =
					Math.floor(((360 - finalNorm + 120) % 360) / segmentAngle) % segments.length;
				console.log('Final Result:', {
					finalNorm,
					finalSegmentIndex,
					actualSegment: segments[finalSegmentIndex],
					expectedSegment: segments[selectedIndex],
					isCorrect: finalSegmentIndex === selectedIndex
				});

				onSpinComplete(segments[selectedIndex]);
			},
			onUpdate: () => {
				const rotationCurrent = gsap.getProperty(wheelElement, 'rotation');

				// Normalize for sector detection
				const prevNorm = ((lastRotationForIndicator % 360) + 360) % 360;
				const currNorm = ((rotationCurrent % 360) + 360) % 360;

				const prevSector = Math.floor(((prevNorm + angleOffset) % 360) / segmentAngle);
				const currSector = Math.floor(((currNorm + angleOffset) % 360) / segmentAngle);

				if (currSector !== prevSector) {
					if (indicator.progress() > 0.2 || indicator.progress() === 0) {
						indicator.play(0);
					}
				}

				lastRotationForIndicator = rotationCurrent;
				rotationLast = Math.round(rotationCurrent);
			}
		});
	}
</script>

<div class="luckywheel">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 730 730"
		style="width: {size}px; height: {size}px;"
	>
		<g class="wheel" bind:this={wheelElement}>
			<circle class="frame" cx="365" cy="365" r="347.6" />
			<g class="sticks">
				<rect x="360.4" width="9.3" height="24.33" rx="4" ry="4" />
				<rect
					x="352.8"
					y="713.2"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(1082.8 352.8) rotate(90)"
				/>
				<rect
					x="176.4"
					y="54.8"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(145.8 -133.6) rotate(60)"
				/>
				<rect
					x="529.2"
					y="665.9"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(851.4 -133.6) rotate(60)"
				/>
				<rect
					x="47.3"
					y="183.9"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(102.3 -4.5) rotate(30)"
				/>
				<rect
					x="658.4"
					y="536.8"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(360.5 -262.7) rotate(30)"
				/>
				<rect y="360.4" width="24.3" height="9.27" rx="4" ry="4" />
				<rect x="705.7" y="360.4" width="24.3" height="9.27" rx="4" ry="4" />
				<rect
					x="47.3"
					y="536.8"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(-262.7 102.3) rotate(-30)"
				/>
				<rect
					x="658.4"
					y="183.9"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(-4.5 360.5) rotate(-30)"
				/>
				<rect
					x="176.4"
					y="665.9"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(-486.4 498.6) rotate(-60)"
				/>
				<rect
					x="529.2"
					y="54.8"
					width="24.3"
					height="9.27"
					rx="4"
					ry="4"
					transform="translate(219.2 498.6) rotate(-60)"
				/>
			</g>
			<g class="sectors">
				<path
					id="_1"
					d="M365,365V35.9A328.1,328.1,0,0,0,200.5,80Z"
					transform="translate(0)"
					fill={colors[0]}
				/>
				<path
					id="_2"
					d="M365,365,529.5,80A328.1,328.1,0,0,0,365,35.9Z"
					transform="translate(0)"
					fill={colors[1]}
				/>
				<path
					id="_3"
					d="M365,365,650,200.5A328.5,328.5,0,0,0,529.5,80Z"
					transform="translate(0)"
					fill={colors[2]}
				/>
				<path
					id="_4"
					d="M365,365H694.1A328.1,328.1,0,0,0,650,200.5Z"
					transform="translate(0)"
					fill={colors[3]}
				/>
				<path
					id="_5"
					d="M365,365,650,529.5A328.1,328.1,0,0,0,694.1,365Z"
					transform="translate(0)"
					fill={colors[4]}
				/>
				<path
					id="_6"
					d="M365,365,529.5,650A328.5,328.5,0,0,0,650,529.5Z"
					transform="translate(0)"
					fill={colors[5]}
				/>
				<path
					id="_7"
					d="M365,365V694.1A328.1,328.1,0,0,0,529.5,650Z"
					transform="translate(0)"
					fill={colors[6]}
				/>
				<path
					id="_8"
					d="M365,365,200.5,650A328.1,328.1,0,0,0,365,694.1Z"
					transform="translate(0)"
					fill={colors[7]}
				/>
				<path
					id="_9"
					d="M365,365,80,529.5A328.5,328.5,0,0,0,200.5,650Z"
					transform="translate(0)"
					fill={colors[8]}
				/>
				<path
					id="_10"
					d="M365,365H35.9A328.1,328.1,0,0,0,80,529.5Z"
					transform="translate(0)"
					fill={colors[9]}
				/>
				<path
					id="_11"
					d="M365,365,80,200.5A328.1,328.1,0,0,0,35.9,365Z"
					transform="translate(0)"
					fill={colors[10]}
				/>
				<path
					id="_12"
					d="M365,365,200.5,80A328.5,328.5,0,0,0,80,200.5Z"
					transform="translate(0)"
					fill={colors[11]}
				/>
			</g>
			<!-- Text labels -->
			<g class="labels">
				{#each segments as segment, index}
					{@const rad = (segmentAngle * Math.PI) / 180}
					{@const labelOffsetSegments = 2}
					{@const baseAngle = (index - labelOffsetSegments) * rad - Math.PI / 2}
					{@const midAngle = baseAngle + rad / 2}
					<!-- Middle of segment in radians -->
					{@const textRadius = 320}
					<!-- Near wheel edge -->
					{@const x = 365 + Math.cos(midAngle) * textRadius}
					{@const y = 365 + Math.sin(midAngle) * textRadius}
					{@const rotationDegrees = (midAngle * 180) / Math.PI}
					<!-- Convert back to degrees for transform -->
					{@const fontSize = getTextFontSize(segment, index)}
					{@const displayText = getTruncatedText(segment)}
					<text
						text-anchor="end"
						dominant-baseline="middle"
						class="segment-text"
						font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial"
						font-weight="600"
						font-size={fontSize}
						fill="#111827"
						transform="translate({365}, {365}) rotate({rotationDegrees}) translate({textRadius}, 0)"
					>
						{displayText}
					</text>
				{/each}
			</g>

			<g>
				<g opacity="0.2">
					<circle cx="368.5" cy="368.5" r="54.5" />
				</g>
				<g class="wheel_middle">
					<circle cx="365" cy="365" r="54.5" fill="#fff" />
				</g>
				<circle cx="365" cy="365" r="11.6" fill="#ccc" />
			</g>
		</g>
		<g opacity="0.15">
			<path
				d="M46.9,372.5c0-181.7,147.4-329,329.1-329A327.3,327.3,0,0,1,556.3,97.2,327.3,327.3,0,0,0,365,35.9C183.3,35.9,35.9,183.3,35.9,365c0,115.2,59.2,216.5,148.8,275.3C101.3,580.6,46.9,482.9,46.9,372.5Z"
				transform="translate(0)"
			/>
		</g>
		<g class="current" bind:this={currentElement}>
			<g>
				<path
					d="M707,160.5c-11.4-17.9-35.8-22.8-54.5-11a41.7,41.7,0,0,0-13.6,14.1l-33.6,58.9a2.3,2.3,0,0,0,0,2.4,2.4,2.4,0,0,0,2.3,1.1l67.5-5.1a43.8,43.8,0,0,0,18.6-6.3C712.4,202.7,718.3,178.5,707,160.5Z"
					transform="translate(0)"
					fill-opacity="0.22"
				/>
				<path
					class="indicator"
					d="M711.9,157.4a38.4,38.4,0,0,0-66,1.8l-31.5,57.5a2.1,2.1,0,0,0,0,2.4,2.6,2.6,0,0,0,2.2,1.2l65.6-3.9a39.6,39.6,0,0,0,17.9-5.9A38.5,38.5,0,0,0,711.9,157.4Z"
					transform="translate(0)"
				/>
				<path
					d="M681.7,166.9a9.3,9.3,0,0,0-6.6,4.8l-.8,2.1a14.9,14.9,0,0,0-.2,2.1,8.8,8.8,0,0,0,1.1,4.2,9.2,9.2,0,0,0,2.9,3,7.6,7.6,0,0,0,2.9,1.3l1.1.2a8.6,8.6,0,0,0,4.2-.6,8.4,8.4,0,0,0,3.4-2.5,7.4,7.4,0,0,0,2-3.8,8.5,8.5,0,0,0-.1-4.2,8.4,8.4,0,0,0-2.1-3.8,7.4,7.4,0,0,0-3.5-2.3l-1-.3A12.2,12.2,0,0,0,681.7,166.9Z"
					transform="translate(0)"
					fill="#ccc"
				/>
			</g>
		</g>
	</svg>
</div>

<div class="container">
	<div class="row">
		<div class="col-12">
			<button class="spin-button btn btn-primary" onclick={spin} disabled={isSpinning}>
				{isSpinning ? 'Spinning...' : 'Play!'}
			</button>
		</div>
	</div>
</div>

<style>
	/* Color variables removed; inline fills are used on sector paths */

	.frame,
	.sticks {
		fill: #fff;
	}

	.indicator {
		fill: #fff;
	}

	.wheel_middle {
		fill: #fff;
	}

	.luckywheel {
		margin: 20px auto;
		width: 60%;
		height: 60%;
		max-width: 500px;
	}

	.container {
		margin: auto;
		background-color: #dddddd;
		padding: 20px;
		border-radius: 10px;
		max-width: 500px;
		margin-top: 20px;
	}

	.row {
		display: flex;
		justify-content: center;
	}

	.col-12 {
		width: 100%;
		text-align: center;
	}

	.spin-button {
		background: linear-gradient(145deg, #007bff, #0056b3);
		color: white;
		border: none;
		padding: 12px 30px;
		border-radius: 25px;
		cursor: pointer;
		font-weight: bold;
		font-size: 16px;
		box-shadow: 0 4px 15px rgba(0, 123, 255, 0.4);
		transition: all 0.3s ease;
		margin-top: 20px;
	}

	.spin-button:hover:not(:disabled) {
		background: linear-gradient(145deg, #0056b3, #004085);
		transform: scale(1.05);
		box-shadow: 0 6px 20px rgba(0, 123, 255, 0.6);
	}

	.spin-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.spin-button:disabled {
		background: #ccc;
		cursor: not-allowed;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	/* Text styling */
	:global(.segment-text) {
		pointer-events: none;
		user-select: none;
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
	}
</style>
