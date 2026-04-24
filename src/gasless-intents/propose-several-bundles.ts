import { privateKeyToAccount } from "viem/accounts";
import { getEnvConfig, clipHexPrefix } from "@utils/index";
import { createBundle } from "@utils/api";
import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { BundleProposeBody, Trade, TradingAlgorithm } from "./types";
import { CHAIN_IDS } from "@utils/chains";
import { EVM_NATIVE_TOKEN, USDC, USDT } from "@utils/constants";

function utcStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

async function main() {
  const { privateKey } = getEnvConfig();
  const account = privateKeyToAccount(`0x${clipHexPrefix(privateKey)}`);
  const requestId = randomUUID();

  const usdcPolyToUsdcBase: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: USDC.Polygon,
    srcChainTokenInAmount: "600000",
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };
  const usdcMaticToUsdcEth: Trade = {
    srcChainId: CHAIN_IDS.Polygon,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "1000000000000000000",
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };
  const arbitrumEthToBaseEth: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: EVM_NATIVE_TOKEN,
    srcChainTokenInAmount: "1000000000000000",
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: EVM_NATIVE_TOKEN,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };
  const arbitrumUsdtToBaseUsdc: Trade = {
    srcChainId: CHAIN_IDS.Arbitrum,
    srcChainTokenIn: USDT.Arbitrum,
    srcChainTokenInAmount: "1000000",
    srcChainAuthorityAddress: account.address,
    dstChainId: CHAIN_IDS.Base,
    dstChainTokenOut: USDC.Base,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: account.address,
    dstChainAuthorityAddress: account.address,
    prependOperatingExpenses: true,
  };

  const requestBody: BundleProposeBody = {
    requestId,
    referralCode: 110000002,
    expirationTimestamp: Math.floor((Date.now() * 2) / 1000),
    enableAccountAbstraction: true,
    isAtomic: true,
    tradingAlgorithm: TradingAlgorithm.MARKET,
    trades: [usdcPolyToUsdcBase, usdcMaticToUsdcEth, arbitrumEthToBaseEth, arbitrumUsdtToBaseUsdc],
    postHooks: [],
  };

  console.log("Proposing bundle (no submit, no funds spent)...");
  const bundle = await createBundle(requestBody);

  const outDir = join(__dirname, "queries", "payloads", "propose-probe");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `propose-${utcStamp()}.json`);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2));
  console.log(`Saved propose response to ${outPath}`);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR:", error);
  process.exitCode = 1;
});
