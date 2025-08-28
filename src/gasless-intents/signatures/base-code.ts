// bundle-sign-demo.ts
// Minimal, raw ethers.js example for gathering and submitting bundle signatures

import { ethers } from 'ethers';
import { createBundle, submitBundle } from '../api-calls';


export enum SignatureTypes {
  Sign712 = "Sign712",
  Sign712MetaMask = "Sign712MetaMask",
  Sign7702Authorization = "Sign7702Authorization"
}

export type ActionData = {
  domain: any;
  types: any;
  message: any;
  toSign?: {
    [key: string]: any;
  };
};

export type Action = {
  type: SignatureTypes;
  actionId: string;
  actions: Array<"Intent">;
  data: ActionData;
}

export type IntentPayload = {
  intent: any;
  requiredActions: Array<Action>
}



// Helper to generate a GUID
function generateGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Raw ethers.js signature logic
async function signActionWithEthers(action: any, wallet: ethers.Wallet): Promise<string> {
  console.log(`Signing action: ${action.actionId} of type ${action.type}`);

  // EIP-7702 Authorization
  if (action.type === 'Sign7702Authorization') {
    const { chainId, contractAddress, nonce } = action.data;
    let actionNonce = nonce;
    if (actionNonce === undefined) {
      actionNonce = await wallet.provider.getTransactionCount(wallet.address);
      console.log(`Retrieved nonce for ${wallet.address}: ${actionNonce}`);
    }
    const authorization = {
      chainId: Number(chainId),
      contractAddress,
      nonce: actionNonce,
      executor: action.data.executor || ''
    };
    // Simplified: hash the fields and sign
    const message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'address', 'uint256', 'string'],
        [authorization.chainId, authorization.contractAddress, authorization.nonce, authorization.executor]
      )
    );
    return wallet.signMessage(ethers.utils.arrayify(message));
  }
  // EIP-712 Typed Data
  else if (action.type === 'Sign712' || action.type === 'Sign712MetaMask') {
    const { domain, types, message } = action.data;
    const typesWithoutDomain = { ...types };
    delete typesWithoutDomain.EIP712Domain;
    return wallet._signTypedData(domain, typesWithoutDomain, message);
  }
  // Fallback: sign as message
  else {
    const messageToSign = action.data?.message
      ? JSON.stringify(action.data.message)
      : JSON.stringify(action.data ?? {});
    return wallet.signMessage(messageToSign);
  }
}

// Main function: get bundle, sign actions, submit
export async function submitBundleWithSignatures(input: any) {
  // 1. Get bundle from API
  const bundleRes = await createBundle(input);

  // 2. Prepare submission request
  const submitReq = {
    ...bundleRes,
    requestId: generateGuid(),
    enableAccountAbstraction: true,
    isAtomic: true
  };

  // 3. Set up ethers wallet
  const provider = new ethers.providers.JsonRpcProvider('YOUR_RPC_URL');
  const privateKey = 'YOUR_PRIVATE_KEY'; // Use env var in real code
  const wallet = new ethers.Wallet(privateKey, provider);

  // 4. Collect signatures
  const signedDataArray: { actionId: string, signedData: string }[] = [];

  // Intents
  if (submitReq.intents) {
    for (const intent of submitReq.intents) {
      if (intent.requiredActions) {
        for (const action of intent.requiredActions) {
          const signature = await signActionWithEthers(action, wallet);
          signedDataArray.push({ actionId: action.actionId, signedData: signature });
        }
      }
    }
  }
  // PostHooks
  if (submitReq.postHooks) {
    for (const hook of submitReq.postHooks) {
      if (hook.requiredActions) {
        for (const action of hook.requiredActions) {
          const signature = await signActionWithEthers(action, wallet);
          signedDataArray.push({ actionId: action.actionId, signedData: signature });
        }
      }
    }
  }

  // 5. Submit bundle with signatures
  const payload = {
    ...submitReq,
    signedData: signedDataArray
  };

  return submitBundle(payload);
}
