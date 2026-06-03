# `solidity/scripts/`

Scripts for building, deploying, and verifying the interaction-hook example
contracts under `solidity/contracts/interactions/`. Run commands from the repo
root with `npx tsx`.

## Layout

```
solidity/scripts/
  lib/           shared libs (Etherscan verify, deploy helper, ledger I/O)
  utilities/     one-off tooling (forge build artefacts)
  interactions/
    deploy/      IPre/PostInteractionHook deploy scripts
    verify/      IPre/PostInteractionHook verify scripts
```

The deployed-address ledger lives at
`solidity/build-artefacts/deployed-base.json` and is written by every successful
`deploy-*.ts` via `lib/ledger.ts`.

## `build-artefacts.ts`

Compiles the interaction contracts with Foundry (matching
`solidity/foundry.toml`: solc `0.8.24`, optimizer `200`, evmVersion `cancun`,
bytecodeHash `ipfs`) and writes artefacts into `solidity/build-artefacts/`.

Requires `forge` on `PATH`, or set `FORGE_BIN` to its absolute path.

```bash
npx tsx solidity/scripts/utilities/build-artefacts.ts
```

For each interaction contract it writes:

- `<Contract>.json` - `{ abi, data: { bytecode: { object } } }`
- `<Contract>_metadata.json` - standard solc metadata for verification

## Interaction Hooks

Six receiver contracts implement `IPreInteractionHook` and
`IPostInteractionHook`. These are the targets the deBridge Intent Manager calls
around each fill via `preInteractions` and `postInteractions`.

All callback entrypoints are gated with the hardcoded deBridge IntentManager
address:

`0xDDDDDDDdeB2E68Ee19832e356FCB5537124A9708`

See the supported chains docs for the address source of truth:
https://gasless-docs.debridge.finance/overview/supported-chains

| Contract | Purpose |
| -------- | ------- |
| `LoggingInteractionHook` | Indexed events at every callback; soft rate-limit via `referenceId > 0` on the payload. |
| `FillCounter` | Per-intent / per-subject / per-token fill counters readable on-chain. |
| `ProtocolFeeRecorder` | Same-chain-with-preswap fee derivation. Cross-chain variants intentionally revert with `Unsupported`. |
| `AllowlistGuard` | EIP-712 gated allowlist. Pre-hook requires an allowlisted signer, signed `intentId`, unused nonce, and a submitted intent in the IntentManager. |
| `RewardMinter` | Accrues per-subject reward points on every callback; demo non-transferrable counter. |
| `FillCapEnforcer` | Hard per-subject fill cap; pre-hook reverts `HardCapExceeded` past the cap. |

`ProtocolFeeRecorder` is same-chain-with-preswap only. Do not attach it to
cross-chain post-interactions unless the intended behavior is to revert the
fill.

## Deploy

Deploy all six contracts:

```bash
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts --dry-run
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts --only RewardMinter
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts --skip AllowlistGuard
```

Deploy one contract:

```bash
npx tsx solidity/scripts/utilities/build-artefacts.ts
npx tsx solidity/scripts/interactions/deploy/deploy-logging-interaction-hook.ts
npx tsx solidity/scripts/interactions/deploy/deploy-fill-counter.ts
npx tsx solidity/scripts/interactions/deploy/deploy-protocol-fee-recorder.ts
npx tsx solidity/scripts/interactions/deploy/deploy-allowlist-guard.ts
npx tsx solidity/scripts/interactions/deploy/deploy-reward-minter.ts
npx tsx solidity/scripts/interactions/deploy/deploy-fill-cap-enforcer.ts
```

Each deploy script records its contract address, deploy tx hash, and block number
in `solidity/build-artefacts/deployed-base.json`. Since callbacks are
IntentManager-only, deploy scripts only perform read-only sanity checks after
deployment; callback behavior is covered by Foundry tests.

Required env vars:

| Var | Purpose |
| --- | ------- |
| `SIGNER_PK` | Deployer private key (with or without `0x` prefix). Needs ETH on Base. |
| `BASE_RPC_URL` | Base mainnet RPC endpoint. Optional; falls back to `https://mainnet.base.org`. |

## Verify

```bash
npx tsx solidity/scripts/interactions/verify/verify-interaction-contracts.ts
npx tsx solidity/scripts/interactions/verify/verify-logging-interaction-hook.ts  <0xAddress>
npx tsx solidity/scripts/interactions/verify/verify-fill-counter.ts              <0xAddress>
npx tsx solidity/scripts/interactions/verify/verify-protocol-fee-recorder.ts     <0xAddress>
npx tsx solidity/scripts/interactions/verify/verify-allowlist-guard.ts           <0xAddress>
npx tsx solidity/scripts/interactions/verify/verify-reward-minter.ts             <0xAddress>
npx tsx solidity/scripts/interactions/verify/verify-fill-cap-enforcer.ts         <0xAddress>
```

Verification uses Standard JSON Input mode against the Etherscan v2 API. Set
`ETHERSCAN_API_KEY` before running verification.

## Deployed Addresses

| Contract | Chain | ChainId | Address | Verified |
| -------- | ----- | ------- | ------- | -------- |
| `LoggingInteractionHook` | Base mainnet | 8453 | [`0x20df8adc7b093594720334c69aa16a9d8d69580a`](https://basescan.org/address/0x20df8adc7b093594720334c69aa16a9d8d69580a#code) | yes |
| `FillCounter` | Base mainnet | 8453 | [`0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277`](https://basescan.org/address/0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277#code) | yes |
| `ProtocolFeeRecorder` | Base mainnet | 8453 | [`0xe04944aefa4d15aa0d322531b19cc8f06000c9c8`](https://basescan.org/address/0xe04944aefa4d15aa0d322531b19cc8f06000c9c8#code) | yes |
| `AllowlistGuard` | Base mainnet | 8453 | [`0x8909accb3b437a00dcb268d34a07473a60269e1b`](https://basescan.org/address/0x8909accb3b437a00dcb268d34a07473a60269e1b#code) | yes |
| `RewardMinter` | Base mainnet | 8453 | [`0xf1360c7d00b6cffa862f6645dba05babc47a097b`](https://basescan.org/address/0xf1360c7d00b6cffa862f6645dba05babc47a097b#code) | yes |
| `FillCapEnforcer` | Base mainnet | 8453 | [`0x3454ace276329902caeab59135439fb05cc644e5`](https://basescan.org/address/0x3454ace276329902caeab59135439fb05cc644e5#code) | yes |
