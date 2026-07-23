# gasless-sdk

A small CLI for deBridge HyperLiquid gasless flows in both directions:

- **deposit** — any supported EVM ERC-20 → HyperCore spot (`npm run deposit`). Any
  non-HyperLiquid `--to` instead runs a plain EVM → EVM gasless trade through the same command.
- **withdraw** — HyperCore spot → any supported EVM chain (`npm run withdraw`).

The tool **never broadcasts a transaction** except the optional `--approve` (below): it reads
on-chain state, signs typed data, and calls the API. The gasless relayer pays gas.

## Setup

```bash
npm install
cp .env.example .env     # set HL_PRIVATE_KEY
```

The **only** value you need to set is `HL_PRIVATE_KEY` (the signing EOA that holds the funds).
Everything else has a working default built in. For a `--dry-run` you don't even need a key —
pass `--account <0xaddr>` instead.

To deposit **from Solana**, also set `HL_SOLANA_PRIVATE_KEY` (base58 or a 64-byte JSON array) —
it signs the Solana side. The funds are received on HyperCore at your `HL_PRIVATE_KEY` address.

Node 20+ required.

## Supported chains

Ethereum (1), Optimism (10), BNB (56), Gnosis (100), Polygon (137), Base (8453),
Arbitrum (42161), Avalanche (43114), Linea (59144), Solana (7565164). Use the name, an alias,
or the chainId. Tokens can be a symbol (USDC) or an address; on Solana use a symbol (USDC, SOL)
or a base58 mint; for other non-HyperLiquid destinations pass the token as a `0x…` address.

## Flags

| flag                            | effect                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| `--dry-run`                     | build, price (and verify, on withdraw) only — never sign or submit  |
| `--account <0xaddr>`            | holder address for a `--dry-run` when no `HL_PRIVATE_KEY` is set     |
| `--recipient <0xaddr\|base58>`  | override the payout address on the destination chain (default: your own address; EVM `0x…` or Solana base58). Takes priority over `HL_SOLANA_RECIPIENT`. |
| `--approve`                     | (deposit only) if the ERC-20 allowance is short, send one unlimited approve first (needs native gas on the source chain) |

## Deposit (EVM → HyperCore)

```bash
# fixed amount, token by symbol
npm run deposit -- --from Arbitrum USDC 1.1 --to HyperLiquid USDC

# token by chainId + address, whole balance minus fees
npm run deposit -- --from 8453 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 max --to HyperLiquid USDC

# preview only — no key, no signing
npm run deposit -- --from Arbitrum USDC 1.1 --to HyperLiquid USDC --dry-run --account 0xYourAddress

# send an unlimited ERC-20 approve first if the allowance is short (needs native gas)
npm run deposit -- --from Arbitrum USDC 1.1 --to HyperLiquid USDC --approve
```

### Deposit from Solana

Set `HL_SOLANA_PRIVATE_KEY` (signs the Solana side); the funds land on HyperCore at your
`HL_PRIVATE_KEY` address. Tokens are Solana symbols (USDC, SOL) or base58 mints.

```bash
# 5 USDC from Solana to HyperCore
npm run deposit -- --from Solana USDC 5 --to HyperLiquid USDC

# preview only — no keys; give the Solana source address and the EVM recipient
HL_SOLANA_RECIPIENT=<YourSolanaAddress> \
  npm run deposit -- --from Solana USDC 5 --to HyperLiquid USDC --dry-run --account 0xYourAddress
```

## Withdraw (HyperCore → EVM)

```bash
# 5 USDC from HyperCore spot to Arbitrum
npm run withdraw -- --from HyperLiquid USDC 5 --to Arbitrum USDC

# whole spot balance (the backend computes the cap)
npm run withdraw -- --from HyperLiquid USDC max --to Polygon USDC

# preview: build, price and verify without a key
npm run withdraw -- --from HyperLiquid USDC 1 --to Arbitrum USDC --dry-run --account 0xYourAddress

# HyperCore → Solana (payout address via --recipient, or set HL_SOLANA_RECIPIENT)
npm run withdraw -- --from HyperLiquid USDC 5 --to Solana USDC --recipient <YourSolanaAddress>
```

Withdraw to Solana only receives — no Solana key is needed. The payout address comes from
`--recipient`, else `HL_SOLANA_RECIPIENT`, else the `HL_SOLANA_PRIVATE_KEY` address if set.

There is no `--approve` on a withdraw: HyperCore has no allowance model. You sign two EIP-712
payloads (`SendAsset` + `SignedIntent`) and broadcast nothing; the keeper pays gas. Before the
wallet is asked for anything, the CLI derives your escrow on-chain and verifies every field it is
about to sign — any mismatch aborts with "nothing was signed".

## Non-HyperLiquid trade (EVM → EVM)

Any non-HyperLiquid `--to` goes through the gasless trade path. Pass tokens as `0x…` addresses
(only `USDC` resolves by symbol, on Arbitrum and Polygon):

```bash
npm run deposit -- --from Arbitrum USDC 5 --to Base 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
npm run deposit -- --from 137 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 10 --to 42161 0xaf88d065e77c8cc2239327c5edb3a432268e5831
```

## Tips

- Always try a command with `--dry-run --account 0xYourAddress` first — it builds, prices and
  (on withdraw) verifies everything but signs nothing and needs no key.
- Public source-chain RPCs ship built in. If one is rate-limited, override it with
  `HL_RPC_<chainId>=<url>` in `.env` (e.g. `HL_RPC_42161=...`).
