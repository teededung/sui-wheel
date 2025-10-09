<script>
	import { onMount } from 'svelte';
	import { getLanguageContext } from '$lib/context/language.js';
	let isInitialized = $state(false);

	const { language } = getLanguageContext();
	let currentLanguage = $derived(language.code);

	onMount(() => {
		isInitialized = true;
	});

	// FAQ Data
	const faqDataVi = [
		{
			category: 'Tổng quan',
			questions: [
				{
					question: 'Sui Wheel là gì và hoạt động như thế nào?',
					answer:
						'Sui Wheel là ứng dụng vòng quay may mắn trên blockchain Sui sử dụng smart contracts để đảm bảo tính công bằng 100%. Người tổ chức tạo vòng quay, thêm người tham gia (tối đa 200 người), đặt giải thưởng và tài trợ pool phần thưởng. Kết quả được xác định bởi tính ngẫu nhiên on-chain, minh bạch và không thể thao túng.'
				},
				{
					question: 'Tại sao nên chọn Sui Wheel?',
					answer:
						'Sui Wheel mang lại sự công bằng 100% với tính ngẫu nhiên trên chuỗi, bảo mật không cần tin tưởng, tốc độ nhanh chóng với phí thấp, giao diện dễ sử dụng và theo dõi thời gian thực. Ngoài ra còn hỗ trợ nhiều tính năng nâng cao như zkLogin, nhập danh sách và quản lý giải thưởng linh hoạt.'
				}
			]
		},
		{
			category: 'Blockchain & SUI',
			questions: [
				{
					question: 'Tôi cần biết gì về blockchain SUI?',
					answer:
						'Sui là một blockchain layer 1 high-performance được thiết kế cho các ứng dụng gaming và DeFi. Sui Wheel được xây dựng trên Sui để đảm bảo tốc độ nhanh chóng và phí giao dịch thấp. Bạn cần có ví Sui (khuyên dùng Slush Wallet) để tham gia các vòng quay on-chain.'
				},
				{
					question: 'Có cần trả phí gas không?',
					answer:
						'Có, các giao dịch on-chain sẽ tiêu tốn một lượng nhỏ SUI để trả phí gas. Tuy nhiên, Sui có phí rất thấp so với các blockchain khác. Bạn chỉ cần trả phí khi tham gia các vòng quay on-chain thực sự, không phải cho các demo off-chain.'
				},
				{
					question: 'Sui Wheel có an toàn không?',
					answer:
						'Hoàn toàn an toàn! Sui Wheel sử dụng smart contracts được audit và không lưu trữ tài sản của người dùng. Tất cả giao dịch đều minh bạch và có thể kiểm chứng trên blockchain. Người dùng luôn kiểm soát ví và tài sản của mình.'
				}
			]
		},
		{
			category: 'Tính năng & Cách sử dụng',
			questions: [
				{
					question: 'Làm thế nào để tạo vòng quay?',
					answer:
						'<ol><li>Kết nối ví Sui của bạn</li><li>Thêm danh sách người tham gia (tối đa 200 người)</li><li>Đặt giải thưởng và thời gian</li><li>Tài trợ pool với đủ token</li><li>Xuất bản vòng quay để mọi người có thể tham gia</li></ol>'
				},
				{
					question: 'Có thể thêm người tham gia như thế nào?',
					answer:
						'<ul><li>Nhập địa chỉ ví Sui thủ công</li><li>Nhập bằng tính năng QR online</li><li>Sử dụng tính năng import từ bài đăng X (Twitter) để tự động trích xuất địa chỉ từ comments</li></ul>'
				},
				{
					question: 'Các loại giải thưởng được hỗ trợ?',
					answer:
						'Sui Wheel hỗ trợ SUI tokens và các loại tiền điện tử khác (coming next). Bạn có thể tùy chỉnh số lượng và phân phối giải thưởng một cách linh hoạt theo nhu cầu của mình.'
				},
				{
					question: 'Off-chain và On-chain khác nhau như thế nào?',
					answer:
						'Chế độ Off-chain dành cho demo nhanh và thử nghiệm không tốn phí. Chế độ On-chain dành cho các vòng quay thực sự với giải thưởng thật, mọi thứ đều minh bạch và được ghi lại vĩnh viễn trên blockchain.'
				},
				{
					question: 'Nút Shuffle có tác dụng không?',
					answer:
						'Có! Nút Shuffle thực sự có tác dụng và có thể kiểm chứng on-chain. Khi nhấn Shuffle, hệ thống sẽ tạo ra một thứ tự ngẫu nhiên mới cho danh sách người tham gia, và quá trình này được ghi lại trên blockchain để đảm bảo tính minh bạch và công bằng.'
				}
			]
		},
		{
			category: 'Các câu hỏi thường gặp',
			questions: [
				{
					question: 'Làm thế nào để nhận giải thưởng?',
					answer:
						'Nếu bạn thắng, sẽ có link claim giải được tạo ra mỗi khi vòng quay kết thúc. Truy cập link này để claim giải.'
				},
				{
					question: 'Có giới hạn thời gian nhận giải không?',
					answer:
						'Có, người tổ chức có thể đặt thời hạn nhận giải thưởng. Sau thời hạn này, giải thưởng chưa nhận sẽ được trả lại vào pool để phân phối lại hoặc trả về ví của người tổ chức.'
				},
				{
					question: 'Tôi có thể theo dõi kết quả ở đâu?',
					answer:
						'Tất cả kết quả được ghi lại trên blockchain và có thể xem trực tiếp trên Sui Explorer. Ngoài ra, Sui Wheel cung cấp giao diện theo dõi thời gian thực để bạn có thể theo dõi các vòng quay và người thắng cuộc.'
				},
				{
					question: 'Có hỗ trợ đăng nhập bằng Google không?',
					answer:
						'Có! Sui Wheel hỗ trợ zkLogin với Google. Đây là cách dễ dàng nhất để bắt đầu với Sui Wheel. Hãy nhớ rằng bạn cần có Sui coin trong ví để tạo vòng quay.'
				},
				{
					question: 'Tác giả vòng quay có thể hủy vòng quay không?',
					answer:
						'Có, tác giả vòng quay có thể hủy vòng quay với điều kiện bạn chưa thực hiện vòng quay. Pool thưởng sẽ tự động trả về ví của bạn khi hủy.'
				},
				{
					question: 'Điều gì sẽ xảy ra nếu tôi không nhận thưởng trước thời hạn?',
					answer: 'Bạn không thể claim giải thưởng sau khi hết hạn nhận thưởng.'
				},
				{
					question: 'Tác giả có thể thu hồi pool thưởng sau khi vòng quay kết thúc không?',
					answer: 'Chỉ khi thời gian nhận thưởng đã kết thúc; nếu chưa đến hạn, không thể thu hồi.'
				}
			]
		}
	];

	const faqDataEn = [
		{
			category: 'Overview',
			questions: [
				{
					question: 'What is Sui Wheel and how does it work?',
					answer:
						'Sui Wheel is a lucky wheel application on the Sui blockchain using smart contracts to ensure 100% fairness. Organizers create wheels, add participants (up to 200 people), set prizes and fund the reward pool. Results are determined by on-chain randomness, transparent and tamper-proof.'
				},
				{
					question: 'Why choose Sui Wheel?',
					answer:
						'Sui Wheel delivers 100% fairness with on-chain randomness, trustless security, fast speed with low fees, user-friendly interface and real-time tracking. Additionally, it supports advanced features like zkLogin, list import and flexible prize management.'
				}
			]
		},
		{
			category: 'Blockchain & SUI',
			questions: [
				{
					question: 'What do I need to know about the SUI blockchain?',
					answer:
						'Sui is a high-performance layer 1 blockchain designed for gaming and DeFi applications. Sui Wheel is built on Sui to ensure fast speed and low transaction fees. You need a Sui wallet (recommended Slush Wallet) to participate in on-chain wheels.'
				},
				{
					question: 'Do I need to pay gas fees?',
					answer:
						'Yes, on-chain transactions will consume a small amount of SUI for gas fees. However, Sui has very low fees compared to other blockchains. You only pay fees when participating in actual on-chain wheels, not for off-chain demos.'
				},
				{
					question: 'Is Sui Wheel safe?',
					answer:
						'Absolutely safe! Sui Wheel uses audited smart contracts and does not store user assets. All transactions are transparent and verifiable on the blockchain. Users always control their wallets and assets.'
				}
			]
		},
		{
			category: 'Features & Usage',
			questions: [
				{
					question: 'How to create a wheel?',
					answer:
						'<ol><li>Connect your Sui wallet</li><li>Add participant list (up to 200 people)</li><li>Set prizes and time</li><li>Fund the pool with sufficient tokens</li><li>Publish the wheel for everyone to participate</li></ol>'
				},
				{
					question: 'How can I add participants?',
					answer:
						'<ul><li>Manually enter Sui wallet addresses</li><li>Import using online QR feature</li><li>Use X (Twitter) post import feature to automatically extract addresses from comments</li></ul>'
				},
				{
					question: 'What types of prizes are supported?',
					answer:
						'Sui Wheel supports SUI tokens and other cryptocurrencies (coming next). You can customize the quantity and distribution of prizes flexibly according to your needs.'
				},
				{
					question: 'What is the difference between Off-chain and On-chain?',
					answer:
						'Off-chain mode is for quick demos and testing without fees. On-chain mode is for real wheels with actual prizes, everything is transparent and permanently recorded on the blockchain.'
				},
				{
					question: 'Does the Shuffle button work?',
					answer:
						'Yes! The Shuffle button actually works and can be verified on-chain. When you press Shuffle, the system generates a new random order for the participant list, and this process is recorded on the blockchain to ensure transparency and fairness.'
				}
			]
		},
		{
			category: 'Frequently Asked Questions',
			questions: [
				{
					question: 'How to receive prizes?',
					answer:
						'If you win, a claim link will be generated each time the wheel ends. Access this link to claim your prize.'
				},
				{
					question: 'Is there a time limit for claiming prizes?',
					answer:
						"Yes, organizers can set a deadline for claiming prizes. After this deadline, unclaimed prizes will be returned to the pool for redistribution or refunded to the organizer's wallet."
				},
				{
					question: 'Where can I track results?',
					answer:
						'All results are recorded on the blockchain and can be viewed directly on Sui Explorer. Additionally, Sui Wheel provides a real-time tracking interface so you can monitor wheels and winners.'
				},
				{
					question: 'Does it support Google login?',
					answer:
						'Yes! Sui Wheel supports zkLogin with Google. This is the easiest way to get started with Sui Wheel. Remember that you need Sui coins in your wallet to create wheels.'
				},
				{
					question: 'Can the wheel creator cancel the wheel?',
					answer:
						"Yes, the wheel creator can cancel the wheel provided you haven't executed the wheel yet. The reward pool will automatically refund to your wallet when cancelled."
				},
				{
					question: "What happens if I don't claim prizes before the deadline?",
					answer: 'You cannot claim prizes after the claiming deadline has passed.'
				},
				{
					question: 'Can the creator recover the reward pool after the wheel ends?',
					answer: 'Only when the prize claiming time has ended; if not yet due, cannot recover.'
				}
			]
		}
	];

	// Select FAQ data based on current language - reactive
	let faqData = $derived(currentLanguage === 'vi' ? faqDataVi : faqDataEn);
