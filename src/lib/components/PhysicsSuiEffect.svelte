<script lang="ts">
	import { onMount } from 'svelte';
	import gsap from 'gsap';

	interface Logo {
		id: number;
		x: number;
		y: number;
		rotation: number;
		scale: number;
	}

	let { trigger = false, logoUrl = '' } = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let logos = $state<Logo[]>([]);
	let nextId = 0;

	// Trigger animation when `trigger` changes from true to false (form shown)
	// We track previous state manually to detect the edge
	let lastTrigger: boolean | undefined = undefined;

	$effect(() => {
		// On first run, just sync state
		if (lastTrigger === undefined) {
			lastTrigger = trigger;
			return;
		}

		if (lastTrigger === true && trigger === false) {
			spawnLogos();
		}
		lastTrigger = trigger;
	});

	function spawnLogos() {
		const count = 12 + Math.floor(Math.random() * 8);
		const newLogos: Logo[] = [];

		// Spawn point: Right side, middle height
		const spawnX = window.innerWidth * 0.7;
		const spawnY = window.innerHeight * 0.4;

		for (let i = 0; i < count; i++) {
			newLogos.push({
				id: nextId++,
				x: spawnX,
				y: spawnY,
				rotation: Math.random() * 360,
				scale: 0.4 + Math.random() * 0.6
			});
		}

		logos = [...logos, ...newLogos];

		// Animate each logo
		newLogos.forEach((logo) => {
			setTimeout(() => {
				const el = document.getElementById(`sui-logo-${logo.id}`);
				if (!el) return;

				// Random "Explosion" velocity
				// Mostly throwing towards the left and varied verticality
				const vx = -(100 + Math.random() * 600);
				const vy = (Math.random() - 0.7) * 800; // Some go up, some go down

				animatePhysics(el, logo, vx, vy);
			}, 10);
		});
	}

	function animatePhysics(el: HTMLElement, logo: Logo, vx: number, vy: number) {
		const gravity = 0.5;
		const friction = 0.99; // Air friction (less for better throw)
		const groundFriction = 0.95; // Rolling resistance
		const bounce = 0.4 + Math.random() * 0.3;

		let currX = logo.x;
		let currY = logo.y;
		let currVx = vx / 60;
		let currVy = vy / 60;
		let currRot = logo.rotation;
		let currRotVel = (Math.random() - 0.5) * 20;
		let stopped = false;

		const footerEl = document.querySelector('footer');
		const logoSize = 40;
		const floor =
			(footerEl ? footerEl.getBoundingClientRect().top : window.innerHeight - 60) -
			logoSize * logo.scale;

		function handleInteraction() {
			// Random "Kick"
			const kickX = (Math.random() - 0.5) * 30;
			const kickY = -(15 + Math.random() * 10); // Kick upwards

			currVx += kickX;
			currVy += kickY;
			currRotVel += kickX * 2;

			if (stopped) {
				stopped = false;
				gsap.killTweensOf(el);
				gsap.set(el, { opacity: 0.8, scale: logo.scale });
				step();
			}
		}

		el.addEventListener('click', handleInteraction);

		function step() {
			if (!el || !el.isConnected) return;

			currVy += gravity;
			currVx *= friction;
			currVy *= friction;

			currX += currVx;
			currY += currVy;

			// Handle floor interaction (bounce and roll)
			if (currY >= floor) {
				currY = floor;

				// Bounce or roll
				if (Math.abs(currVy) > 1) {
					currVy = -currVy * bounce;
					// Randomize rotation slightly on bounce
					currRotVel += (Math.random() - 0.5) * 10;
				} else {
					currVy = 0;
					// Roll: rotation velocity follows horizontal velocity
					// Circumference = pi * d. Distance = velocity.
					// Angular velocity roughly proportional to horizontal velocity.
					currRotVel = currVx * 15;
					currVx *= groundFriction;
				}
			}

			currRot += currRotVel;

			// Bounce off left wall
			if (currX < 20) {
				currX = 20;
				currVx = -currVx * bounce;
				currRotVel = -currRotVel * 0.5;
			}

			// Bounce off right wall
			if (currX > window.innerWidth - 60) {
				currX = window.innerWidth - 60;
				currVx = -currVx * bounce;
				currRotVel = -currRotVel * 0.5;
			}

			gsap.set(el, {
				x: currX,
				y: currY,
				rotation: currRot,
				force3D: true,
				overwrite: 'auto'
			});

			// Only remove if it's stationary
			if (Math.abs(currVy) < 0.1 && Math.abs(currVx) < 0.1 && Math.abs(currRotVel) < 0.2) {
				if (!stopped) {
					stopped = true;
					gsap.to(el, {
						opacity: 0,
						scale: 0.2,
						duration: 2,
						delay: 3,
						ease: 'power2.in',
						onComplete: () => {
							if (stopped) {
								logos = logos.filter((l) => l.id !== logo.id);
							}
						}
					});
				}
				return;
			}

			requestAnimationFrame(step);
		}

		requestAnimationFrame(step);
	}
</script>

<div class="pointer-events-none fixed inset-0 z-[100]" bind:this={containerEl}>
	{#each logos as logo (logo.id)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img
			id={`sui-logo-${logo.id}`}
			src={logoUrl}
			alt="Sui Logo"
			class="pointer-events-auto absolute top-0 left-0 h-10 w-10 cursor-pointer opacity-80 select-none"
			style="transform: scale({logo.scale})"
			onclick={() => {
				// We attach the click handler manually in animatePhysics to access closure variables,
				// but we can also trigger it here if we exposed the state.
				// Since we are doing it in animatePhysics, we just need the pointer events.
				// Actually, redundant listener here is fine, but I will modify animatePhysics to attach the listener.
			}}
		/>
	{/each}
</div>
