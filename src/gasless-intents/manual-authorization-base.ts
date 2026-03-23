import { createWalletClient, http } from "viem";
import { getEnvConfig, toHexPrefixString } from '@utils/index';
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const { privateKey } = getEnvConfig();

  const owner = privateKeyToAccount(toHexPrefixString(privateKey));

  const ownerWalletClient = createWalletClient({
    account: owner,
    chain: base,
    transport: http(),
  });
  const authorization = await ownerWalletClient.signAuthorization({
    account: owner,
    // contractAddress: EVM_NATIVE_TOKEN, // remove authorization
    contractAddress: '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B', // add authorization
    executor: 'self'
  });


  const hash = await ownerWalletClient.sendTransaction({
    authorizationList: [authorization],
    data: "0x",
    to: owner.address,
  } as any);

  console.log("Transaction hash:", hash);
}

main().catch((error) => {
  console.error("\n🚨 FATAL ERROR in script execution:", error);
  process.exitCode = 1;
});