</script>

<svelte:head>
	<title>FAQ — Sui Wheel</title>
	<meta
		name="description"
		content={currentLanguage === 'vi'
			? 'Câu hỏi thường gặp về Sui Wheel - ứng dụng vòng quay may mắn trên blockchain Sui với tính ngẫu nhiên công bằng và minh bạch.'
			: 'Frequently asked questions about Sui Wheel - lucky wheel application on Sui blockchain with fair and transparent randomness.'}
	/>
	<meta property="og:title" content="FAQ — Sui Wheel" />
	<meta
		property="og:description"
		content={currentLanguage === 'vi'
			? 'Câu hỏi thường gặp về Sui Wheel - ứng dụng vòng quay may mắn trên blockchain Sui.'
			: 'Frequently asked questions about Sui Wheel - lucky wheel application on Sui blockchain.'}
	/>
</svelte:head>

<!-- Hero Section -->
{#if isInitialized}
	<section class="hero from-primary/10 via-base-100 to-secondary/10 min-h-[30vh] bg-gradient-to-br">
		<div class="hero-content pt-10 text-center">
			<div class="max-w-4xl">
				<h1 class="text-primary mb-6 text-5xl font-bold">
					<span class="from-primary to-secondary bg-gradient-to-r bg-clip-text text-transparent">
						{currentLanguage === 'vi' ? 'Câu hỏi thường gặp' : 'Frequently Asked Questions'}
					</span>
				</h1>
				<p class="text-base-content/80 mx-auto mb-8 max-w-2xl text-xl">
					{currentLanguage === 'vi'
						? 'Tìm câu trả lời cho những câu hỏi phổ biến nhất về Sui Wheel'
						: 'Find answers to the most common questions about Sui Wheel'}
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
					{currentLanguage === 'vi' ? 'Còn câu hỏi nào khác?' : 'Have more questions?'}
				</h2>
				<p class="mb-8 text-xl text-white/90">
					{currentLanguage === 'vi'
						? 'Nếu bạn không tìm thấy câu trả lời cho câu hỏi của mình, hãy liên hệ với chúng tôi để được hỗ trợ.'
						: "If you can't find the answer to your question, please contact us for support."}
				</p>
				<div class="flex flex-col justify-center gap-4 sm:flex-row">
					<a href="/" class="btn btn-white btn-lg px-8">
						<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
						{currentLanguage === 'vi' ? 'Bắt đầu ngay' : 'Get Started'}
					</a>
					<a href="/about" class="btn btn-outline btn-white btn-lg px-8">
						<span class="icon-[lucide--info] h-6 w-6"></span>
						{currentLanguage === 'vi' ? 'Tìm hiểu thêm' : 'Learn More'}
					</a>
				</div>
			</div>
		</div>
	</section>
{/if}
