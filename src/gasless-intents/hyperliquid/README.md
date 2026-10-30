# Hyperliquid examples

Small, single-purpose examples for the production Solana/EVM ↔ HyperCore API. They follow the
same create → sign → submit pattern as the surrounding repository and reuse its shared types,
wallets, HTTP client, and signature processor.

## Configuration

Every script reads the Hyperliquid API host from `HYPERLIQUID_API_BASE_URL` in `.env`, alongside
`SIGNER_PK` and `DE_BRIDGE_PARTNER_API_KEY`. Hosts are issued per partner, so the repository ships
none.

## Propose only

Creates and prints an Arbitrum USDC → HyperCore USDC bundle for the `SIGNER_PK` account. Nothing is
signed or submitted; the key is only used to derive the address so the quote reflects your own
account, such as whether HyperCore charges its activation fee.

```bash
npx tsx src/gasless-intents/hyperliquid/basic-flow/propose-only/arbitrum-usdc-to-hypercore-usdc.ts
```

## Deposit from an EVM chain

Creates an Arbitrum USDC → HyperCore USDC bundle, signs the returned actions, and submits it. Set
`SIGNER_PK` to the account that owns the source USDC.

```bash
npx tsx src/gasless-intents/hyperliquid/basic-flow/submit/arbitrum-usdc-to-hypercore-usdc.ts
```

## Deposit from an EVM chain into HYPE

Creates an Arbitrum USDC → HyperCore HYPE bundle, signs the returned actions, and submits it. Set
`SIGNER_PK` to the account that owns the source USDC.

```bash
npx tsx src/gasless-intents/hyperliquid/basic-flow/submit/arbitrum-usdc-to-hypercore-hype.ts
```

## Deposit from Solana

Creates a Solana USDC → HyperCore USDC bundle. `SOL_PK` owns the source USDC; `SIGNER_PK` determines
the EVM-style account that receives it on HyperCore.

```bash
npx tsx src/gasless-intents/hyperliquid/basic-flow/submit/solana-usdc-to-hypercore-usdc.ts
```

## Withdraw from HyperCore

Creates a HyperCore USDC → Arbitrum USDC bundle, signs both returned EIP-712 actions, and submits it.
`SIGNER_PK` must hold USDC on HyperCore.

```bash
npx tsx src/gasless-intents/hyperliquid/basic-flow/submit/hypercore-usdc-to-arbitrum-usdc.ts
```

## Withdraw HYPE from HyperCore

Creates a HyperCore HYPE → Base USDC bundle, signs both returned EIP-712 actions, and submits it.
`SIGNER_PK` must hold HYPE on HyperCore.

```bash
npx tsx src/gasless-intents/hyperliquid/basic-flow/submit/hypercore-hype-to-base-usdc.ts
```

## Direct transfer: HyperEVM to HyperCore

Moves USDC from the `SIGNER_PK` wallet on HyperEVM into the same address's HyperCore spot balance.
The API returns the transactions the wallet broadcasts itself; the script sends them in order, waits
for each receipt, and then calls submit. The wallet needs the USDC and a little HYPE for gas on
HyperEVM.

```bash
npx tsx src/gasless-intents/hyperliquid/direct-transfers/hyperevm-usdc-to-hypercore-usdc.ts
```

## Direct transfer: HyperCore to HyperEVM

Moves USDC from the `SIGNER_PK` HyperCore spot balance to the same address on HyperEVM with one
signed `SendAsset` that the API relays. The account must hold some HYPE on HyperCore to pay the
transfer fee.

```bash
npx tsx src/gasless-intents/hyperliquid/direct-transfers/hypercore-usdc-to-hyperevm-usdc.ts
```

All amounts and routes are intentionally fixed in source so each script can be understood from top
to bottom. Copy an example and change its `Trade` object when documenting another route.
