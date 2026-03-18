import 'dotenv/config';
import { VersionedTransaction } from "@solana/web3.js";
import { Bundle, BundleCancelRequest } from '@gasless-intents/types';
import { getAddress } from 'viem';

export function getEnvConfig() {
  // --- Environment Variable Loading and Validation ---
  console.log("Loading environment variables...");
  const privateKey = process.env.SIGNER_PK;
  const solPrivateKey = process.env.SOL_PK;

  let error = ""

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
  }
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


function encodeNumberToArrayLE(num: number, arraySize: number): Uint8Array {
  const result = new Uint8Array(arraySize);
  for (let i = 0; i < arraySize; i++) {
    result[i] = Number(num & 0xff);
    num >>= 8;
  }

  return result;
}

export function updatePriorityFee(tx: VersionedTransaction, computeUnitPrice: number, computeUnitLimit?: number) {
  const computeBudgetOffset = 1;
  const computeUnitPriceData = tx.message.compiledInstructions[1].data;
  const encodedPrice = encodeNumberToArrayLE(computeUnitPrice, 8);
  for (let i = 0; i < encodedPrice.length; i++) {
    computeUnitPriceData[i + computeBudgetOffset] = encodedPrice[i];
  }

  if (computeUnitLimit) {
    const computeUnitLimitData = tx.message.compiledInstructions[0].data;
    const encodedLimit = encodeNumberToArrayLE(computeUnitLimit, 4);
    for (let i = 0; i < encodedLimit.length; i++) {
      computeUnitLimitData[i + computeBudgetOffset] = encodedLimit[i];
    }
  }
}

export async function getUrl(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch URL: ${response.statusText}. ${errorText}`);
  }
  return response.json();
}

export async function postUrl(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post URL: ${response.statusText}. ${errorText}`);
  }
  return response.json();
}

export function clipHexPrefix(input: string): string {
  if (input.startsWith("0x")) {
    return input.slice(2);
  }
  return input;
}

export function toHexPrefixString(input: string): `0x${string}` {
  if (input.startsWith("0x")) {
    return input as `0x${string}`;
  }
  return `0x${input}`;
}

export function generateCancelPreimage(
  request: BundleCancelRequest,
  authorityAddress: string,
): string {
  const parts = [
    'deBridge:BundleCancel:v1',
    authorityAddress,
    request.creationTimestamp,
    request.expirationTimestamp,
  ];

  if (request.bundleId) {
    parts.push(request.bundleId);
  }
  if (request.userId) {
    parts.push(request.userId);
  }
  if (request.intentOwners) {
    parts.push(request.intentOwners.map(getAddress).join(','));
  }

  return parts.join('|');
}

/**
 * Sorts bundles by their earliest intentTimestamp (ascending).
 * If a bundle has multiple intents, the one with the smallest timestamp is used.
 */
export function sortBundlesByIntentTimestampAscending(bundles: Array<Bundle>): Array<Bundle> {
  return [...bundles].sort((a, b) => {
    const aTimestamps = a.intents.map(i => i.intent.intentTimestamp);
    const bTimestamps = b.intents.map(i => i.intent.intentTimestamp);

    const aMin = Math.min(...aTimestamps);
    const bMin = Math.min(...bTimestamps);

    return aMin - bMin;
  });
}