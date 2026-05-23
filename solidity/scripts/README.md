# `solidity/scripts/`

One-shot scripts for deploying / interacting with the contracts under `solidity/contracts/`. Run from the repo root with `npx tsx`.

## Layout

```
solidity/scripts/
  lib/         — shared libs (Etherscan verify, deploy helper, ledger I/O)
  utilities/   — one-off tooling (forge build artefacts, sync TS hook-addresses)
  direct-hooks/    — Echo / EchoWithSig deploy / verify / Anvil test
  interactions/    — IPre/PostInteractionHook deploy + verify, plus orchestrators
```

The deployed-address ledger lives at `solidity/build-artefacts/deployed-base.json` and is written by every successful `deploy-*.ts` via `lib/ledger.ts`.

## `deploy-echo.ts`

Deploys the already-compiled `Echo` contract (`solidity/contracts/direct-hooks/Echo.sol`) to **Base mainnet** using viem, then sends a single sanity-check `echo()` transaction so you can verify on Basescan that the contract is live and emits its `Echoed(address indexed sender, string message)` event.

`Echo` is intentionally trivial: a target you can point solver-hook examples at and inspect the indexed `sender` to confirm which address actually executed the call on-chain.

### Required env vars

Both are loaded from the project's `.env` (same file other examples use).

| Var            | Purpose                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `SIGNER_PK`    | Deployer private key (with or without `0x` prefix). Needs ETH on Base — bridge ~$1 worth from any L1/L2 if the wallet is dry. |
| `BASE_RPC_URL` | Base mainnet RPC endpoint (Alchemy, Infura, QuickNode, etc.). Optional; falls back to `https://mainnet.base.org` if unset. |

The script aborts before broadcasting if the deployer balance is below `0.0005 ETH`.

### Run

```bash
npx tsx solidity/scripts/direct-hooks/deploy-echo.ts
```

### Expected output

```
Deployer: 0xabc...
Balance: 0.012 ETH on Base
Deploying Echo...
  Tx: 0xdef... (https://basescan.org/tx/0xdef...)
  Confirmed in block 12345678
  Gas used: 69432 @ 50000000 wei
  Contract: 0x123... (https://basescan.org/address/0x123...)
Sending sanity-check echo()...
  Tx: 0x456... (https://basescan.org/tx/0x456...)
  Confirmed
Done.
```

Exit code is `0` on success; any failure prints a one-line error to stderr and exits non-zero.

### Next steps

- Note the contract address from the `Contract:` line — drop it into solver-hook integration scripts as the call target.
- Open the contract on Basescan and check the **Events** tab; the sanity-check tx should be there with `sender` = deployer address and the message string.
- **Verify the source** on Basescan if you want a green checkmark. Use **Solidity (Standard JSON Input)** mode and feed it `solidity/build-artefacts/Echo_metadata.json`. Settings recorded in the metadata: compiler `0.8.24`, optimizer enabled at `200` runs, evmVersion `cancun`. (This script does not automate verification.)

## `build-artefacts.ts`

Compiles `solidity/contracts/direct-hooks/EchoWithSig.sol` with Foundry (matching the compiler settings in `solidity/foundry.toml`: solc `0.8.24`, optimizer `200`, evmVersion `cancun`, bytecodeHash `ipfs`) and writes two artefact files into `solidity/build-artefacts/`:

- `EchoWithSig.json` — `{ abi, data: { bytecode: { object } } }` (the shape `deploy-echo-with-sig.ts` reads).
- `EchoWithSig_metadata.json` — standard solc metadata (the shape `verify-echo-with-sig.ts` reads).

Requires `forge` on `PATH`, or set `FORGE_BIN` to its absolute path.

```bash
npx tsx solidity/scripts/utilities/build-artefacts.ts
```

## `test-echo-with-sig.ts`

Spawns a local Anvil node, deploys `EchoWithSig` to it, and runs the full local test suite — happy path, four revert cases (`Echo: expired`, `Echo: nonce used`, `Echo: bad sig length`, `Echo: bad sig`), an off-chain `DOMAIN_SEPARATOR()` round-trip, and a placeholder-substitution sanity check that mirrors the deBridge `{signature.65}` deferred-substitution recipe from `verified-examples/anton-spender-bundle.mjs`.

Anvil is killed on exit (including `SIGINT`/`SIGTERM`). Exit code is `0` if all cases pass, non-zero otherwise. Costs nothing — no real-network ETH is touched.

### Required env vars

None. Optional overrides:

| Var          | Purpose                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `ANVIL_BIN`  | Path to the `anvil` binary. Defaults to `/Users/damir/.foundry/bin/anvil`. |
| `ANVIL_PORT` | TCP port to bind anvil to. Defaults to `18545` to avoid colliding with a default `8545` anvil. |

### Run

```bash
npx tsx solidity/scripts/direct-hooks/test-echo-with-sig.ts
```

