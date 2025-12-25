<script lang="ts">
	import { onMount } from 'svelte';
	import { useTranslation } from '$lib/hooks/useTranslation.js';

	interface FAQQuestion {
		question: string;
		answer: string;
	}

	interface FAQCategory {
		category: string;
		questions: FAQQuestion[] | string;
	}

	// Translation hook
	const t = useTranslation();

	// Initialization state
	let isInitialized = $state(false);

	onMount(() => {
		isInitialized = true;
	});

	// FAQ Data - reactive based on current language
	let faqData = $derived<FAQCategory[]>([
		{
			category: String(t('faq.categories.overview')),
			questions: (t('faq.questions.overview') as unknown) as FAQQuestion[]
		},
		{
			category: String(t('faq.categories.blockchain')),
			questions: (t('faq.questions.blockchain') as unknown) as FAQQuestion[]
		},
		{
			category: String(t('faq.categories.features')),
			questions: (t('faq.questions.features') as unknown) as FAQQuestion[]
		},
		{
			category: String(t('faq.categories.frequentlyAsked')),
			questions: (t('faq.questions.frequentlyAsked') as unknown) as FAQQuestion[]
		}
	]);
</script>

<svelte:head>
	<title>{t('faq.title')}</title>
	<meta name="description" content={t('faq.metaDescription')} />
	<meta property="og:title" content={t('faq.ogTitle')} />
	<meta property="og:description" content={t('faq.ogDescription')} />
</svelte:head>

<!-- Hero Section -->
{#if isInitialized}
	<section class="bg-base-200/50 relative py-20">
		<!-- Background Pattern -->
		<div class="bg-dot-pattern text-base-content/20 absolute inset-0"></div>

		<div class="hero-content relative z-0 text-center">
			<div class="max-w-4xl">
				<h1 class="text-base-content mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
					{t('faq.heroTitle')}
				</h1>
				<p class="text-base-content/70 mx-auto mb-8 max-w-2xl text-xl leading-relaxed">
					{t('faq.heroDescription')}
				</p>
			</div>
		</div>
	</section>

	<!-- FAQ Content -->
	<section class="bg-base-100 pb-12 pt-24">
		<div class="container mx-auto px-4">
			<div class="mx-auto max-w-3xl">
				{#each faqData as category, categoryIndex}
					<div class="mb-16">
						<!-- Category Header -->
						<div class="mb-8 flex items-center gap-4">
							<h2 class="text-2xl font-bold">{category.category}</h2>
							<div class="bg-base-300 h-px flex-1"></div>
						</div>

						<!-- FAQ Items -->
						<div class="flex flex-col gap-4">
							{#if Array.isArray(category.questions)}
								{#each category.questions as question, questionIndex}
									<div class="collapse collapse-plus bg-base-200 border border-base-300 rounded-xl">
										<input
											type="radio"
											name="my-accordion-{categoryIndex}"
											class="peer"
											value={questionIndex}
										/>
										<div class="collapse-title text-lg font-medium">
											{question.question}
										</div>
										<div class="collapse-content">
											<div class="prose prose-base text-base-content/70 max-w-none pt-2 pb-4">
												{@html question.answer}
											</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="relative overflow-hidden py-24">
		<div class="bg-primary/5 absolute inset-0 -z-10"></div>
		<div class="bg-dot-pattern text-primary/10 absolute inset-0 -z-10"></div>

		<div class="container mx-auto px-4 text-center">
			<div class="mx-auto max-w-2xl">
				<h2 class="text-base-content mb-6 text-4xl font-bold">
					{t('faq.cta.title')}
				</h2>
				<p class="text-base-content/70 mb-10 text-xl">
					{t('faq.cta.description')}
				</p>
				<div class="flex flex-col justify-center gap-4 sm:flex-row">
					<a href="/" class="btn btn-primary btn-lg px-10 shadow-lg hover:-translate-y-1 transition-transform">
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{t('faq.cta.getStarted')}
					</a>
					<a href="/about" class="btn btn-outline btn-lg px-10 hover:-translate-y-1 transition-transform">
						<span class="icon-[lucide--info] h-6 w-6"></span>
						{t('faq.cta.learnMore')}
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}
