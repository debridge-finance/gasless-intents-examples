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

Five receiver contracts implement `IPreInteractionHook` and
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
| `ProtocolFeeRecorder` | Same-chain-with-preswap fee derivation. Cross-chain variants are accepted as no-op callbacks. |
| `RewardMinter` | Accrues per-subject reward points on every callback; demo non-transferrable counter. |
| `FillCapEnforcer` | Hard per-subject fill cap; pre-hook reverts `HardCapExceeded` past the cap. |

`ProtocolFeeRecorder` records fees only for same-chain-with-preswap fills.
Cross-chain post-interaction callbacks are no-ops because the callback data
does not expose the same fee derivation inputs.

## Deploy

Deploy all five contracts:

```bash
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts --dry-run
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts --only RewardMinter
npx tsx solidity/scripts/interactions/deploy/deploy-interaction-contracts.ts --skip FillCapEnforcer
```

Deploy one contract:

```bash
npx tsx solidity/scripts/utilities/build-artefacts.ts
npx tsx solidity/scripts/interactions/deploy/deploy-logging-interaction-hook.ts
npx tsx solidity/scripts/interactions/deploy/deploy-fill-counter.ts
npx tsx solidity/scripts/interactions/deploy/deploy-protocol-fee-recorder.ts
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
npx tsx solidity/scripts/interactions/verify/verify-reward-minter.ts             <0xAddress>
npx tsx solidity/scripts/interactions/verify/verify-fill-cap-enforcer.ts         <0xAddress>
```

Verification uses Standard JSON Input mode against the Etherscan v2 API. Set
`ETHERSCAN_API_KEY` before running verification.

## Deployed Addresses

| Contract | Chain | ChainId | Address | Verified |
| -------- | ----- | ------- | ------- | -------- |
| `LoggingInteractionHook` | Base mainnet | 8453 | [`0x17c94c6daecd6f5c99fc0284f1159dc4eb76f3ed`](https://basescan.org/address/0x17c94c6daecd6f5c99fc0284f1159dc4eb76f3ed#code) | yes |
| `FillCounter` | Base mainnet | 8453 | [`0x31c646be72f5df8e1d2188e375b3cd4b6a5097ab`](https://basescan.org/address/0x31c646be72f5df8e1d2188e375b3cd4b6a5097ab#code) | yes |
| `ProtocolFeeRecorder` | Base mainnet | 8453 | [`0x06849f0fad887e73c57e44ede0821fbbc63ee1f9`](https://basescan.org/address/0x06849f0fad887e73c57e44ede0821fbbc63ee1f9#code) | yes |
| `RewardMinter` | Base mainnet | 8453 | [`0xf359104c960ddecedd207b679450abdc9d7c6481`](https://basescan.org/address/0xf359104c960ddecedd207b679450abdc9d7c6481#code) | yes |
| `FillCapEnforcer` | Base mainnet | 8453 | [`0xbc4a0ed3b62dd5d9512f954f43fcf5c23811b15e`](https://basescan.org/address/0xbc4a0ed3b62dd5d9512f954f43fcf5c23811b15e#code) | yes |
