<script>
	import { onMount } from 'svelte';

	let activeAccordion = $state(0);

	function toggleAccordion(index) {
		activeAccordion = activeAccordion === index ? null : index;
	}

	// FAQ Data
	const faqData = [
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
</script>

<svelte:head>
	<title>FAQ — Sui Wheel</title>
	<meta
		name="description"
		content="Câu hỏi thường gặp về Sui Wheel - ứng dụng vòng quay may mắn trên blockchain Sui với tính ngẫu nhiên công bằng và minh bạch."
	/>
	<meta property="og:title" content="FAQ — Sui Wheel" />
	<meta
		property="og:description"
		content="Câu hỏi thường gặp về Sui Wheel - ứng dụng vòng quay may mắn trên blockchain Sui."
	/>
</svelte:head>

<!-- Hero Section -->
<section class="hero from-primary/10 via-base-100 to-secondary/10 min-h-[30vh] bg-gradient-to-br">
	<div class="hero-content text-center">
		<div class="max-w-4xl">
			<h1 class="text-primary mb-6 text-5xl font-bold">
				<span class="from-primary to-secondary bg-gradient-to-r bg-clip-text text-transparent">
					Câu hỏi thường gặp
				</span>
			</h1>
			<p class="text-base-content/80 mx-auto mb-8 max-w-2xl text-xl">
				Tìm câu trả lời cho những câu hỏi phổ biến nhất về Sui Wheel
			</p>

			<!-- Breadcrumb -->
			<div class="text-base-content/60 mb-8 flex items-center justify-center gap-2 text-sm">
				<a href="/" class="link link-primary">Trang chủ</a>
				<span class="icon-[lucide--chevron-right] h-4 w-4"></span>
				<span class="text-base-content">FAQ</span>
			</div>
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
									bind:group={activeAccordion}
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
			<h2 class="mb-6 text-4xl font-bold text-white">Còn câu hỏi nào khác?</h2>
			<p class="mb-8 text-xl text-white/90">
				Nếu bạn không tìm thấy câu trả lời cho câu hỏi của mình, hãy liên hệ với chúng tôi để được
				hỗ trợ.
			</p>
			<div class="flex flex-col justify-center gap-4 sm:flex-row">
				<a href="/" class="btn btn-white btn-lg px-8">
					<span class="icon-[lucide--gamepad-2] h-6 w-6"></span>
					Bắt đầu ngay
				</a>
				<a href="/about" class="btn btn-outline btn-white btn-lg px-8">
					<span class="icon-[lucide--info] h-6 w-6"></span>
					Tìm hiểu thêm
				</a>
			</div>
		</div>
	</div>
</section>
