// intent-signatures.ts
// Implementation for collecting signatures for intents and their actions

import { ethers } from 'ethers';

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
 * Helper to generate a GUID for request IDs
 */
export function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Signs an action with ethers.js wallet
 * Handles different signature types: Sign712, Sign712MetaMask, and Sign7702Authorization
 */
export async function signAction(action: Action, wallet: ethers.Wallet): Promise<string> {
  console.log(`Signing action: ${action.actionId} of type ${action.type}`);

  // EIP-7702 Authorization
  if (action.type === SignatureTypes.Sign7702Authorization) {
    // Cast to Sign7702AuthorizationData to access specific properties
    const data = action.data as Sign7702AuthorizationData;
    const { contractAddress, nonce } = data;
    
    // For Sign7702Authorization, we need to determine the chainId
    // If not present in data, we can get it from the provider
    const chainId = data.chainId || (await wallet.provider.getNetwork()).chainId;
    let actionNonce = nonce;
    
    if (actionNonce === undefined) {
      actionNonce = await wallet.provider.getTransactionCount(wallet.address);
      console.log(`Retrieved nonce for ${wallet.address}: ${actionNonce}`);
    }
    
    const authorization = {
      chainId: Number(chainId),
      contractAddress,
      nonce: actionNonce
    };
    
    // Hash the fields and sign - ethers v6 style
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encodedData = abiCoder.encode(
      ['uint256', 'address', 'uint256'],
      [authorization.chainId, authorization.contractAddress, authorization.nonce]
    );
    const message = ethers.keccak256(encodedData);
    
    // In ethers v6, signMessage accepts a string or Uint8Array directly
    return wallet.signMessage(ethers.getBytes(message));
  }
  
  // EIP-712 Typed Data - Sign712MetaMask
  else if (action.type === SignatureTypes.Sign712MetaMask) {
    const data = action.data as Sign712MetaMaskData;
    const { domain, types, primaryType, message } = data.toSign;
    
    // Remove EIP712Domain from types when signing
    const typesWithoutDomain = { ...types };
    delete typesWithoutDomain.EIP712Domain;
    
    // In ethers v6, signTypedData is the method for EIP-712 signatures
    return wallet.signTypedData(domain, typesWithoutDomain, message);
  }
  
  // EIP-712 Typed Data - Sign712
  else if (action.type === SignatureTypes.Sign712) {
    const data = action.data as EIP712Data;
    const { domain, types, message } = data;
    
    // Remove EIP712Domain from types when signing
    const typesWithoutDomain = { ...types };
    delete typesWithoutDomain.EIP712Domain;
    
    // In ethers v6, signTypedData is the method for EIP-712 signatures
    return wallet.signTypedData(domain, typesWithoutDomain, message);
  }
  
  // Fallback: sign as message
  else {
    let messageToSign: string;
    
    if (action.type === SignatureTypes.Sign712) {
      const data = action.data as EIP712Data;
      messageToSign = JSON.stringify(data.message || {});
    } 
    else if (action.type === SignatureTypes.Sign712MetaMask) {
      const data = action.data as Sign712MetaMaskData;
      messageToSign = JSON.stringify(data.toSign?.message || {});
    }
    else {
      messageToSign = JSON.stringify(action.data || {});
    }
    
    return wallet.signMessage(messageToSign);
  }
}

/**
 * Collects signatures for all actions in an intent
 * Returns array of { actionId, signedData } objects
 */
export async function collectIntentSignatures(
  intent: IntentPayload, 
  wallet: ethers.Wallet
): Promise<Array<{ actionId: string, signedData: string }>> {
  const signatures: Array<{ actionId: string, signedData: string }> = [];
  
  if (!intent.requiredActions || intent.requiredActions.length === 0) {
    console.log("No actions to sign in this intent");
    return signatures;
  }
  
  // Process each action in the intent
  for (const action of intent.requiredActions) {
    try {
      const signature = await signAction(action, wallet);
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

/**
 * Main function to process a bundle of intents and collect all signatures
 * Returns all signatures for both intents and post-hooks
 */
export async function processIntentBundle(
  bundle: any, 
  wallet: ethers.Wallet
): Promise<Array<{ actionId: string, signedData: string }>> {
  const allSignatures: Array<{ actionId: string, signedData: string }> = [];
  
  // Process intents
  if (bundle.intents && Array.isArray(bundle.intents)) {
    for (const intent of bundle.intents) {
      if (intent.requiredActions && Array.isArray(intent.requiredActions)) {
        const intentSignatures = await collectIntentSignatures(intent, wallet);
        allSignatures.push(...intentSignatures);
      }
    }
  }
  
  // Process post-hooks (if present)
  if (bundle.postHooks && Array.isArray(bundle.postHooks)) {
    for (const hook of bundle.postHooks) {
      if (hook.requiredActions && Array.isArray(hook.requiredActions)) {
        const hookSignatures = await collectIntentSignatures(hook, wallet);
        allSignatures.push(...hookSignatures);
      }
    }
  }
  
  return allSignatures;
}

/**
 * Creates a signature payload for a specific intent
 * Useful when you need to sign just one intent rather than a full bundle
 */
export async function createIntentSignaturePayload(
  intentPayload: IntentPayload,
  wallet: ethers.Wallet
): Promise<{ intent: any, signatures: Array<{ actionId: string, signedData: string }> }> {
  const signatures = await collectIntentSignatures(intentPayload, wallet);
  
  return {
    intent: intentPayload.intent,
    signatures
  };
}

/**
 * Example function to demonstrate how to use the signature collection
 * with a wallet and prepare a bundle for submission
 */
export async function signAndPrepareBundle(
  bundle: any,
  privateKey: string,
  rpcUrl: string
): Promise<any> {
  // Set up wallet - ethers v6 style
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Collect all signatures
  const signedDataArray = await processIntentBundle(bundle, wallet);
  
  // Prepare submission payload
  const submitPayload = {
    ...bundle,
    requestId: generateGuid(),
    enableAccountAbstraction: true,
    isAtomic: true,
    signedData: signedDataArray
  };
  
  return submitPayload;
}