### Expected output

```
Starting anvil on port 18545...
anvil ready
chainId: 31337 (anvil)
user:    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
solver:  0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Deploying EchoWithSig...
EchoWithSig: 0x...

Tests:
  PASS  DOMAIN_SEPARATOR matches off-chain re-derivation
  PASS  happy path (user signs, solver sends) emits MessageEchoed + flips usedNonces
  PASS  rejects expired deadline
  PASS  rejects replayed nonce
  PASS  rejects 64-byte signature
  PASS  rejects mismatched user (signed by A, claims to be B)
  PASS  placeholder substitution recipe matches direct encoding + works on-chain

────── 7 passed, 0 failed ──────
```

## `deploy-echo-with-sig.ts`

Deploys `EchoWithSig` to **Base mainnet**, then signs an `EchoMessage` with the deployer key and submits one `echoWithSig()` call as a sanity check (asserts the `MessageEchoed` event with the signed payload appears in the receipt). Same env-var contract as `deploy-echo.ts`.

### Required env vars

| Var            | Purpose                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `SIGNER_PK`    | Deployer private key (with or without `0x` prefix). Needs ETH on Base — bridge ~$1 worth from any L1/L2 if dry. |
| `BASE_RPC_URL` | Base mainnet RPC endpoint. Optional; falls back to `https://mainnet.base.org`. |

The script aborts before broadcasting if the deployer balance is below `0.0005 ETH`. The sanity-check call uses an explicit `gas: 120_000n` because the public Base RPC's `eth_estimateGas` can return a stale value immediately after a fresh deploy (load-balanced node fleet).

### Run

```bash
npx tsx solidity/scripts/direct-hooks/deploy-echo-with-sig.ts
```

### Expected output

```
Deployer: 0x...
Balance: 0.012 ETH on Base
Deploying EchoWithSig...
  Tx: 0x... (https://basescan.org/tx/0x...)
  Confirmed in block ...
  Gas used: ... @ ... wei
  Contract: 0x... (https://basescan.org/address/0x...)
Sending sanity-check echoWithSig() — deployer signs and sends...
  Tx: 0x... (https://basescan.org/tx/0x...)
  Confirmed: MessageEchoed event matches signed payload
Done.
```

### Next steps

- Record the deployed address in the **Deployed Addresses** table below.
- Run `verify-echo-with-sig.ts` against the address to publish source on Basescan.
- Point solver-hook examples (e.g. an upcoming `recreate-echo-direct-deferred.ts`) at this address using `{signature.65}` deferred placeholders.

## `verify-echo-with-sig.ts`

Submits Solidity source for `EchoWithSig` to the **Etherscan v2** unified API (chainid `8453`, MIT license) using **Standard JSON Input** mode. Polls for the result and prints the Basescan `#code` URL on success. Already-verified addresses exit cleanly without error.

### Required env vars

| Var                  | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `ETHERSCAN_API_KEY`  | Etherscan v2 API key (a single key works across all v2-supported chains, including Base). |

### Run

```bash
npx tsx solidity/scripts/direct-hooks/verify-echo-with-sig.ts <0xContractAddress>
```

### Expected output

```
Verifying 0x... as contracts/direct-hooks/EchoWithSig.sol:EchoWithSig
Compiler: v0.8.24+commit.e11b9ed9
Submitting to Etherscan v2 API (chainid=8453)...
  GUID: ...
Polling for result...
  pending...
  Pass - Verified
Done: https://basescan.org/address/0x...#code
```

## Interaction Hooks

Six receiver contracts that implement `IPreInteractionHook` and `IPostInteractionHook` — the targets the deBridge Intent Manager calls around each fill via `preInteractions` / `postInteractions`. Source under [`../contracts/interactions/`](../contracts/interactions/). Use cases mapped in [`src/gasless-intents/interactions/USE-CASES.md`](../../src/gasless-intents/interactions/USE-CASES.md).

| Contract                | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `LoggingInteractionHook`| Indexed events at every callback; soft rate-limit via `referenceId > 0` on the payload. |
| `FillCounter`           | Per-intent / per-subject / per-token fill counters readable on-chain.                    |
| `ProtocolFeeRecorder`   | Same-chain-with-preswap fee derivation; cross-chain variants revert with `Unsupported`. |
| `AllowlistGuard`        | EIP-712 gated. Pre-hook reverts unless an `AllowlistAuthorization` signature recovers to an allowlisted `subject` (with nonce + deadline replay protection). |
| `RewardMinter`          | Accrues per-subject reward points on every callback; demo non-transferrable counter.     |
| `FillCapEnforcer`       | Hard per-subject fill cap; pre-hook reverts `HardCapExceeded` past the cap.              |

### Deploy (all six at once)

