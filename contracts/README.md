# Sui Wheel Smart Contract

## Overview

The `sui_wheel` module implements a decentralized wheel-of-fortune style game on the Sui blockchain. It allows an organizer to create a shared wheel object with a list of participant addresses (entries), predefined prize amounts in SUI, and configurable delay and claim windows. The organizer can donate SUI to fund the prize pool, perform random spins to select winners (ensuring uniqueness by removing all duplicates of a selected winner), and reclaim unclaimed funds after the claim period. Winners can claim their prizes within the specified time window after each spin. The contract supports cancellation before any spins and includes safeguards like minimum/maximum entries, pool sufficiency checks, and time-based restrictions.

Key features:

- Random winner selection using Sui's `random` module, with support for duplicate entries (increasing chances for repeated addresses).
- Time-delayed claims to prevent immediate redemptions.
- Organizer-only controls for updates, spins, and reclaims.
- Event emissions for creation, spins, claims, and reclaims.
- Shared object model for the wheel, enabling public access for claims.

The contract enforces:

- Minimum 2 and maximum 200 entries.
- Entries must have at least as many unique addresses as prizes.
- Prize pool must cover total prizes before spins or updates.
- Claims only within [spin_time + delay, spin_time + delay + claim_window).
- Reclaims only after all spins and claim windows have passed.

## Constants

- Error codes (e.g., `ENotOrganizer = 0`, `EAlreadySpunMax = 1` for access and state validation).
- Minimum entries: 2.
- Maximum entries: 200.
- Minimum claim window: 1 hour (3600000 ms).
- Default claim window: 24 hours (86400000 ms).

## Structs

- `Wheel`: Core shared object storing organizer, remaining entries, winners, prize amounts, spin count/times, delay/claim windows, prize pool balance, and cancellation flag.
- `Winner`: Stores winner address, prize index, and claimed flag.

## Events

- `CreateEvent`: Emitted on wheel creation with wheel ID and organizer.
- `SpinEvent`: Emitted on each spin with wheel ID, winner, and prize index.
- `ClaimEvent`: Emitted on prize claim with wheel ID, winner, and amount.
- `ReclaimEvent`: Emitted on pool reclaim with wheel ID and amount.

## Public Functions

- `create_wheel`: Creates a new wheel with entries, prizes, delay, and claim window. Emits `CreateEvent`.
- `share_wheel`: Shares the wheel object publicly (must be called after creation).
- `donate_to_pool`: Organizer donates SUI to the pool (incremental donations allowed).
- `update_entries`: Organizer updates entries before any spins.
- `update_prize_amounts`: Organizer updates prizes before any spins (resets winners/spins if changed; checks pool sufficiency).
- `update_delay_ms`: Organizer updates delay before any spins.
- `update_claim_window_ms`: Organizer updates claim window before any spins (enforces minimum/default).
- `spin_wheel`: Organizer performs a random spin, selects unique winner, updates state, emits `SpinEvent`. Requires sufficient pool.
- `claim_prize`: Winner claims prize within time window, returns Coin<SUI>, emits `ClaimEvent`.
- `reclaim_pool`: Organizer reclaims remaining pool after all spins and claim windows, returns Coin<SUI>, emits `ReclaimEvent`.
- `auto_assign_last_prize`: Organizer auto-assigns last prize if one entry remains.
- `cancel_wheel_and_reclaim_pool`: Organizer cancels before spins, reclaims pool if funded.
- Accessors: Various read-only functions for organizer, entries, prizes, winners, times, delay, window, pool value, cancelled status, spun count, and claimed status.

## Helper Functions

- `count_unique`: Counts unique addresses in entries (used for validation).
- `transfer_optional_reclaim`: Handles optional reclaim coin transfer.

## Test Summary

The test suite (`sui_wheel_tests`) covers core functionalities, edge cases, and error scenarios using Sui's `test_scenario` framework. Key tests include:

- **Creation**: Successful creation with valid params; failures for invalid entries count, prizes > unique entries.
- **Donation**: Successful pool donation; failure on cancelled wheel.
- **Updates**: Successful updates to entries/prizes with sufficient pool; failures for non-organizer, after spins, insufficient pool.
- **Spins**: Multiple spins with randomness; auto-assign for last prize; handling duplicates (ensures unique winners); failure for insufficient pool.
- **Claims**: Successful claim within window; failures for too early, non-winner.
- **Reclaim**: Successful reclaim after claim window (unclaimed prizes); requires all spins completed.
- **Cancellation**: Successful cancel/reclaim before spins; failure after spins.

Tests use mocked balances, clocks, and randomness for deterministic behavior. All tests validate state changes, assertions, and event emissions indirectly via state checks.

## Deployment and Usage Examples

### Publish Wheel Contract

```
sui client publish --gas-budget 100000000
```

Published package ID: `0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09`

### Example Entries by SUI Address

```
0x4e4ab932a358e66e79cce1d94457d50029af1e750482ca3619ea3dd41f1c62b4
0x860de660df6f748354e7a6d44b36d302f9dbe70938b957837bf8556d258ca35f
```

### Create Wheel & Share Wheel Object

```
sui client ptb \
  --make-move-vec "<address>" "[@0x4e4ab932a358e66e79cce1d94457d50029af1e750482ca3619ea3dd41f1c62b4, @0x860de660df6f748354e7a6d44b36d302f9dbe70938b957837bf8556d258ca35f]" \
  --assign entries \
  --make-move-vec "<u64>" "[2000000000]" \
  --assign prize_amounts \
  --assign delay_ms 0 \
  --assign claim_window_ms 0 \
  --move-call 0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09::sui_wheel::create_wheel entries prize_amounts delay_ms claim_window_ms \
  --assign wheel \
  --move-call 0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09::sui_wheel::share_wheel wheel \
  --gas-budget 100000000
```

### Donate 2 SUI to Wheel's Pool

```
sui client ptb \
--split-coins gas "[2000000000]" \
--assign donation_coin \
--move-call 0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09::sui_wheel::donate_to_pool @<WHEEL_OBJECT_ID> donation_coin \
--gas-budget 100000000
```

### Spin

```
sui client ptb \
--move-call 0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09::sui_wheel::spin_wheel @<WHEEL_OBJECT_ID> @0x8 @0x6 \
--gas-budget 100000000
```

### Claim Prize

Remember to switch wallet to winner.

```
sui client ptb \
--move-call 0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09::sui_wheel::claim_prize @<WHEEL_OBJECT_ID> @0x6 \
--assign claimed_coin \
--merge-coins gas "[claimed_coin]" \
--gas-budget 100000000
```

### Reclaim Pool (Only for Organizer)

```
sui client ptb \
--move-call 0x70b44c598b4bffa29dc75e99fb03ebeee93bfbd3ef34066086a57d1b524a7f09::sui_wheel::reclaim_pool @<WHEEL_OBJECT_ID> @0x6 \
--assign claimed_coin \
--merge-coins gas "[claimed_coin]" \
--gas-budget 100000000
```
