<script>
	import { getContext } from 'svelte';
	import { toast } from 'svelte-daisy-toaster';

	// Get user from props or context (props takes priority)
	let { user: userProp } = $props();
	let userFromContext = getContext('authedUser');
	let user = $derived(userProp || userFromContext);

	// Extract first letter from email or fallback to 'U' for User
	function getInitials(email) {
		if (!email) return 'U';
		return email.charAt(0).toUpperCase();
	}

	// Get user name or email for display
	function getDisplayName(user) {
		return user?.name || user?.email || 'User';
	}

	// Generate background color based on email
	function getAvatarColor(email) {
		if (!email) return 'bg-neutral';
		const colors = [
			'bg-primary',
			'bg-secondary',
			'bg-accent',
			'bg-info',
			'bg-success',
			'bg-warning'
		];
		const hash = email.split('').reduce((a, b) => {
			a = (a << 5) - a + b.charCodeAt(0);
			return a & a;
		}, 0);
		return colors[Math.abs(hash) % colors.length];
	}

	function handleLogout() {
		toast({
			type: 'success',
			message: 'Logged out successfully!',
			position: 'bottom-right'
		});
	}
</script>

<div class="dropdown dropdown-end">
	<!-- Avatar Button -->
	<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar avatar-placeholder">
		<div
			class="{getAvatarColor(
				user?.email
			)} text-neutral-content flex h-8 w-8 items-center justify-center rounded-full"
		>
			<span class="text-lg leading-none font-bold">{getInitials(user?.email)}</span>
		</div>
	</div>

	<!-- Dropdown Menu -->
	<ul
		tabindex="-1"
		class="dropdown-content menu bg-base-100 rounded-box border-base-300 z-[1] w-64 border p-2 shadow-lg"
	>
		<!-- User Info -->
		<li>
			<div class="menu-title flex flex-col">
				<span class="text-sm font-semibold">{getDisplayName(user)}</span>
				{#if user?.email}
					<span class="text-xs opacity-70">{user.email}</span>
				{/if}
			</div>
		</li>

		<li class="menu-disabled"><hr class="my-1" /></li>

		<!-- Profile Link (Optional) -->
		<li>
			<a href="/admin/profile" class="flex items-center gap-3">
				<span class="icon-[lucide--user] h-4 w-4"></span>
				Profile Settings
			</a>
		</li>

		<!-- Preferences (Optional) -->
		<!-- <li>
			<a href="/admin/preferences" class="flex items-center gap-3">
				<span class="icon-[lucide--settings] h-4 w-4"></span>
				Preferences
			</a>
		</li> -->

		<li class="menu-disabled"><hr class="my-1" /></li>

		<!-- Logout -->
		<li>
			<a
				href="/admin/logout"
				class="text-error hover:bg-error/10 flex items-center gap-3"
				onclick={handleLogout}
			>
				<span class="icon-[lucide--log-out] h-4 w-4"></span>
				Logout
			</a>
		</li>
	</ul>
</div>
