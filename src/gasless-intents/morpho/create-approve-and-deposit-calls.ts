import { createApproveCall, createDepositCall } from "./helpers/calls";
import { getVaultAddressByToken } from "./helpers/get-vault-address";

const TOKEN_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon
const CHAIN_ID = 137; // Polygon chain ID
const TOKEN_AMOUNT = 10_000_000n;
const DEPOSIT_RECEIVER_ADDRESS = "0xA9e6dc0AEA659e087f1597dE618993506F2b0256";

async function main(): Promise<void> {
    const vaultAddressString = await getVaultAddressByToken(TOKEN_ADDRESS, CHAIN_ID);
    if (vaultAddressString === null) {
        throw new Error("No Morpho Vault found for the given token on the specified chain.");
    }

    const vaultAddress = vaultAddressString as `0x${string}`;

    const approveCall = createApproveCall(TOKEN_ADDRESS, vaultAddress, TOKEN_AMOUNT);
    const depositCall = createDepositCall(vaultAddress, TOKEN_AMOUNT, DEPOSIT_RECEIVER_ADDRESS);

    console.log("Approve Call:", approveCall);
    console.log("Deposit Call:", depositCall);
}

main().catch((error) => {
    console.error("\n🚨 FATAL ERROR in script execution:", error);
    process.exitCode = 1;
});