import { serializeSignature, SerializeSignatureParameters, SignTypedDataReturnType, WalletClient } from 'viem';

export enum SignatureTypes {
  Sign712 = "Sign712",
  Sign712MetaMask = "Sign712MetaMask",
  Sign7702Authorization = "Sign7702Authorization"
}

// Type for EIP-712 data
export type EIP712Data = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    EIP712Domain?: Array<{ name: string; type: string }>;
    [key: string]: Array<{ name: string; type: string }> | undefined;
  };
  primaryType: string;
  message: any;
}

// Type for Sign712MetaMask specific data
export type Sign712MetaMaskData = {
  toSign: EIP712Data;
  calls?: Array<{
    to: string;
    data: string;
    value: string;
  }>;
}

// Type for Sign7702Authorization specific data
export type Sign7702AuthorizationData = {
  contractAddress: string;
  nonce: number;
  chainId?: number;
}

// Combined action data type using discriminated union
export type ActionData =
  | (EIP712Data & { toSign?: never; calls?: never; contractAddress?: never; nonce?: never })
  | (Sign712MetaMaskData & { contractAddress?: never; nonce?: never })
  | (Sign7702AuthorizationData & { domain?: never; types?: never; message?: never; toSign?: never });

export type Action = {
  type: SignatureTypes;
  actionId: string;
  actions: Array<string>;
  data: ActionData;
}

export type Receiver = {
  address: string;
  destinationChainIds: number[];
}

export type InputToken = {
  address: string;
  minPartialAmount: string;
  maxPartialAmount: string;
  constrainBudget: string;
}

export type TakeToken = {
  fromTokenChainId: number;
  fromTokenAddress: string;
  takeTokenAddress: string;
  takeTokenChainId: number;
  price: string;
}

export type Intent = {
  intentId: string;
  intentChainId: number;
  intentAuthority: string;
  intentOwner: string;
  expirationTimestamp: number;
  intentTimestamp: number;
  intentType: string;
  srcAllowedSender: string[];
  inputTokens: InputToken[];
  takeTokens: TakeToken[];
  receiverDetails: Receiver[];
  dstAuthorityAddress: Receiver[];
}

export type IntentPayload = {
  intent: Intent;
  requiredActions: Array<Action>;
}

/**
 * Signs an action with ethers.js wallet
 * Handles different signature types: Sign712, Sign712MetaMask, and Sign7702Authorization
 */
export async function signAction(action: Action, walletClient: WalletClient): Promise<string> {
  console.log(`Signing action: ${action.actionId} of type ${action.type}`);

  // EIP-7702 Authorization
  if (action.type === SignatureTypes.Sign7702Authorization) {
    // Cast to Sign7702AuthorizationData to access specific properties
    const data = action.data as Sign7702AuthorizationData;
    const { contractAddress, nonce } = data;

    // For Sign7702Authorization, we need to determine the chainId
    // If not present in data, we can get it from the wallet client
    const chainId = data.chainId || walletClient.chain.id;

    const authData = {
      chainId,
      contractAddress,
      nonce
    }

    return await sign7702Authorization(walletClient, authData);
  }

  // EIP-712 Typed Data - Sign712MetaMask
  else if (action.type === SignatureTypes.Sign712MetaMask) {
    const data = action.data as Sign712MetaMaskData;
    const { domain, types, primaryType, message } = data.toSign;

    return sign712(walletClient, { domain, types, primaryType, message });
  }

  // EIP-712 Typed Data - Sign712
  else if (action.type === SignatureTypes.Sign712) {
    const data = action.data as EIP712Data;
    const { domain, types, message } = data;

    // In ethers v6, signTypedData is the method for EIP-712 signatures
    return sign712(walletClient, { domain, types, primaryType: data.primaryType, message });
  }
  else {
    throw new Error("Unknown signing method");
  }
}

/**
 * Collects signatures for all actions in an intent
 * Returns array of { actionId, signedData } objects
 */
export async function collectIntentSignatures(
  requiredActions: Array<Action>,
  walletClient: WalletClient
): Promise<Array<{ actionId: string, signedData: string }>> {
  const signatures: Array<{ actionId: string, signedData: string }> = [];

  if (!requiredActions || requiredActions.length === 0) {
    console.log("No actions to sign in this intent");
    return signatures;
  }

  // Process each action in the intent
  for (const action of requiredActions) {
    try {
      const signature = await signAction(action, walletClient);
      signatures.push({
        actionId: action.actionId,
        signedData: signature
      });
      console.log(`Successfully signed action ${action.actionId}`);
    } catch (error) {
      console.error(`Error signing action ${action.actionId}:`, error);
      throw error; // Propagate error to caller
    }
  }

  return signatures;
}

export type TokenResult = {
  amount: string, // The output token amount
  approximateUsdValue: number, // The approximate USD value of the output token
  chainId: number, // The chain ID of the output token
  recipientAddress: string, // The recipient address for the output token
  tokenAddress: string // The token address for the output token
}

export type PostHookPayload = {
  requiredActions: Array<Action>;
  hook: {
    chainId: number;
  }
}

export type Bundle = {
  intents: Array<IntentPayload>,
  postHooks: Array<PostHookPayload>,
  tokenResult: Array<TokenResult>,
  trades: any
}

/**
 * Main function to process a bundle of intents and collect all signatures
 * Returns all signatures for both intents and post-hooks
 */
export async function processIntentBundle(
  bundle: Bundle,
  walletClient: Record<number, WalletClient>
): Promise<Array<{ actionId: string, signedData: string }>> {
  const allSignatures: Array<{ actionId: string, signedData: string }> = [];

  // Process intents
  if (bundle.intents && Array.isArray(bundle.intents)) {
    for (const intent of bundle.intents) {
      if (intent.requiredActions && Array.isArray(intent.requiredActions)) {
        const intentSignatures = await collectIntentSignatures(intent.requiredActions, walletClient[intent.intent.intentChainId]);
        allSignatures.push(...intentSignatures);
      }
    }
  }

  // Process post-hooks (if present)
  if (bundle.postHooks && Array.isArray(bundle.postHooks)) {
    for (const hook of bundle.postHooks) {
      if (hook.requiredActions && Array.isArray(hook.requiredActions)) {
        const hookSignatures = await collectIntentSignatures(hook.requiredActions, walletClient[hook.hook.chainId]);
        allSignatures.push(...hookSignatures);
      }
    }
  }

  return allSignatures;
}

/**
 * Example function to demonstrate how to use the signature collection
 * with a wallet and prepare a bundle for submission
 */
export async function signAndPrepareBundle(
  bundle: any,
  walletClient: WalletClient
): Promise<any> {
  // Collect all signatures
  const signedDataArray = await processIntentBundle(bundle, walletClient);

  // Prepare submission payload
  const submitPayload = {
    ...bundle,
    requestId: bundle.requestId,
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };

  return submitPayload;
}

async function sign7702Authorization(walletClient: WalletClient, data: any): Promise<`0x${string}`> {
  const authorization = await walletClient.signAuthorization({
    ...data,
    nonce: Number(data.nonce),
    account: walletClient.account,
  });

  const signature = serializeSignature({
    r: authorization.r,
    s: authorization.s,
    yParity: authorization.yParity,
    v: authorization.v,
  } as SerializeSignatureParameters<'hex'>);

  return signature;
}

async function sign712(walletClient: WalletClient, data: unknown): Promise<SignTypedDataReturnType> {
  // @ts-ignore
  const signature = await walletClient.signTypedData(data);
  return signature;
}