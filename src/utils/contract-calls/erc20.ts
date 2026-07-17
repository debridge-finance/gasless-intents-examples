import { type Hex, type PublicClient } from "viem";
import { Erc20Abi } from "@utils/contract-calls/abis";

/** Read `holder`'s ERC-20 balance of `token`. */
export function erc20Balance(publicClient: PublicClient, token: Hex, holder: Hex): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: Erc20Abi.Balance,
    functionName: "balanceOf",
    args: [holder],
  } as any) as Promise<bigint>;
}
