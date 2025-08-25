<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getContext } from 'svelte';

	const navItems = getContext('navItems');
	let path = $derived($page.url.pathname);

	const openSubMenus = $state({});

	function toggleSubMenu(slug) {
		openSubMenus[slug] = !openSubMenus[slug];
	}
</script>

<div class="drawer-side top-16 z-20">
	<label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
	<ul
		class="menu bg-base-200 text-base-content min-h-full w-64 p-0 shadow-sm [&_li>*]:rounded-none"
	>
		<li class="mb-2 text-xl font-semibold">
			<a href="/"
				><img
					class="mask mask-squircle w-8"
					src="/first-mover-logo.jpg"
					alt="Homepage"
				/>Homepage</a
			>
		</li>
		{#each navItems as section}
			{#if !section.hide}
				<li>
					<a
						class:menu-active={path === `${section.slug}` ||
							(section.subNav && section.subNav.some(sub => path === sub.slug))}
						href={section.subNav ? null : section.slug}
						onclick={e => {
							e.preventDefault();
							if (section.subNav) {
								toggleSubMenu(section.slug);
							} else {
								goto(section.slug);
							}
						}}
					>
						<span class={`${section.icon} mr-2 h-5 w-5`}></span>
						<span>{section.title}</span>
						{#if section.subNav}
							<span
								class={`${openSubMenus[section.slug] ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-right]'} ml-auto h-5 w-5`}
							></span>
						{/if}
					</a>

					{#if section?.subNav}
						<ul class:hidden={!openSubMenus[section.slug]}>
							{#each section.subNav as navItem}
								<li>
									<a href={navItem.slug} class:menu-active={path === navItem.slug}
										>{navItem.title}</a
									>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>
</div>
