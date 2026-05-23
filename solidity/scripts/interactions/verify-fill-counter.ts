import "dotenv/config";
import { verifyOnBasescan } from "../lib/etherscan-verify";

verifyOnBasescan({
  contractName: "FillCounter",
  contractPath: "contracts/interactions/FillCounter.sol",
  cliScriptName: "solidity/scripts/interactions/verify-fill-counter.ts",
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
