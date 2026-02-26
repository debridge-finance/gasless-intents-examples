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
| **Bundle Creation**          | Create and inspect bundles without submitting                                | EVM          | [`prepare-bundle/`](src/gasless-intents/prepare-bundle/)                                                    |
| **Bundle Submission**        | End-to-end create → sign → submit workflows                                  | EVM          | [`submit-bundle*.ts`](src/gasless-intents/), [`aa-disabled-evm.ts`](src/gasless-intents/aa-disabled-evm.ts) |
| **Querying Bundles**         | Fetch bundles by ID, owner, order ID, date range                             | EVM          | [`queries/`](src/gasless-intents/queries/)                                                                  |
| **Cancellation**             | Cancel by bundle ID, by intent owner, by partner authority, stuck bundles    | EVM          | [`cancellation/`](src/gasless-intents/cancellation/)                                                        |
| **Pre-hooks**                | Arbitrary on-chain actions executed before settlement                        | EVM          | [`prehooks/`](src/gasless-intents/prehooks/)                                                                |
| **Post-hooks**               | On-chain actions after settlement (Morpho deposit, ERC-20 send, native send) | EVM          | [`posthooks/`](src/gasless-intents/posthooks/)                                                              |
| **Solana Source Chain**      | Bundles originating from Solana (AA enabled/disabled, pre-swap, same-chain)  | Solana → EVM | [`solana/src-cases/`](src/gasless-intents/solana/src-cases/)                                                |
| **Solana Destination Chain** | Atomic fulfillment with Solana as destination                                | EVM → Solana | [`solana/dst-cases/`](src/gasless-intents/solana/dst-cases/)                                                |
| **Solana Prepare Steps**     | SPL token approval and SOL wrapping before bundle submission                 | Solana       | [`solana/prepare-steps/`](src/gasless-intents/solana/prepare-steps/)                                        |
| **Solana Trade Scenarios**   | Mixed cross-chain and same-chain Solana bundles                              | EVM + Solana | [`solana-trade-scenarios/`](src/gasless-intents/solana-trade-scenarios/)                                    |
| **WebSockets**               | Real-time bundle status tracking via WebSocket client + HTML tracker         | EVM          | [`web-sockets/`](src/gasless-intents/web-sockets/)                                                          |
| **EIP-7702 Authorization**   | Manual account abstraction authorization on Base                             | EVM (Base)   | [`manual-authorization-base.ts`](src/gasless-intents/manual-authorization-base.ts)                          |

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
npx tsx src/gasless-intents/submit-bundle.ts
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
intent structure, and validating trade parameters. `create-bundle.ts` shows a minimal single-trade example; `multi-poly-to-bsc.ts`
demonstrates multi-trade bundles.

### Bundle Submission

End-to-end workflow: create a bundle of trades, collect EIP-712 signatures for each intent via `processIntentBundle()`, and
submit. `submit-bundle.ts` shows a 3-trade Polygon/BSC bundle with account abstraction enabled. `aa-disabled-evm.ts` shows the
same flow with `enableAccountAbstraction: false`, requiring the signer to pay gas directly.

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

`manual-authorization-base.ts` demonstrates signing and submitting an EIP-7702 authorization transaction on Base. This delegates
your EOA to a
[EIP7702StatelessDeleGator](https://github.com/MetaMask/delegation-framework/blob/main/documents/EIP7702DeleGator.md) contract,
introduced with MetaMask delegation framework, enabling account abstraction without deploying a separate smart account.

## Common Patterns

- **Bundle lifecycle**: `createBundle()` → collect signatures via `processIntentBundle()` → `submitBundle()`
- **Wallet setup**: viem `WalletClient` instances for EVM chains, Solana `Keypair` for Solana, mapped by chain ID via
  `getChainIdToWalletClientMap()`
- **Signing**: EIP-712 typed data for EVM intents, NaCl (`tweetnacl`) for Solana, EIP-7702 for account abstraction authorization
- **Trade definitions**: Factory functions in `trades.ts` (e.g., `getPolyUsdcToBscUsdcTrade()`) or inline `Trade` objects
- **Hooks**: Pre/post-hooks attached to the `BundleProposeBody` as arrays of calldata objects targeting specific chains and
  contracts
- **Atomicity**: `isAtomic: true` ensures all-or-nothing settlement — either every intent in the bundle is fulfilled, or none are

## Project Structure

```
src/
├── gasless-intents/            # All example scripts
│   ├── prepare-bundle/         # Bundle creation (no submission)
│   ├── queries/                # Read-only bundle queries
│   ├── cancellation/           # Bundle cancellation flows
│   ├── prehooks/               # Pre-hook examples
│   ├── posthooks/              # Post-hook examples
│   ├── solana/
│   │   ├── src-cases/          # Solana as source chain
│   │   ├── dst-cases/          # Solana as destination chain
│   │   └── prepare-steps/      # SPL approve & SOL wrap
│   ├── solana-trade-scenarios/ # Mixed Solana trade bundles
│   ├── web-sockets/            # WebSocket client & HTML tracker
│   ├── submit-bundle.ts        # Main EVM submission example (AA enabled)
│   ├── submit-bundle-example-2.ts
│   ├── submit-bundle-poly-to-base.ts
│   ├── aa-disabled-evm.ts      # Submission without account abstraction
│   ├── manual-authorization-base.ts  # EIP-7702 authorization
│   ├── trades.ts               # Trade factory functions
│   └── types.ts                # Shared TypeScript types
└── utils/                      # Shared utilities
    ├── api.ts                  # createBundle, submitBundle, getBundles, cancelBundles
    ├── chains.ts               # Chain ID constants
    ├── constants.ts            # Token addresses, API URLs
    ├── wallet.ts               # Wallet client setup
    ├── posthooks.ts            # Post-hook builders
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
