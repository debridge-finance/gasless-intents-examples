import "dotenv/config";

export function getEnvConfig(): {
  privateKey: string;
  solPrivateKey: string;
  referralCode: number;
} {
  // --- Environment Variable Loading and Validation ---
  console.log("Loading environment variables...");
  const privateKey = process.env.SIGNER_PK;
  const solPrivateKey = process.env.SOL_PK;

  let error = "";

  if (!privateKey) {
    error += "\nSIGNER_PK not found in .env file.";
  }
  if (!solPrivateKey) {
    error += "\nSOL_PK not found in .env file.";
  }

  if (error !== "") {
    throw new Error(`Invalid configuration. ${error}`);
  }

  return {
    privateKey,
    solPrivateKey,
    referralCode: getReferralCode(),
  };
}

export function getReferralCode(): number {
  const referralCode = Number(process.env.REFERRAL_CODE ?? "110000002"); // Use your own referral code.
  if (!Number.isSafeInteger(referralCode) || referralCode < 0 || process.env.REFERRAL_CODE === "") {
    throw new Error("REFERRAL_CODE must be a non-negative safe integer");
  }
  return referralCode;
}

export function getHeaders(): Headers {
  const DE_BRIDGE_PARTNER_API_KEY = process.env.DE_BRIDGE_PARTNER_API_KEY;

  if (!DE_BRIDGE_PARTNER_API_KEY) throw new Error("Missing DE_BRIDGE_PARTNER_API_KEY in .env");

  const headers = new Headers();

  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (!headers.has("x-api-key")) headers.set("x-api-key", DE_BRIDGE_PARTNER_API_KEY);

  return headers;
}
