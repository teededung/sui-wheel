<script>
	import Footer from '$lib/components/Footer.svelte';
	import WheelImage from '$lib/components/WheelImage.svelte';
	import { onMount } from 'svelte';
	import { getLanguageContext } from '$lib/context/language.js';

	// Language state
	let isInitialized = $state(false);
	const { language } = getLanguageContext();
	let currentLanguage = $derived(language.code);

	onMount(() => {
		isInitialized = true;
	});
</script>

<svelte:head>
	<title>{currentLanguage === 'vi' ? 'Giới thiệu — Sui Wheel' : 'About — Sui Wheel'}</title>
	<meta
		name="description"
		content={currentLanguage === 'vi'
			? 'Giới thiệu Sui Wheel — tạo và quản lý vòng quay giải thưởng on-chain trên Sui Testnet.'
			: 'About Sui Wheel — create and manage on-chain prize wheels on Sui Testnet.'}
	/>
	<meta
		property="og:title"
		content={currentLanguage === 'vi' ? 'Giới thiệu — Sui Wheel' : 'About — Sui Wheel'}
	/>
	<meta
		property="og:description"
		content={currentLanguage === 'vi'
			? 'Giới thiệu Sui Wheel — ứng dụng vòng quay công bằng với tính ngẫu nhiên on-chain và kết quả có thể kiểm chứng.'
			: 'About Sui Wheel — fair lucky wheels with on-chain randomness and verifiable results.'}
	/>
</svelte:head>

