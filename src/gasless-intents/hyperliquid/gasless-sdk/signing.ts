import { getAddress, TypedDataEncoder, Wallet } from 'ethers';

import { SourceRpc } from './chains';
import {
  Eip712TypeField,
  Eip712TypedData,
  EnsureErc20AllowanceData,
  EvmTransactionData,
  IntentResponse,
  RequiredAction,
  RequiredActionData,
  SignedDataItem,
} from './api';

export function isEip712TypedData(data: RequiredActionData): data is Eip712TypedData {
  return 'domain' in data && 'types' in data && 'message' in data;
}

function isBudgetOnlyAction(action: RequiredAction): boolean {
  return action.actions.length === 1 && action.actions[0].toLowerCase() === 'budget';
}

export function stripEip712Domain(
  types: Record<string, Eip712TypeField[]>,
): Record<string, Eip712TypeField[]> {
  const stripped: Record<string, Eip712TypeField[]> = {};
  for (const key of Object.keys(types)) {
    if (key !== 'EIP712Domain') {
      stripped[key] = types[key];
    }
  }
  return stripped;
}

export async function signRequiredActions(
  wallet: Wallet,
  actions: RequiredAction[],
): Promise<SignedDataItem[]> {
  const signed: SignedDataItem[] = [];
  for (const action of actions) {
    if (action.type === 'Sign712') {
      if (!isEip712TypedData(action.data)) {
        throw new Error(
          `Sign712 action ${action.actionId} carries a non-EIP-712 data payload; cannot sign.`,
        );
      }
      const types: Record<string, Eip712TypeField[]> = stripEip712Domain(action.data.types);
      const inferredPrimaryType: string = TypedDataEncoder.from(types).primaryType;
      if (inferredPrimaryType !== action.data.primaryType) {
        throw new Error(
          `Sign712 action ${action.actionId} primaryType mismatch: payload declares ` +
            `'${action.data.primaryType}' but ethers infers '${inferredPrimaryType}' from the types. ` +
            `Refusing to sign a possibly-wrong struct hash.`,
        );
      }
      const signature: string = await wallet.signTypedData(
        action.data.domain,
        types,
        action.data.message,
      );
      signed.push({ actionId: action.actionId, signedData: signature });
      continue;
    }

    if (action.type === 'Permit' || action.type === 'Permit2612' || action.type === 'Permit2') {
      if (!isEip712TypedData(action.data)) {
        throw new Error(
          `${action.type} action ${action.actionId} carries a non-EIP-712 data payload; cannot sign.`,
        );
      }
      const types: Record<string, Eip712TypeField[]> = stripEip712Domain(action.data.types);
      const signature: string = await wallet.signTypedData(
        action.data.domain,
        types,
        action.data.message,
      );
      signed.push({ actionId: action.actionId, signedData: signature });
      continue;
    }

    if (action.type === 'EnsureErc20Allowance' || isBudgetOnlyAction(action)) {
      continue;
    }

    throw new Error(
      `Unsupported required action type '${action.type}' (actions=[${action.actions.join(', ')}]) ` +
        `for action ${action.actionId}. This gasless route is sign-only and must not broadcast ` +
        `or sign it. If the route now returns an on-chain Transaction, the ` +
        `sign-only assumption must be revisited before proceeding.`,
    );
  }
  return signed;
}

export interface AllowanceRequirement {
  spender: string;
  token: string;
  amount: bigint;
}

export interface AllowanceCheck {
  required: bigint;
  current: bigint;
  sufficient: boolean;
}

const APPROVE_SELECTOR: string = '0x095ea7b3';

function isEnsureErc20AllowanceData(data: RequiredActionData): data is EnsureErc20AllowanceData {
  return 'allowanceHolder' in data && 'token' in data && 'minAmount' in data;
}

function isEvmTransactionData(data: RequiredActionData): data is EvmTransactionData {
  return 'to' in data && 'data' in data;
}

function decodeApprove(calldata: string): { spender: string; amount: bigint } | null {
  const hex: string = calldata.toLowerCase();
  if (!hex.startsWith(APPROVE_SELECTOR) || hex.length < 138) {
    return null;
  }
  const spenderHex: string = hex.slice(10 + 24, 10 + 64);
  const amountHex: string = hex.slice(10 + 64, 10 + 128);
  return { spender: getAddress(`0x${spenderHex}`), amount: BigInt(`0x${amountHex}`) };
}

export function extractAllowanceRequirement(bundle: {
  intents: IntentResponse[];
}): AllowanceRequirement | null {
  for (const intent of bundle.intents) {
    for (const action of intent.requiredActions) {
      if (action.type === 'EnsureErc20Allowance' && isEnsureErc20AllowanceData(action.data)) {
        return {
          spender: action.data.allowanceHolder,
          token: action.data.token,
          amount: BigInt(action.data.minAmount),
        };
      }
      if (action.actions.includes('Budget') && isEvmTransactionData(action.data)) {
        const decoded: { spender: string; amount: bigint } | null = decodeApprove(action.data.data);
        if (decoded !== null) {
          return { spender: decoded.spender, token: action.data.to, amount: decoded.amount };
        }
      }
    }
  }
  return null;
}

export function hasPermitAction(bundle: { intents: IntentResponse[] }): boolean {
  for (const intent of bundle.intents) {
    for (const action of intent.requiredActions) {
      const type = action.type?.toLowerCase() ?? '';
      if (type === 'permit' || type === 'permit2612' || type === 'permit2') {
        return true;
      }
    }
  }
  return false;
}

export async function checkAllowance(
  rpc: SourceRpc,
  owner: string,
  req: AllowanceRequirement,
): Promise<AllowanceCheck> {
  const current: bigint = await rpc.allowance(req.token, owner, req.spender);
  return {
    required: req.amount,
    current,
    sufficient: current >= req.amount,
  };
}
