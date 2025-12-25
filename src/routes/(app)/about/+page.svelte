<script lang="ts">
	import { onMount } from 'svelte';
	import { useTranslation } from '$lib/hooks/useTranslation.js';
	import WheelImage from '$lib/components/WheelImage.svelte';
	import logo from '$lib/assets/sui-wheel-logo.png';

	// Translation hook
	const t = useTranslation();

	// Initialization state
	let isInitialized = $state(false);

	onMount(() => {
		isInitialized = true;
	});
</script>

<svelte:head>
	<title>{t('about.title')}</title>
	<meta name="description" content={t('about.metaDescription')} />
	<meta property="og:title" content={t('about.ogTitle')} />
	<meta property="og:description" content={t('about.ogDescription')} />
</svelte:head>

{#if isInitialized}
	<!-- Hero Section -->
	<section class="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-base-200/50">
		<!-- Background Pattern -->
		<div class="bg-dot-pattern absolute inset-0 text-base-content/20"></div>

		<div class="relative hero-content z-0 mx-auto max-w-6xl flex-col gap-12 py-20 lg:flex-row">
			<!-- Text Content -->
			<div class="flex-1 text-center lg:text-left">
				<!-- Logo & Badge -->
				<div class="mb-6 flex items-center justify-center gap-4 lg:justify-start">
					<img src={logo} alt="Sui Wheel Logo" class="h-16 w-auto" />
					<div class="badge badge-outline badge-lg badge-primary">v1.3.5</div>
				</div>

				<!-- Main Title -->
				<h1 class="mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
					<span class="block text-base-content">{t('about.heroTitle')}</span>
				</h1>

				<!-- Subtitle -->
				<p class="mb-8 text-xl leading-relaxed text-base-content/70">
					{t('about.heroDescription')}
				</p>

				<!-- CTA Buttons -->
				<div class="flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
					<a href="/" class="btn px-8 btn-lg btn-primary">
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{t('about.cta.playNow')}
					</a>
					<a href="#features" class="btn px-8 btn-outline btn-lg btn-neutral">
						<span class="icon-[lucide--info] h-6 w-6"></span>
						{t('faq.cta.learnMore')}
					</a>
				</div>

				<!-- Stats Strip -->
				<div class="mt-12 grid grid-cols-3 gap-4 border-t border-base-content/10 pt-8">
					<div class="text-center lg:text-left">
						<div class="text-3xl font-bold text-primary">100%</div>
						<div class="text-sm font-medium text-base-content/60">{t('about.stats.onChain')}</div>
					</div>
					<div class="text-center lg:text-left">
						<div class="text-3xl font-bold text-secondary">200</div>
						<div class="text-sm font-medium text-base-content/60">
							{t('about.stats.maxEntries')}
						</div>
					</div>
					<div class="text-center lg:text-left">
						<div class="text-3xl font-bold text-accent">Sui</div>
						<div class="text-sm font-medium text-base-content/60">{t('about.stats.network')}</div>
					</div>
				</div>
			</div>

			<!-- Visual Element -->
			<div class="relative flex-1 items-center justify-center">
				<div
					class="absolute top-1/2 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl"
				></div>
				<div class="relative w-80 md:w-96">
					<WheelImage
						fontSize={12}
						entries={t('about.wheelEntries')}
						rotationSpeed={25}
						logoSize={12}
					/>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section (Bento Grid) -->
	<section id="features" class="bg-base-100 py-24">
		<div class="container mx-auto px-4">
			<div class="mb-16 text-center">
				<h2 class="mb-4 text-4xl font-bold tracking-tight">
					{t('about.whyChoose.title')}
				</h2>
				<p class="mx-auto max-w-2xl text-lg text-base-content/60">
					{t('about.whyChoose.description')}
				</p>
			</div>

			<div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
				<!-- Large Feature 1: On-Chain Randomness -->
				<div class="card bg-base-200 transition-all duration-300 hover:shadow-xl md:col-span-2">
					<div class="card-body flex-row items-center gap-6 p-8">
						<div class="rounded-2xl bg-primary/10 p-4">
							<span class="icon-[lucide--shield-check] h-10 w-10 text-primary"></span>
						</div>
						<div>
							<h3 class="mb-2 card-title text-2xl">
								{t('about.features.onChainRandomness.title')}
							</h3>
							<p class="text-lg text-base-content/70">
								{t('about.features.onChainRandomness.description')}
							</p>
						</div>
					</div>
				</div>

				<!-- Feature 2: Secure & Trustless -->
				<div
					class="card border border-base-200 bg-base-100 transition-colors hover:border-primary/50"
				>
					<div class="card-body p-8">
						<div class="mb-4 w-fit rounded-xl bg-secondary/10 p-3">
							<span class="icon-[lucide--lock] h-8 w-8 text-secondary"></span>
						</div>
						<h3 class="card-title text-xl">{t('about.features.secureTrustless.title')}</h3>
						<p class="mt-2 text-sm text-base-content/60">
							{t('about.features.secureTrustless.description')}
						</p>
					</div>
				</div>

				<!-- Feature 3: Fast & Efficient -->
				<div
					class="card border border-base-200 bg-base-100 transition-colors hover:border-accent/50"
				>
					<div class="card-body p-8">
						<div class="mb-4 w-fit rounded-xl bg-accent/10 p-3">
							<span class="icon-[lucide--zap] h-8 w-8 text-accent"></span>
						</div>
						<h3 class="card-title text-xl">{t('about.features.fastEfficient.title')}</h3>
						<p class="mt-2 text-sm text-base-content/60">
							{t('about.features.fastEfficient.description')}
						</p>
					</div>
				</div>

				<!-- Large Feature 4: Easy to Use (Reversed) -->
				<div class="card bg-base-200 transition-all duration-300 hover:shadow-xl md:col-span-2">
					<div class="card-body flex-row items-center gap-6 p-8">
						<div class="rounded-2xl bg-success/10 p-4">
							<span class="icon-[lucide--smile] h-10 w-10 text-success"></span>
						</div>
						<div>
							<h3 class="mb-2 card-title text-2xl">
								{t('about.features.easyToUse.title')}
							</h3>
							<p class="text-lg text-base-content/70">
								{t('about.features.easyToUse.description')}
							</p>
						</div>
					</div>
				</div>

				<!-- Feature 5: Real-Time Tracking -->
				<div class="card border border-base-200 bg-base-100 transition-colors hover:border-info/50">
					<div class="card-body p-8">
						<div class="mb-4 w-fit rounded-xl bg-info/10 p-3">
							<span class="icon-[lucide--activity] h-8 w-8 text-info"></span>
						</div>
						<h3 class="card-title text-xl">{t('about.features.realTimeTracking.title')}</h3>
						<p class="mt-2 text-sm text-base-content/60">
							{t('about.features.realTimeTracking.description')}
						</p>
					</div>
				</div>

				<!-- Feature 6: Flexible Prizes -->
				<div
					class="card border border-base-200 bg-base-100 transition-colors hover:border-warning/50"
				>
					<div class="card-body p-8">
						<div class="mb-4 w-fit rounded-xl bg-warning/10 p-3">
							<span class="icon-[lucide--gift] h-8 w-8 text-warning"></span>
						</div>
						<h3 class="card-title text-xl">{t('about.features.flexiblePrizes.title')}</h3>
						<p class="mt-2 text-sm text-base-content/60">
							{t('about.features.flexiblePrizes.description')}
						</p>
					</div>
				</div>

				<!-- Extra Feature 1: Dual Mode -->
				<div
					class="card border border-base-200 bg-base-100 transition-colors hover:border-primary/50"
				>
					<div class="card-body p-8">
						<div class="mb-4 w-fit rounded-xl bg-primary/10 p-3">
							<span class="icon-[lucide--gamepad-2] h-8 w-8 text-primary"></span>
						</div>
						<h3 class="card-title text-xl">{t('about.moreFeatures.dualModeGaming.title')}</h3>
						<p class="mt-2 text-sm text-base-content/60">
							{t('about.moreFeatures.dualModeGaming.description')}
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Additional Features Grid -->
	<section class="bg-base-200 py-24">
		<div class="container mx-auto px-4">
			<div class="mb-16 text-center">
				<h2 class="mb-4 text-3xl font-bold">{t('about.moreFeatures.title')}</h2>
				<p class="mx-auto max-w-2xl text-base-content/60">{t('about.moreFeatures.description')}</p>
			</div>

			<div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
				<!-- zkLogin -->
				<div class="flex flex-col items-center text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-base-100 shadow-sm"
					>
						<span class="icon-[lucide--user] h-8 w-8 text-secondary"></span>
					</div>
					<h3 class="mb-2 text-lg font-bold">{t('about.moreFeatures.zkLoginGoogle.title')}</h3>
					<p class="text-sm text-base-content/60">
						{t('about.moreFeatures.zkLoginGoogle.description')}
					</p>
				</div>

				<!-- Online Import -->
				<div class="flex flex-col items-center text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-base-100 shadow-sm"
					>
						<span class="icon-[lucide--download] h-8 w-8 text-accent"></span>
					</div>
					<h3 class="mb-2 text-lg font-bold">{t('about.moreFeatures.onlineImport.title')}</h3>
					<p class="text-sm text-base-content/60">
						{t('about.moreFeatures.onlineImport.description')}
					</p>
				</div>

				<!-- X Post Import -->
				<div class="flex flex-col items-center text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-base-100 shadow-sm"
					>
						<span class="icon-[lucide--share-2] h-8 w-8 text-info"></span>
					</div>
					<h3 class="mb-2 text-lg font-bold">{t('about.moreFeatures.xPostImport.title')}</h3>
					<p class="text-sm text-base-content/60">
						{t('about.moreFeatures.xPostImport.description')}
					</p>
				</div>

				<!-- Verifiable Shuffle -->
				<div class="flex flex-col items-center text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-base-100 shadow-sm"
					>
						<span class="icon-[lucide--shuffle] h-8 w-8 text-success"></span>
					</div>
					<h3 class="mb-2 text-lg font-bold">{t('about.moreFeatures.verifiableShuffle.title')}</h3>
					<p class="text-sm text-base-content/60">
						{t('about.moreFeatures.verifiableShuffle.description')}
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="relative overflow-hidden py-24">
		<div class="absolute inset-0 -z-10 bg-primary/5"></div>
		<div class="bg-dot-pattern absolute inset-0 -z-10 text-primary/10"></div>

		<div class="container mx-auto px-4 text-center">
			<div class="mx-auto max-w-2xl">
				<h2 class="mb-6 text-4xl font-bold text-base-content">
					{t('about.cta.title')}
				</h2>
				<p class="mb-10 text-xl text-base-content/70">
					{t('about.cta.description')}
				</p>
				<div class="flex flex-col justify-center gap-4 sm:flex-row">
					<a
						href="/"
						class="btn px-10 shadow-lg transition-transform btn-lg btn-primary hover:-translate-y-1"
					>
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{t('about.cta.playNow')}
					</a>
					<a
						href="/faq"
						class="btn px-10 transition-transform btn-outline btn-lg hover:-translate-y-1"
					>
						<span class="icon-[lucide--help-circle] h-6 w-6"></span>
						{t('about.cta.faq')}
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}
