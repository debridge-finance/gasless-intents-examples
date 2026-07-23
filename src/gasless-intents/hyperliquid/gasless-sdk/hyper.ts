import BigNumber from 'bignumber.js';
import { Contract, JsonRpcProvider } from 'ethers';

import { ApiClient, AssetData, PolymorphicAsset } from './api';
import { HYPERLIQUID_CORE_CHAIN_ID } from './chains';

export function coreRawToEvmRaw(
  rawCore: bigint,
  coreDecimals: number,
  evmDecimals: number,
): bigint {
  const diff: number = evmDecimals - coreDecimals;
  if (diff >= 0) {
    return rawCore * 10n ** BigInt(diff);
  }
  return rawCore / 10n ** BigInt(-diff);
}

export function ceilEvmAmountToCore(
  rawEvm: bigint,
  evmDecimals: number,
  coreDecimals: number,
): bigint {
  const diff: number = coreDecimals - evmDecimals;
  if (diff >= 0) {
    return rawEvm;
  }
  const step: bigint = 10n ** BigInt(-diff);
  return ((rawEvm + step - 1n) / step) * step;
}

export interface CoreBalance {
  rawCore: bigint;
  coreDecimals: number;
  evmDecimals: number;
  usdPrice?: string;
  symbol: string;
}

export async function readCoreSpotBalance(
  api: ApiClient,
  symbol: string,
  holder: string,
): Promise<CoreBalance> {
  const assets: PolymorphicAsset[] = await api.getAssets(HYPERLIQUID_CORE_CHAIN_ID, holder);
  const match: PolymorphicAsset | undefined = assets.find(
    (asset: PolymorphicAsset): boolean => asset.data.symbol === symbol,
  );
  if (match === undefined) {
    throw new Error(`HyperCore asset "${symbol}" not found for holder ${holder}`);
  }

  const data: AssetData = match.data;
  if (data.balance === undefined) {
    throw new Error(`HyperCore asset "${symbol}" is missing a balance`);
  }
  if (data.decimals === undefined) {
    throw new Error(`HyperCore asset "${symbol}" is missing decimals`);
  }
  if (data.evmDecimals === undefined) {
    throw new Error(`HyperCore asset "${symbol}" is missing evmDecimals`);
  }
  const rawCore: bigint = BigInt(
    new BigNumber(data.balance)
      .shiftedBy(data.decimals)
      .integerValue(BigNumber.ROUND_DOWN)
      .toFixed(),
  );

  return {
    rawCore,
    coreDecimals: data.decimals,
    evmDecimals: data.evmDecimals,
    usdPrice: data.usdPrice,
    symbol,
  };
}

export function floorEvmAmountToCore(
  rawEvm: bigint,
  evmDecimals: number,
  coreDecimals: number,
): bigint {
  const diff: number = coreDecimals - evmDecimals;
  if (diff >= 0) {
    return rawEvm;
  }
  const step: bigint = 10n ** BigInt(-diff);
  return (rawEvm / step) * step;
}

const ESCROW_FACTORY_ABI: string[] = [
  'function computeEscrowAddress(address owner) view returns (address)',
];

export interface EscrowFactoryCaller {
  computeEscrowAddress(owner: string): Promise<string>;
}

export class HyperEvmClient {
  private readonly rpcUrl: string;
  private readonly factoryAddress: string;
  private readonly caller: EscrowFactoryCaller;

  constructor(rpcUrl: string, factoryAddress: string, caller?: EscrowFactoryCaller) {
    this.rpcUrl = rpcUrl;
    this.factoryAddress = factoryAddress;
    this.caller = caller ?? {
      computeEscrowAddress: async (owner: string): Promise<string> => {
        const provider: JsonRpcProvider = new JsonRpcProvider(rpcUrl);
        const factory: Contract = new Contract(factoryAddress, ESCROW_FACTORY_ABI, provider);
        const predicted: string = await factory.computeEscrowAddress(owner);
        return predicted;
      },
    };
  }

  async deriveEscrowAddress(owner: string): Promise<string> {
    try {
      return await this.caller.computeEscrowAddress(owner);
    } catch (error: unknown) {
      const message: string = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not derive the escrow address for ${owner} from EscrowManagerFactory ` +
          `${this.factoryAddress} on ${this.rpcUrl}: ${message}. Without it the SendAsset ` +
          `destination cannot be verified, so nothing will be signed — check HL_HYPEREVM_RPC_URL ` +
          `and HL_ESCROW_FACTORY (it must match the estimator's HYPEREVM_ESCROW_MGR_FACTORY).`,
      );
    }
  }
}
