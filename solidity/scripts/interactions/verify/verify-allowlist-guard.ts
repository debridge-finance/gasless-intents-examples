import "dotenv/config";
import { verifyOnBasescan } from "../../lib/etherscan-verify";

verifyOnBasescan({
  contractName: "AllowlistGuard",
  contractPath: "contracts/interactions/AllowlistGuard.sol",
  cliScriptName: "solidity/scripts/interactions/verify/verify-allowlist-guard.ts",
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
