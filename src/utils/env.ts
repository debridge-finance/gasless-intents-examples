import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} not found in .env file.`);
  }
  return value;
}

export function getEvmPrivateKey(): string {
  return requireEnv("SIGNER_PK");
}

export function getSolanaPrivateKey(): string {
  return requireEnv("SOL_PK");
}

export function getEnvConfig(): {
  privateKey: string;
  solPrivateKey: string;
} {
  // --- Environment Variable Loading and Validation ---
  console.log("Loading environment variables...");
  const privateKey = process.env.SIGNER_PK;
  const solPrivateKey = process.env.SOL_PK;

  if (!privateKey || !solPrivateKey) {
    throw new Error("\nBoth SIGNER_PK and nSOL_PK are required in .env file.");
  }

  return {
    privateKey,
    solPrivateKey,
  };
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
