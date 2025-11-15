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
	<section class="hero from-primary/10 via-base-100 to-secondary/10 min-h-[30vh] bg-gradient-to-br">
		<div class="hero-content pt-10 text-center">
			<div class="max-w-4xl">
				<h1 class="text-primary mb-6 text-5xl font-bold">
					<span class="from-primary to-secondary bg-gradient-to-r bg-clip-text text-transparent">
						{t('faq.heroTitle')}
					</span>
				</h1>
				<p class="text-base-content/80 mx-auto mb-8 max-w-2xl text-xl">
					{t('faq.heroDescription')}
				</p>
			</div>
		</div>
	</section>

	<!-- FAQ Content -->
	<section class="bg-base-100 py-20">
		<div class="container mx-auto px-4">
			<div class="mx-auto max-w-4xl">
				{#each faqData as category, categoryIndex}
					<div class="mb-12">
						<!-- Category Header -->
						<div class="mb-8">
							<h2 class="mb-4 text-3xl font-bold">{category.category}</h2>
							<div class="from-primary to-secondary h-1 w-20 bg-gradient-to-r"></div>
						</div>

						<!-- FAQ Items -->
						<div class="space-y-4">
							{#if Array.isArray(category.questions)}
								{#each category.questions as question, questionIndex}
									<div class="collapse-arrow bg-base-200 border-base-300 collapse border shadow">
										<input
											type="radio"
											name="my-accordion-2"
											class="peer"
											value={categoryIndex * 100 + questionIndex}
										/>
										<div class="collapse-title font-semibold">
											{question.question}
										</div>
										<div class="collapse-content text-sm">
											<div class="prose prose-base text-base-content/80 max-w-none">
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
	<section class="from-primary to-secondary bg-gradient-to-r py-20">
		<div class="container mx-auto px-4 text-center">
			<div class="mx-auto max-w-2xl">
				<h2 class="mb-6 text-4xl font-bold text-white">
					{t('faq.cta.title')}
				</h2>
				<p class="mb-8 text-xl text-white/90">
					{t('faq.cta.description')}
				</p>
				<div class="flex flex-col justify-center gap-4 sm:flex-row">
					<a href="/" class="btn btn-white btn-lg px-8">
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{t('faq.cta.getStarted')}
					</a>
					<a href="/about" class="btn btn-outline btn-white btn-lg px-8">
						<span class="icon-[lucide--info] h-6 w-6"></span>
						{t('faq.cta.learnMore')}
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}
