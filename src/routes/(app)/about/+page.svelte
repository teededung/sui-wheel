<section class="container mx-auto px-4 py-4">
	<div class="mx-auto max-w-3xl">
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body prose mx-auto p-6">
				<h2 class="text-center">About Sui Wheel</h2>
				<p>
					This app lets you create an on-chain prize wheel on Sui Testnet, spin to pick winners, and
					track results. Connect your wallet, configure entries and prizes, and spin fairly using
					on-chain randomness.
				</p>

				<div role="alert" class="not-prose alert alert-info">
					<span>
						This app supports both off-chain and on-chain on Sui. To use on-chain features, please
						connect your wallet.
					</span>
				</div>

				<h3 class="text-center">Guide for Organizers</h3>
				<ul class="not-prose steps steps-vertical">
					<li class="step">Connect wallet (prefer Slush Wallet)</li>
					<li class="step">Add entries, prizes, timing, and fund pool</li>
					<li class="step">Update entries/prizes/timing only before any spins (coming soon)</li>
					<li class="step">Spin to select winners randomly</li>
					<li class="step">After all spins, reclaim unclaimed funds after claim window</li>
				</ul>

				<h3 class="text-center">Wheel Mechanism</h3>
				<p>
					The wheel uses on-chain randomness to select winners from the remaining entries without
					replacement (unique winners). Each spin removes the winner and all their duplicate entries
					if any. Winners are assigned prizes in the order of spins. Claims are time-locked with a
					delay and must occur within the claim window after their spin. The organizer controls
					spins and can cancel the wheel before spins to reclaim the pool.
				</p>

				<h3 class="text-center">Rules</h3>
				<ul>
					<li>
						Minimum 2 entries, maximum 200; entries must have at least as many unique addresses as
						prizes.
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
	</div>
</section>