{#if isInitialized}
	<!-- Hero Section -->
	<section
		class="hero from-primary/10 via-base-100 to-secondary/10 min-h-[calc(100vh-4rem)] bg-gradient-to-br"
	>
		<div class="hero-content text-center">
			<div class="max-w-4xl">
				<!-- Logo -->
				<div class="mb-8">
					<img src="/sui-wheel-logo.png" alt="Sui Wheel Logo" class="mx-auto h-24 w-auto" />
				</div>

				<!-- Main Title -->
				<h1 class="text-primary mb-6 text-5xl font-bold">
					<span class="from-primary to-secondary bg-gradient-to-r bg-clip-text text-transparent">
						Sui Wheel
					</span>
				</h1>

				<!-- Subtitle -->
				<p class="text-base-content/80 mx-auto mb-8 max-w-2xl text-xl">
					{currentLanguage === 'vi'
						? 'Tạo các vòng quay giải thưởng công bằng, minh bạch và hấp dẫn trên blockchain Sui. Quay để trúng thưởng với tính ngẫu nhiên on-chain và kết quả có thể kiểm chứng.'
						: 'Create fair, transparent, and exciting prize wheels on Sui blockchain. Spin to win with on-chain randomness and verifiable results.'}
				</p>

				<!-- CTA Buttons -->
				<div class="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
					<a href="/" class="btn btn-primary btn-lg px-8">
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{currentLanguage === 'vi' ? 'Chơi ngay' : 'Play Now'}
					</a>
					<a href="#features" class="btn btn-outline btn-lg px-8">
						<span class="icon-[lucide--info] h-6 w-6"></span>
						{currentLanguage === 'vi' ? 'Tìm hiểu thêm' : 'Learn More'}
					</a>
				</div>

				<!-- Stats -->
				<div
					class="stats stats-vertical sm:stats-horizontal bg-base-100/80 shadow-lg backdrop-blur-sm"
				>
					<div class="stat">
						<div class="stat-figure text-primary">
							<span class="icon-[lucide--zap] h-8 w-8"></span>
						</div>
						<div class="stat-title">{currentLanguage === 'vi' ? 'On-chain' : 'On-Chain'}</div>
						<div class="stat-value text-primary">100%</div>
						<div class="stat-desc">
							{currentLanguage === 'vi'
								? 'Minh bạch & có thể kiểm chứng'
								: 'Transparent & Verifiable'}
						</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-secondary">
							<span class="icon-[lucide--users] h-8 w-8"></span>
						</div>
						<div class="stat-title">
							{currentLanguage === 'vi' ? 'Số người tham gia tối đa' : 'Max Entries'}
						</div>
						<div class="stat-value text-secondary">200</div>
						<div class="stat-desc">
							{currentLanguage === 'vi' ? 'Người tham gia mỗi vòng quay' : 'Participants per wheel'}
						</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-accent">
							<span class="icon-[lucide--network] h-8 w-8"></span>
						</div>
						<div class="stat-title">{currentLanguage === 'vi' ? 'Mạng' : 'Network'}</div>
						<div class="stat-value text-accent">Sui</div>
						<div class="stat-desc">
							{currentLanguage === 'vi' ? 'Blockchain cho trò chơi' : 'Blockchain Gaming'}
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section id="features" class="bg-base-200 py-20 pb-64">
		<div class="container mx-auto px-4">
			<div class="mb-16 text-center">
				<h2 class="mb-4 text-4xl font-bold">
					{currentLanguage === 'vi' ? 'Vì sao chọn Sui Wheel?' : 'Why Choose Sui Wheel?'}
				</h2>
				<p class="text-base-content/70 mx-auto max-w-2xl text-xl">
					{currentLanguage === 'vi'
						? 'Trải nghiệm tương lai của sự công bằng với tính ngẫu nhiên trên blockchain và kết quả minh bạch.'
						: 'Experience the future of fair gaming with blockchain-powered randomness and transparent results.'}
				</p>
			</div>

			<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
				<!-- Feature 1 -->
				<div class="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl">
					<div class="card-body text-center">
						<div
							class="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-primary h-8 w-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<h3 class="card-title mb-2 justify-center">
							{currentLanguage === 'vi' ? 'Ngẫu nhiên trên chuỗi' : 'On-Chain Randomness'}
						</h3>
						<p class="text-base-content/70">
							{currentLanguage === 'vi'
								? 'Mỗi lượt quay sử dụng tính ngẫu nhiên on-chain có thể kiểm chứng, đảm bảo kết quả công bằng và không thể bị thao túng.'
								: "Every spin uses verifiable on-chain randomness, ensuring fair and transparent results that can't be manipulated."}
						</p>
					</div>
				</div>

				<!-- Feature 2 -->
				<div class="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl">
					<div class="card-body text-center">
						<div
							class="bg-secondary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-secondary h-8 w-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
						</div>
						<h3 class="card-title mb-2 justify-center">
							{currentLanguage === 'vi' ? 'An toàn & không cần tin tưởng' : 'Secure & Trustless'}
						</h3>
						<p class="text-base-content/70">
							{currentLanguage === 'vi'
								? 'Không có bên trung gian kiểm soát kết quả. Smart contract xử lý mọi thứ tự động và minh bạch.'
								: 'No central authority controls the outcomes. Smart contracts handle everything automatically and transparently.'}
						</p>
					</div>
				</div>

				<!-- Feature 3 -->
				<div class="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl">
					<div class="card-body text-center">
						<div
							class="bg-accent/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-accent h-8 w-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
						</div>
						<h3 class="card-title mb-2 justify-center">
							{currentLanguage === 'vi' ? 'Nhanh & hiệu quả' : 'Fast & Efficient'}
						</h3>
						<p class="text-base-content/70">
							{currentLanguage === 'vi'
								? 'Xây dựng trên blockchain hiệu năng cao của Sui cho giao dịch tức thì và phí thấp.'
								: "Built on Sui's high-performance blockchain for instant transactions and low fees."}
						</p>
					</div>
				</div>

				<!-- Feature 4 -->
				<div class="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl">
					<div class="card-body text-center">
						<div
							class="bg-success/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-success h-8 w-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
								/>
							</svg>
						</div>
						<h3 class="card-title mb-2 justify-center">
							{currentLanguage === 'vi' ? 'Dễ sử dụng' : 'Easy to Use'}
						</h3>
						<p class="text-base-content/70">
							{currentLanguage === 'vi'
								? 'Giao diện đơn giản cho người tổ chức và người tham gia. Kết nối ví, cấu hình và quay!'
								: 'Simple interface for organizers and participants. Connect wallet, configure, and spin!'}
						</p>
					</div>
				</div>

				<!-- Feature 5 -->
				<div class="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl">
					<div class="card-body text-center">
						<div
							class="bg-info/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-info h-8 w-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
						</div>
						<h3 class="card-title mb-2 justify-center">
							{currentLanguage === 'vi' ? 'Theo dõi thời gian thực' : 'Real-time Tracking'}
						</h3>
						<p class="text-base-content/70">
							{currentLanguage === 'vi'
								? 'Theo dõi lượt quay, người thắng cuộc và nhận thưởng theo thời gian thực với thống kê chi tiết.'
								: 'Monitor spins, winners, and claims in real-time with detailed analytics and history.'}
						</p>
					</div>
				</div>

				<!-- Feature 6 -->
				<div class="card bg-base-100 shadow-xl transition-shadow hover:shadow-2xl">
					<div class="card-body text-center">
						<div
							class="bg-warning/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-warning h-8 w-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
								/>
							</svg>
						</div>
						<h3 class="card-title mb-2 justify-center">
							{currentLanguage === 'vi' ? 'Giải thưởng linh hoạt' : 'Flexible Prizes'}
						</h3>
						<p class="text-base-content/70">
							{currentLanguage === 'vi'
								? 'Hỗ trợ token SUI và các tiền mã hóa khác. Linh hoạt về số lượng và cách phân phối.'
								: 'Support for SUI tokens and other cryptocurrencies. Customizable prize amounts and distribution.'}
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Floating Wheel Image between sections -->
	<div class="relative">
		<div class="absolute top-1/2 left-1/2 z-10 w-100 -translate-x-1/2 -translate-y-1/2">
			<WheelImage
				fontSize={12}
				entries={currentLanguage === 'vi'
					? [
							'Kiểm chứng onchain!',
							'Giữ sự công bằng',
							'Xây dựng trên Sui',
							'🎁 Giải thưởng thật',
							'Nhanh & hiệu quả',
							'Giải thưởng linh hoạt'
						]
					: [
							"Don't trust, verify it!",
							'Keep it fair',
							'Built on Sui',
							'🎁 Real prizes',
							'Fast & efficient',
							'Flexible prizes'
						]}
				rotationSpeed={25}
				logoSize={12}
			/>
		</div>
	</div>

	<!-- More Features Section -->
	<section class="bg-base-100 py-20 pt-64">
		<div class="container mx-auto px-4">
			<div class="mb-16 text-center">
				<h2 class="mb-4 text-4xl font-bold">
					{currentLanguage === 'vi' ? 'Tính năng khác' : 'More Features'}
				</h2>
				<p class="text-base-content/70 mx-auto max-w-2xl text-xl">
					{currentLanguage === 'vi'
						? 'Công cụ mạnh mẽ cho người tổ chức và người tham gia'
						: 'Powerful tools for organizers and participants'}
				</p>
			</div>

			<div class="mx-auto max-w-6xl">
				<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
					<!-- Feature 1: Off-chain & On-chain -->
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body text-center">
							<div
								class="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
							>
								<span class="icon-[lucide--gamepad-2] text-primary h-8 w-8"></span>
							</div>
							<h3 class="card-title mb-2 justify-center">
								{currentLanguage === 'vi' ? 'Chế độ chơi kép' : 'Dual Mode Gaming'}
							</h3>
							<p class="text-base-content/70">
								{currentLanguage === 'vi'
									? 'Chơi off-chain cho demo nhanh và on-chain cho giải thưởng thật với tính minh bạch đầy đủ.'
									: 'Play both off-chain for quick demos and on-chain for real prizes with full transparency.'}
							</p>
						</div>
					</div>

					<!-- Feature 2: zkLogin Google -->
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body text-center">
							<div
								class="bg-secondary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
							>
								<span class="icon-[lucide--user] text-secondary h-8 w-8"></span>
							</div>
							<h3 class="card-title mb-2 justify-center">
								{currentLanguage === 'vi' ? 'Đăng nhập zkLogin Google' : 'zkLogin Google'}
							</h3>
							<p class="text-base-content/70">
								{currentLanguage === 'vi'
									? 'Đăng nhập bằng tài khoản Google với công nghệ zkLogin cho trải nghiệm liền mạch.'
									: 'Sign in with Google account using zkLogin technology for seamless onboarding.'}
							</p>
						</div>
					</div>

					<!-- Feature 3: Online Import -->
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body text-center">
							<div
								class="bg-accent/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
							>
								<span class="icon-[lucide--download] text-accent h-8 w-8"></span>
							</div>
							<h3 class="card-title mb-2 justify-center">
								{currentLanguage === 'vi' ? 'Nhập trực tuyến' : 'Online Import'}
							</h3>
							<p class="text-base-content/70">
								{currentLanguage === 'vi'
									? 'Nhập danh sách người tham gia trực tuyến - phù hợp cho workshop và sự kiện offline.'
									: 'Import participant lists online - perfect for workshops and offline events.'}
							</p>
						</div>
					</div>

					<!-- Feature 4: X Post Import -->
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body text-center">
							<div
								class="bg-info/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
							>
								<span class="icon-[lucide--link] text-info h-8 w-8"></span>
							</div>
							<h3 class="card-title mb-2 justify-center">
								{currentLanguage === 'vi' ? 'Nhập từ bài đăng X' : 'X Post Import'}
							</h3>
							<p class="text-base-content/70">
								{currentLanguage === 'vi'
									? 'Dán link bài đăng X và tự động trích xuất địa chỉ Sui từ bình luận.'
									: 'Paste X post link and automatically extract Sui addresses from comments.'}
							</p>
						</div>
					</div>

					<!-- Feature 5: On-chain Shuffle -->
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body text-center">
							<div
								class="bg-success/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
							>
								<span class="icon-[lucide--shuffle] text-success h-8 w-8"></span>
							</div>
							<h3 class="card-title mb-2 justify-center">
								{currentLanguage === 'vi' ? 'Xáo trộn có thể kiểm chứng' : 'Verifiable Shuffle'}
							</h3>
							<p class="text-base-content/70">
								{currentLanguage === 'vi'
									? 'Xáo trộn on-chain thực sự với bằng chứng mật mã có thể tự xác minh.'
									: 'True on-chain shuffle with cryptographic proof that can be independently verified.'}
							</p>
						</div>
					</div>

					<!-- Feature 6: Deadline Claim -->
					<div class="card bg-base-200 shadow-xl">
						<div class="card-body text-center">
							<div
								class="bg-warning/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
							>
								<span class="icon-[lucide--clock] text-warning h-8 w-8"></span>
							</div>
							<h3 class="card-title mb-2 justify-center">
								{currentLanguage === 'vi' ? 'Hạn nhận thưởng' : 'Deadline Claims'}
							</h3>
							<p class="text-base-content/70">
								{currentLanguage === 'vi'
									? 'Đặt thời hạn nhận thưởng cùng cơ chế tự động hoàn tiền sau khi hết hạn.'
									: 'Set claim deadlines for prizes with automatic fund recovery after expiration.'}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="from-primary to-secondary bg-gradient-to-r py-20">
		<div class="container mx-auto px-4 text-center">
			<div class="mx-auto max-w-2xl">
				<h2 class="mb-6 text-4xl font-bold text-white">
					{currentLanguage === 'vi' ? 'Sẵn sàng quay?' : 'Ready to Spin?'}
				</h2>
				<p class="mb-8 text-xl text-white/90">
					{currentLanguage === 'vi'
						? 'Tham gia tương lai của sự công bằng. Tạo vòng quay đầu tiên của bạn và trải nghiệm tính ngẫu nhiên có thể kiểm chứng.'
						: 'Join the future of fair gaming. Create your first prize wheel and experience transparent, verifiable randomness.'}
				</p>
				<div class="flex flex-col justify-center gap-4 sm:flex-row">
					<a href="/" class="btn btn-white btn-lg px-8">
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{currentLanguage === 'vi' ? 'Chơi ngay' : 'Play Now'}
					</a>
					<a href="/faq" class="btn btn-outline btn-white btn-lg px-8">
						<span class="icon-[lucide--help-circle] h-6 w-6"></span>
						{currentLanguage === 'vi' ? 'FAQ' : 'FAQ'}
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}
