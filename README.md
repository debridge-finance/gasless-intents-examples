# deBridge Gasless Intents — Examples

Runnable TypeScript examples for the [deBridge Borderless API](https://gasless-docs.debridge.finance/) — gasless, non-custodial
cross-chain and same-chain execution.

## Overview

Gasless intents let you bundle multiple trades across chains into a single atomic operation. The deBridge protocol signs and pays
gas on your behalf — you never need native tokens to cover transaction fees. This repository provides ready-to-run scripts
covering the full lifecycle: creating bundles, signing intents, submitting trades, querying status, cancelling bundles, attaching
pre/post-hooks, and working with both EVM and Solana chains.

## Examples

| Category                     | Description                                                                  | Chains       | Path                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Bundle Creation**          | Create and inspect bundles without submitting                                | EVM          | [`trades/basic-flow/propose-only/`](src/gasless-intents/trades/basic-flow/propose-only/)                    |
| **Bundle Submission**        | End-to-end create → sign → submit workflows                                  | EVM          | [`trades/basic-flow/submit/`](src/gasless-intents/trades/basic-flow/submit/)                                |
| **Querying Bundles**         | Fetch bundles by ID, owner, order ID, date range                             | EVM          | [`queries/`](src/gasless-intents/queries/)                                                                  |
| **Cancellation**             | Cancel by bundle ID, by intent owner, by partner authority, stuck bundles    | EVM          | [`cancellation/`](src/gasless-intents/cancellation/)                                                        |
| **Pre-hooks**                | Arbitrary on-chain actions executed before settlement                        | EVM          | [`hooks/prehooks/`](src/gasless-intents/hooks/prehooks/)                                                    |
| **Post-hooks**               | On-chain actions after settlement (Morpho deposit, ERC-20 send, native send) | EVM          | [`hooks/posthooks/`](src/gasless-intents/hooks/posthooks/)                                                  |
| **Pre/Post-Interactions**    | Intent-level on-chain hooks (observability, metrics, gating). Base only      | EVM (Base)   | [`interactions/`](src/gasless-intents/interactions/)                                                        |
| **Solana Source Chain**      | Bundles originating from Solana (AA enabled/disabled, pre-swap, same-chain)  | Solana → EVM | [`trades/solana/basic-flow/src-cases/`](src/gasless-intents/trades/solana/basic-flow/src-cases/)            |
| **Solana Destination Chain** | Atomic fulfillment with Solana as destination                                | EVM → Solana | [`trades/solana/basic-flow/dst-cases/`](src/gasless-intents/trades/solana/basic-flow/dst-cases/)            |
| **Solana Prepare Steps**     | SPL token approval and SOL wrapping before bundle submission                 | Solana       | [`trades/solana/basic-flow/prepare-steps/`](src/gasless-intents/trades/solana/basic-flow/prepare-steps/)    |
| **Solana Trade Scenarios**   | Mixed cross-chain and same-chain Solana bundles                              | EVM + Solana | [`trades/solana/trade-scenarios/`](src/gasless-intents/trades/solana/trade-scenarios/)                      |
| **WebSockets**               | Real-time bundle status tracking via WebSocket client + HTML tracker         | EVM          | [`web-sockets/`](src/gasless-intents/web-sockets/)                                                          |
| **EIP-7702 Authorization**   | Manual account abstraction authorization on Base                             | EVM (Base)   | [`utility-scripts/authorization-7702/`](src/gasless-intents/utility-scripts/authorization-7702/)            |
| **Price API**                | Token rates table and price chart with SVG output                            | Any chain    | [`price/examples/`](src/price/examples/)                                                                    |

## Quick Start

```bash
nvm use                    # Node v20.18.0
npm install
cp .env.example .env       # fill in keys (see below)
```

Run your first queries:

```bash
npx tsx src/gasless-intents/queries/get-bundles.ts
npx tsx src/gasless-intents/queries/get-bundle-by-id.ts
```

Submit a bundle end-to-end:

```bash
npx tsx src/gasless-intents/trades/basic-flow/submit/submit-bundle.ts
```

### Prerequisites

- **Node.js v20.18.0** — `.nvmrc` provided, run `nvm use`
- **RPC URLs** — Alchemy (or equivalent) endpoints for Polygon, BNB Chain, Arbitrum, Base, and Solana
- **EVM private key** (`SIGNER_PK`) — wallet that will sign EIP-712 intents
- **Solana private key** (`SOL_PK`) — base58-encoded keypair (only needed for Solana examples)
- **deBridge partner API key** (`DE_BRIDGE_PARTNER_API_KEY`) — obtain from deBridge

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable                    | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `SIGNER_PK`                 | EVM private key (hex, with or without `0x` prefix) |
| `SOL_PK`                    | Solana private key (base58-encoded)                |
| `POLYGON_RPC_URL`           | Polygon RPC endpoint                               |
| `BNB_RPC_URL`               | BNB Chain RPC endpoint                             |
| `ARB_RPC_URL`               | Arbitrum RPC endpoint                              |
| `BASE_RPC_URL`              | Base RPC endpoint                                  |
| `SOL_RPC_URL`               | Solana RPC endpoint                                |
| `DE_BRIDGE_PARTNER_API_KEY` | deBridge partner API key                           |

## Category Details

### Bundle Creation

Create bundles via the Borderless API without submitting them on-chain. Useful for inspecting the response payload, understanding
intent structure, and validating trade parameters. `trades/basic-flow/propose-only/create-bundle.ts` shows a minimal single-trade
example; `multi-poly-to-bsc.ts` demonstrates multi-trade bundles.

### Bundle Submission

End-to-end workflow: create a bundle of trades, collect EIP-712 signatures for each intent via `processIntentBundle()`, and
submit. `trades/basic-flow/submit/submit-bundle.ts` shows a 3-trade Polygon/BSC bundle with account abstraction enabled.
`aa-disabled-evm.ts` shows the same flow with `enableAccountAbstraction: false`, requiring the signer to pay gas directly.

### Querying Bundles

Read-only scripts for fetching bundle data. Filter bundles by owner address, by creation or update date range, by order ID, or
retrieve a single bundle by its UUID. These scripts only require a valid API key — no private keys needed.

### Cancellation

Cancel pending bundles before they are fulfilled. `cancel-bundle-by-id.ts` cancels a single bundle by UUID.
`cancel-bundles-intent-owner.ts` cancels all bundles for a given intent owner within a time window.
`cancel-bundle-partner-authority.ts` cancels via the partner authority. `stuck-bundle.ts` demonstrates handling bundles with
unfavorable pricing that won't be fulfilled.

### Pre-hooks & Post-hooks

Attach arbitrary on-chain actions to bundles. Pre-hooks execute before the bundle's intents are processed (e.g., sending native
assets to fund an operation). Post-hooks execute after settlement — examples include depositing received USDC into a Morpho vault,
sending ERC-20 tokens to another address, and forwarding native assets to a beneficiary.

