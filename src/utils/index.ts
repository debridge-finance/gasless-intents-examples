import "dotenv/config";
import { BundleCancelRequest, BundleProposeResponse } from '@gasless-intents/types';
import { getAddress } from 'viem';

export function generateCancelPreimage(request: BundleCancelRequest, authorityAddress: string): string {
  const parts = ["deBridge:BundleCancel:v1", authorityAddress, request.creationTimestamp, request.expirationTimestamp];

  if (request.bundleId) {
    parts.push(request.bundleId);
  }
  if (request.userId) {
    parts.push(request.userId);
  }
  if (request.intentOwners) {
    parts.push(request.intentOwners.map(getAddress).join(","));
  }

  return parts.join("|");
}

/**
 * Sorts bundles by their earliest intentTimestamp (ascending).
 * If a bundle has multiple intents, the one with the smallest timestamp is used.
 */
export function sortBundlesByIntentTimestampAscending(bundles: Array<BundleProposeResponse>): Array<BundleProposeResponse> {
  return [...bundles].sort((a, b) => {
    const aTimestamps = a.intents.map((i) => i.intent.intentTimestamp);
    const bTimestamps = b.intents.map((i) => i.intent.intentTimestamp);

    const aMin = Math.min(...aTimestamps);
    const bMin = Math.min(...bTimestamps);

    return aMin - bMin;
  });
}
