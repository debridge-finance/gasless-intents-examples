import "dotenv/config";
import { verifyOnBasescan } from "../lib/etherscan-verify";

verifyOnBasescan({
  contractName: "FillCapEnforcer",
  contractPath: "contracts/interactions/FillCapEnforcer.sol",
  cliScriptName: "solidity/scripts/interactions/verify-fill-cap-enforcer.ts",
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
