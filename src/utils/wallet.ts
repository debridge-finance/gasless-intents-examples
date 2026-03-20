import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, bsc, base, arbitrum, optimism, mainnet } from "viem/chains";
import { CHAIN_IDS } from "./chains";
import { Keypair } from "@solana/web3.js";


export function getWalletClients(account: ReturnType<typeof privateKeyToAccount>) {
  const walletClientPolygon = createWalletClient({
    account,
    chain: polygon,
    transport: http()
  });

  const walletClientBsc = createWalletClient({
    account,
    chain: bsc,
    transport: http()
  });

  const walletClientBase = createWalletClient({
    account,
    chain: base,
    transport: http()
  });

  const walletClientArbitrum = createWalletClient({
    account,
    chain: arbitrum,
    transport: http()
  });

  const walletClientOptimism = createWalletClient({
    account,
    chain: optimism,
    transport: http()
  });

  const walletClientMainnet = createWalletClient({
    account,
    chain: mainnet,
    transport: http()
  });

  return {
    walletClientPolygon,
    walletClientBsc,
    walletClientBase,
    walletClientOptimism,
    walletClientArbitrum,
    walletClientMainnet
  };
}

export function getChainIdToWalletClientMap(account: ReturnType<typeof privateKeyToAccount>, solanaAccount?: Keypair) {
  const {
    walletClientPolygon,
    walletClientBsc,
    walletClientBase,
    walletClientOptimism,
    walletClientArbitrum,
    walletClientMainnet
  } = getWalletClients(account);

  return {
    [polygon.id]: walletClientPolygon,
    [bsc.id]: walletClientBsc,
    [base.id]: walletClientBase,
    [optimism.id]: walletClientOptimism,
    [arbitrum.id]: walletClientArbitrum,
    [mainnet.id]: walletClientMainnet,
    [CHAIN_IDS.Solana]: solanaAccount,
  };
}