### Pre/Post-Interactions

`preInteractions` / `postInteractions` are **per-intent** on-chain hook calls executed on the source chain around the maker's
fill. The example scripts in [`src/gasless-intents/interactions/`](src/gasless-intents/interactions/) cover observability, on-chain metrics,
protocol-fee derivation, compliance gating, and soft/hard rate limiting use cases.

The Solidity receiver contracts and generated artefacts live under [`solidity/`](solidity/). Contract utility scripts use the
hardcoded Base mainnet addresses in
[`deployed-addresses.ts`](src/gasless-intents/interactions/contract-utils/shared/deployed-addresses.ts), so they do not depend on
local deployment ledger files being present.

### Solana Examples

Solana examples span four directories. **Source chain** scripts create bundles that originate from Solana with both AA-enabled and
AA-disabled flows, plus a pre-swap variant. **Destination chain** shows atomic fulfillment when Solana is the receiving chain.
**Prepare steps** handle SPL token approval (`check-approve-spl-prepare.ts`) and SOL wrapping (`check-wrap-sol-prepare.ts`)
required before submitting Solana-origin bundles. **Trade scenarios** demonstrate mixed bundles combining cross-chain and
same-chain Solana trades (e.g., 2 cross-chain + 2 same-chain, or 3 same-chain SOL swaps).

### WebSockets

Real-time bundle tracking over WebSockets. `example.ts` connects to the deBridge WebSocket API and subscribes to bundle updates
filtered by referral code, intent owner, or bundle ID. `DebridgeWsClient.ts` is a reusable client with auto-reconnect.
`bundle-tracker-ws.html` provides a browser-based tracker UI.

### EIP-7702 Authorization