```bash
npx tsx solidity/scripts/interactions/deploy-interaction-contracts.ts            # full run
npx tsx solidity/scripts/interactions/deploy-interaction-contracts.ts --dry-run  # plan only
npx tsx solidity/scripts/interactions/deploy-interaction-contracts.ts --only RewardMinter
npx tsx solidity/scripts/interactions/deploy-interaction-contracts.ts --skip AllowlistGuard
```

The orchestrator runs `utilities/build-artefacts.ts` first, then spawns each `interactions/deploy-*.ts` in turn. Each child script ends with a contract-specific sanity call you can see on Basescan, and writes its entry into `solidity/build-artefacts/deployed-base.json`.

### Deploy (one contract at a time)

```bash
npx tsx solidity/scripts/utilities/build-artefacts.ts                       # rebuild artifacts (run once)
npx tsx solidity/scripts/interactions/deploy-logging-interaction-hook.ts
npx tsx solidity/scripts/interactions/deploy-fill-counter.ts
npx tsx solidity/scripts/interactions/deploy-protocol-fee-recorder.ts
npx tsx solidity/scripts/interactions/deploy-allowlist-guard.ts
npx tsx solidity/scripts/interactions/deploy-reward-minter.ts
npx tsx solidity/scripts/interactions/deploy-fill-cap-enforcer.ts
```

The `AllowlistGuard` script runs a three-step sanity (revert with a valid EIP-712 sig against an empty allowlist, setAllowed, then succeed with a fresh-nonce signed payload); `FillCapEnforcer` runs an analogous three-step (no-cap, setCap, succeed under cap).

### Verify

```bash
npx tsx solidity/scripts/interactions/verify-interaction-contracts.ts        # all in the ledger
# — or one at a time —
npx tsx solidity/scripts/interactions/verify-logging-interaction-hook.ts  <0xAddress>
npx tsx solidity/scripts/interactions/verify-fill-counter.ts              <0xAddress>
npx tsx solidity/scripts/interactions/verify-protocol-fee-recorder.ts     <0xAddress>
npx tsx solidity/scripts/interactions/verify-allowlist-guard.ts           <0xAddress>
npx tsx solidity/scripts/interactions/verify-reward-minter.ts             <0xAddress>
npx tsx solidity/scripts/interactions/verify-fill-cap-enforcer.ts         <0xAddress>
```

Standard JSON Input mode against the Etherscan v2 API. Source files referenced by metadata (including the interfaces) are bundled automatically.

### After deploy

```bash
npx tsx solidity/scripts/utilities/sync-hook-addresses.ts
```

Regenerates [`src/gasless-intents/interactions/helpers/hook-addresses.ts`](../../src/gasless-intents/interactions/helpers/hook-addresses.ts) from `deployed-base.json`. Review the diff before committing.

## Deployed Addresses

| Contract                | Chain         | ChainId | Address                                                                                                            | Verified |
| ----------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| `Echo`                  | Base mainnet  | 8453    | [`0xa77563ce5dfb7fe631d4b9fba8968efbb1f722c8`](https://basescan.org/address/0xa77563ce5dfb7fe631d4b9fba8968efbb1f722c8) | yes      |
| `EchoWithSig`           | Base mainnet  | 8453    | [`0x30f1acea1948fa286f6ebd948d79fadeb2ae1ca9`](https://basescan.org/address/0x30f1acea1948fa286f6ebd948d79fadeb2ae1ca9#code) | yes      |
| `LoggingInteractionHook`| Base mainnet  | 8453    | [`0x20df8adc7b093594720334c69aa16a9d8d69580a`](https://basescan.org/address/0x20df8adc7b093594720334c69aa16a9d8d69580a#code) | yes      |
| `FillCounter`           | Base mainnet  | 8453    | [`0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277`](https://basescan.org/address/0x0f3fed84e654fb3b1e2ae3af80e2dc786c9b7277#code) | yes      |
| `ProtocolFeeRecorder`   | Base mainnet  | 8453    | [`0xe04944aefa4d15aa0d322531b19cc8f06000c9c8`](https://basescan.org/address/0xe04944aefa4d15aa0d322531b19cc8f06000c9c8#code) | yes      |
| `AllowlistGuard`        | Base mainnet  | 8453    | [`0x8909accb3b437a00dcb268d34a07473a60269e1b`](https://basescan.org/address/0x8909accb3b437a00dcb268d34a07473a60269e1b#code) | yes      |
| `RewardMinter`          | Base mainnet  | 8453    | [`0xf1360c7d00b6cffa862f6645dba05babc47a097b`](https://basescan.org/address/0xf1360c7d00b6cffa862f6645dba05babc47a097b#code) | yes      |
| `FillCapEnforcer`       | Base mainnet  | 8453    | [`0x3454ace276329902caeab59135439fb05cc644e5`](https://basescan.org/address/0x3454ace276329902caeab59135439fb05cc644e5#code) | yes      |
