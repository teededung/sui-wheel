<svelte:head>
	<title>About — Sui Wheel</title>
	<meta
		name="description"
		content={'About Sui Wheel — create and manage on-chain prize wheels on Sui Testnet.'}
	/>
	<meta property="og:title" content={'About — Sui Wheel'} />
	<meta
		property="og:description"
		content={'About Sui Wheel — create and manage on-chain prize wheels on Sui Testnet.'}
	/>
</svelte:head>

<section class="container mx-auto px-4 py-4">
	<div class="mx-auto max-w-4xl">
		<div class="card prose bg-base-200 mx-auto shadow-xl">
			<div class="card-body p-0 md:p-6">
				<div class="tabs tabs-lift">
					<!-- Tab English -->
					<label class="tab w-1/2">
						<input type="radio" name="language_tabs" checked="checked" />
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 32 24"
							><g fill="none"
								><path
									fill="#f7fcff"
									fill-rule="evenodd"
									d="M0 0h32v24H0z"
									clip-rule="evenodd"
								/><path
									fill="#e31d1c"
									fill-rule="evenodd"
									d="M0 14.667v2h32v-2zm0 3.666v2h32v-2zm0-11v2h32v-2zM0 22v2h32v-2zm0-11v2h32v-2zM0 0v2h32V0zm0 3.667v2h32v-2z"
									clip-rule="evenodd"
								/><path fill="#2e42a5" d="M0 0h20v13H0z" /><path
									fill="#f7fcff"
									fill-rule="evenodd"
									d="m1.722 2.939l-.726.509l.245-.906l-.645-.574h.843l.282-.74l.331.74h.718l-.564.574l.218.906zm4 0l-.726.509l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm3.274.509l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.842l.644.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zM.996 7.449l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74H.596l.645.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm3.274.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.842l.644.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zM.996 11.449l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74H.596l.645.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm3.274.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.842l.644.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm3.274-7.49l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.843l.645.574zm.726 3.49l-.726.51l.245-.906l-.645-.574h.843l.282-.74l.331.74h.718l-.564.574l.218.906zm-.726 4.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.843l.645.574zM3.722 4.938l-.726.51l.245-.906l-.645-.574h.843l.282-.74l.331.74h.718l-.564.574l.218.906zm3.274.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.843l.645.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm-8.726 4.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.843l.645.574zm4.726-.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm3.274.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.842l.644.574zm4.726-4.51l-.726.51l.245-.906l-.644-.574h.842l.282-.74l.331.74h.718l-.564.574l.218.906zm-.726 4.51l.726-.51l.702.51l-.218-.906l.564-.574h-.718l-.331-.74l-.282.74h-.842l.644.574z"
									clip-rule="evenodd"
								/></g
							></svg
						>
						<span class="ml-3">English</span>
					</label>
					<div class="tab-content bg-base-100 border-base-300 p-6">
						<div class="prose max-w-none">
							<h2 class="text-center">About Sui Wheel</h2>
							<p>
								This app lets you create an on-chain prize wheel on Sui Testnet, spin to pick
								winners, and track results. Connect your wallet, configure entries and prizes, and
								spin fairly using on-chain randomness.
							</p>

							<div role="alert" class="not-prose alert alert-soft alert-info">
								<span>
									This app supports both off-chain and on-chain on Sui. To use on-chain features,
									please connect your wallet.
								</span>
							</div>

							<h3 class="text-center">Guide for Organizers</h3>
							<div class="space-y-4">
								<div class="flex items-center gap-4">
									<div
										class="badge badge-primary badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										1
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Connect Wallet</h4>
										<p class="text-sm opacity-80">
											Connect your wallet (prefer Slush Wallet) to get started
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-secondary badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										2
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Configure Your Wheel</h4>
										<p class="text-sm opacity-80">
											Add entries, prizes, timing, and fund the pool with sufficient tokens
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-accent badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										3
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Edit Before Spins</h4>
										<p class="text-sm opacity-80">
											You can edit entries/prizes/timing only before any spins start (coming soon)
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-success badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										4
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Spin for Winners</h4>
										<p class="text-sm opacity-80">
											Spin the wheel to randomly select winners from your entries
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-info badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										5
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Claim Link Generated</h4>
										<p class="text-sm opacity-80">
											After all spins complete, a claim link appears for the organizer
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-neutral badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										6
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Reclaim Unclaimed Funds</h4>
										<p class="text-sm opacity-80">
											Unclaimed funds can be reclaimed after the claim window expires
										</p>
									</div>
								</div>
							</div>

							<h3 class="text-center">Wheel Mechanism</h3>
							<div class="space-y-3">
								<div class="alert alert-soft alert-success">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">On-Chain Randomness</h4>
										<p>
											The wheel uses on-chain randomness to select winners from the remaining
											entries without replacement (unique winners).
										</p>
									</div>
								</div>

								<div class="alert alert-soft alert-info">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Winner Selection Process</h4>
										<p>
											Each spin removes the winner and all their duplicate entries if any. Winners
											are assigned prizes in the order of spins.
										</p>
									</div>
								</div>

								<div class="alert alert-soft alert-warning">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Time-Locked Claims</h4>
										<p>
											Claims are time-locked with a delay and must occur within the claim window
											after their spin.
										</p>
									</div>
								</div>

								<div class="alert alert-soft alert-neutral">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Organizer Control</h4>
										<p>
											The organizer controls spins and can cancel the wheel before spins to reclaim
											the pool.
										</p>
									</div>
								</div>
							</div>

							<h3 class="text-center">Rules</h3>
							<ul>
								<li>
									Minimum 2 entries, maximum 200; entries must have at least as many unique
									addresses as prizes.
								</li>
								<li>Prizes must be fully funded in the pool before spins.</li>
								<li>Claim window minimum 1 hour, default 24 hours if not specified.</li>
								<li>Winners must claim within their time window or forfeit the prize.</li>
								<li>No updates after spins start; wheel can be cancelled only before spins.</li>
								<li>Auto-assign last prize if one entry remains for the final spin.</li>
							</ul>

							<h3 class="text-center">Roadmap</h3>
							<ul class="not-prose timeline timeline-vertical">
								<li>
									<div class="timeline-start timeline-box">Initial release</div>
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="text-primary h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<hr />
								</li>
								<li>
									<hr />
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<div class="timeline-end timeline-box">Edit entries & prizes (guarded)</div>
									<hr />
								</li>
								<li>
									<hr />
									<div class="timeline-start timeline-box">Support Sui Names for entries</div>
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<hr />
								</li>
								<li>
									<hr />
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<div class="timeline-end timeline-box">Expand prizes: coins & NFTs</div>
									<hr />
								</li>
							</ul>

							<p class="mt-12 text-center text-sm opacity-70">
								Built with Svelte 5, Tailwind CSS 4 and daisyUI.
							</p>
						</div>
					</div>

					<!-- Tab Vietnamese -->
					<label class="tab w-1/2">
						<input type="radio" name="language_tabs" />
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 32 24"
							><g fill="none"
								><path
									fill="#f7fcff"
									fill-rule="evenodd"
									d="M0 0h32v24H0z"
									clip-rule="evenodd"
								/><path
									fill="#e31d1c"
									fill-rule="evenodd"
									d="M0 0v24h32V0z"
									clip-rule="evenodd"
								/><mask
									id="SVGTrazyc7b"
									width="32"
									height="24"
									x="0"
									y="0"
									maskUnits="userSpaceOnUse"
									style="mask-type:luminance"
									><path
										fill="#fff"
										fill-rule="evenodd"
										d="M0 0v24h32V0z"
										clip-rule="evenodd"
									/></mask
								><g mask="url(#SVGTrazyc7b)"
									><path
										fill="#ffd221"
										fill-rule="evenodd"
										d="m16.062 15.98l-5.15 3.275l1.727-5.733l-3.674-3.746l5.065-.11l2.241-5.66l2.042 5.734l5.053.089l-3.797 3.814l1.773 5.454z"
										clip-rule="evenodd"
									/></g
								></g
							></svg
						>
						<span class="ml-3">Tiếng Việt</span>
					</label>
					<div class="tab-content bg-base-100 border-base-300 p-6">
						<div class="prose max-w-none">
							<h2 class="text-center">Giới thiệu về Sui Wheel</h2>
							<p>
								Ứng dụng này cho phép bạn tạo vòng quay giải thưởng trên chuỗi Sui Testnet, quay để
								chọn người thắng cuộc, và theo dõi kết quả. Kết nối ví, cấu hình người tham gia và
								giải thưởng, và quay một cách công bằng sử dụng tính ngẫu nhiên trên chuỗi.
							</p>

							<div role="alert" class="not-prose alert alert-soft alert-info">
								<span>
									Ứng dụng này hỗ trợ cả chế độ offline và on-chain trên Sui. Để sử dụng các tính
									năng on-chain, vui lòng kết nối ví của bạn.
								</span>
							</div>

							<h3 class="text-center">Hướng dẫn cho Người tổ chức</h3>
							<div class="space-y-4">
								<div class="flex items-center gap-4">
									<div
										class="badge badge-primary badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										1
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Kết nối Ví</h4>
										<p class="text-sm opacity-80">
											Kết nối ví của bạn (ưu tiên Slush Wallet) để bắt đầu
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-secondary badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										2
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Cấu hình Vòng quay</h4>
										<p class="text-sm opacity-80">
											Thêm người tham gia, giải thưởng, thời gian và nạp đủ token vào pool
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-accent badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										3
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Chỉnh sửa trước khi quay</h4>
										<p class="text-sm opacity-80">
											Bạn chỉ có thể chỉnh sửa trước khi bắt đầu quay (sắp ra mắt)
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-success badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										4
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Quay chọn người thắng</h4>
										<p class="text-sm opacity-80">
											Quay vòng quay để chọn ngẫu nhiên người thắng từ danh sách
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-info badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										5
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Liên kết Claim được tạo</h4>
										<p class="text-sm opacity-80">
											Sau khi quay xong, liên kết claim sẽ xuất hiện cho người tổ chức
										</p>
									</div>
								</div>

								<div class="flex items-center gap-4">
									<div
										class="badge badge-neutral badge-lg flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg font-bold"
									>
										6
									</div>
									<div class="flex-1">
										<h4 class="text-base-content mb-1 font-semibold">Thu hồi tiền chưa claim</h4>
										<p class="text-sm opacity-80">
											Số tiền chưa được claim có thể thu hồi sau khi hết thời gian
										</p>
									</div>
								</div>
							</div>

							<h3 class="text-center">Cơ chế hoạt động của Wheel</h3>
							<div class="space-y-3">
								<div class="alert alert-soft alert-success">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Ngẫu nhiên trên chuỗi</h4>
										<p>
											Vòng quay sử dụng tính ngẫu nhiên trên chuỗi để chọn người thắng từ danh sách
											còn lại không có thay thế (người thắng duy nhất).
										</p>
									</div>
								</div>

								<div class="alert alert-soft alert-info">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Quy trình chọn người thắng</h4>
										<p>
											Mỗi lần quay sẽ loại bỏ người thắng và tất cả các entry trùng lặp của họ nếu
											có. Người thắng được gán giải thưởng theo thứ tự quay.
										</p>
									</div>
								</div>

								<div class="alert alert-soft alert-warning">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Claim có khóa thời gian</h4>
										<p>
											Các claim được khóa thời gian với độ trễ và phải được thực hiện trong khoảng
											thời gian claim sau lần quay của họ.
										</p>
									</div>
								</div>

								<div class="alert alert-soft alert-neutral">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-6 w-6 shrink-0 stroke-current"
										fill="none"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									<div>
										<h4 class="font-semibold">Kiểm soát của Người tổ chức</h4>
										<p>
											Người tổ chức kiểm soát các lần quay và có thể hủy vòng quay trước khi quay để
											thu hồi quỹ.
										</p>
									</div>
								</div>
							</div>

							<h3 class="text-center">Quy tắc</h3>
							<ul>
								<li>
									Tối thiểu 2 người tham gia, tối đa 200; số người tham gia phải có ít nhất bằng số
									giải thưởng.
								</li>
								<li>Giải thưởng phải được nạp đầy đủ vào pool trước khi quay.</li>
								<li>Thời gian claim tối thiểu 1 giờ, mặc định 24 giờ nếu không được chỉ định.</li>
								<li>Người thắng phải claim trong khoảng thời gian của họ hoặc mất giải thưởng.</li>
								<li>
									Không thể cập nhật sau khi bắt đầu quay; vòng quay chỉ có thể bị hủy trước khi
									quay.
								</li>
								<li>
									Tự động gán giải thưởng cuối cùng nếu còn 1 người tham gia cho lần quay cuối.
								</li>
							</ul>

							<h3 class="text-center">Lộ trình phát triển</h3>
							<ul class="not-prose timeline timeline-vertical">
								<li>
									<div class="timeline-start timeline-box">Phiên bản đầu tiên</div>
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="text-primary h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<hr />
								</li>
								<li>
									<hr />
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<div class="timeline-end timeline-box">
										Chỉnh sửa người tham gia & giải thưởng (được bảo vệ)
									</div>
									<hr />
								</li>
								<li>
									<hr />
									<div class="timeline-start timeline-box">Hỗ trợ Sui Names cho người tham gia</div>
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<hr />
								</li>
								<li>
									<hr />
									<div class="timeline-middle">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 20 20"
											fill="currentColor"
											class="h-5 w-5"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
									<div class="timeline-end timeline-box">Mở rộng giải thưởng: coin & NFT</div>
									<hr />
								</li>
							</ul>

							<p class="mt-12 text-center text-sm opacity-70">
								Xây dựng với Svelte 5, Tailwind CSS 4 và daisyUI.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
