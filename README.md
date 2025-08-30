# About Sui Wheel

This app lets you create an on-chain prize wheel on Sui Testnet, spin to pick winners, and track results. Connect your wallet, configure entries and prizes, and spin fairly using on-chain randomness.

> **Note:** This app supports both off-chain and on-chain on Sui. To use on-chain features, please connect your wallet.

## Guide for Organizers

- Connect wallet (prefer Slush Wallet)
- Add entries, prizes, timing, and fund pool
- Update entries/prizes/timing only before any spins (coming soon)
- Spin to select winners randomly
- After all spins, reclaim unclaimed funds after claim window

## Wheel Mechanism

The wheel uses on-chain randomness to select winners from the remaining entries without replacement (unique winners). Each spin removes the winner and all their duplicate entries if any. Winners are assigned prizes in the order of spins. Claims are time-locked with a delay and must occur within the claim window after their spin. The organizer controls spins and can cancel the wheel before spins to reclaim the pool.

## Rules

- Minimum 2 entries, maximum 200; entries must have at least as many unique addresses as prizes.
- Prizes must be fully funded in the pool before spins.
- Claim window minimum 1 hour, default 24 hours if not specified.
- Winners must claim within their time window or forfeit the prize.
- No updates after spins start; wheel can be cancelled only before spins.
- Auto-assign last prize if one entry remains for the final spin.

## Roadmap

- ✅ Initial release
- Edit entries & prizes (guarded)
- Support Sui Names for entries
- Expand prizes: coins & NFTs

Built with Svelte 5, Tailwind CSS 4 and daisyUI.