`utility-scripts/authorization-7702/manual-authorization-base.ts` demonstrates signing and submitting an EIP-7702 authorization
transaction on Base. This delegates your EOA to a
[EIP7702StatelessDeleGator](https://github.com/MetaMask/delegation-framework/blob/main/documents/EIP7702DeleGator.md) contract,
introduced with MetaMask delegation framework, enabling account abstraction without deploying a separate smart account.

### Price API

`token-rates.ts` fetches current USD prices for a set of tokens via `POST /v1/token/price` and renders a table as an SVG file.
`token-chart.ts` fetches historical price data via `GET /v1/token/chart` (line or OHLC) and renders a chart as an SVG file.
Additional chart scripts demonstrate longer time ranges (`THREE_MONTHS`, `SIX_MONTHS`, `FIVE_YEARS`, `ALL`).
All scripts write SVG output to the `output/` directory.

```bash
npx tsx src/price/examples/chart-three-months.ts   # → output/token-chart-line-THREE_MONTHS.svg
npx tsx src/price/examples/chart-six-months.ts     # → output/token-chart-line-SIX_MONTHS.svg
npx tsx src/price/examples/chart-five-years.ts     # → output/token-chart-line-FIVE_YEARS.svg
npx tsx src/price/examples/chart-all.ts            # → output/token-chart-line-ALL.svg
```

> **Note:** The `canvas` npm package (used by Vega for server-side SVG rendering) has native bindings. On Ubuntu/WSL, install system libraries first:
> `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

## Common Patterns

- **Bundle lifecycle**: `createBundle()` → collect signatures via `processIntentBundle()` → `submitBundle()`
- **Wallet setup**: viem `WalletClient` instances for EVM chains, Solana `Keypair` for Solana, mapped by chain ID via
  `getChainIdToWalletClientMap()`
- **Signing**: EIP-712 typed data for EVM intents, NaCl (`tweetnacl`) for Solana, EIP-7702 for account abstraction authorization
- **Trade definitions**: Factory functions in `trade-blueprints.ts` (e.g., `getPolyUsdcToBscUsdcTrade()`) or inline `Trade` objects
- **Hooks**: Pre/post-hooks attached to the `BundleProposeBody` as arrays of calldata objects targeting specific chains and
  contracts
- **Atomicity**: `isAtomic: true` ensures all-or-nothing settlement — either every intent in the bundle is fulfilled, or none are

## Project Structure

```
src/
├── gasless-intents/            # All example scripts
│   ├── queries/                # Read-only bundle queries
│   ├── cancellation/           # Bundle cancellation flows
│   ├── hooks/                  # Pre-hook, post-hook, gas-limit, and delegated/direct hook examples
│   ├── interactions/           # Per-intent on-chain pre/postInteractions (Base)
│   ├── trades/
│   │   ├── basic-flow/         # EVM propose-only and submit examples
│   │   ├── permit/             # Permit examples
│   │   └── solana/             # Solana source/destination/prepare/trade scenarios
│   ├── utility-scripts/        # Balances, permits, EIP-7702, lending helpers, wallet migration
│   ├── web-sockets/            # WebSocket client & HTML tracker
│   ├── trade-blueprints.ts     # Trade factory functions
│   └── types.ts                # Shared TypeScript types
├── price/                      # Price API
│   ├── examples/               # Runnable scripts (rates, charts by range)
│   ├── renderers/              # Vega-Lite SVG renderers
└── utils/                      # Shared utilities
    ├── gasless-api.ts          # createBundle, submitBundle, getBundles, cancelBundles
    ├── chains.ts               # Chain ID constants
    ├── constants.ts            # Token addresses, API URLs
    ├── wallet.ts               # Wallet client setup
    ├── hooks/                  # Hook builders
    ├── signatures/
    │   └── intent-signatures.ts  # EIP-712 & NaCl signing
    ├── solana/                 # Solana-specific utilities
    ├── morpho/                 # Morpho vault integration
    └── contract-calls/         # Low-level contract interaction helpers
```

## Contributing

1. Add examples under `src/gasless-intents/` in a descriptive subdirectory
2. Use `@utils/*` and `@gasless-intents/*` path aliases for cross-module imports
3. Run `npm run lint` before committing
4. Keep examples self-contained and runnable with `npx tsx`

## Resources

- [Documentation](https://gasless-docs.debridge.com)
- [Supported Chains & Fees](https://gasless-docs.debridge.com/overview/supported-chains)
- [API Reference](https://gasless-docs.debridge.com/api-reference/gasless-api/get-bundles-with-filters-sorting-and-pagination)
- [Chain IDs Endpoint](https://gasless-docs.debridge.com/api-reference/dln-api--utils/get-v1dlnsupported-chains-info)
- [X](https://x.com/debridge)
- [Discord](https://discord.com/invite/debridge)
