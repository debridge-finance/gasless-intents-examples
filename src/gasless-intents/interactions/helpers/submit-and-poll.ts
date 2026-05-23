/**
 * Submit a bundle and poll for its terminal status.
 *
 * This is the gate-3 helper used by the six interaction examples. It
 * deliberately tolerates two failure modes that exist *today*:
 *
 *   - The `submitBundle` wrapper in `src/utils/api.ts` is locally stubbed
 *     (the `postUrl` line is commented out and a `{ bundleId: "" }` placeholder
 *     is returned). Empty `bundleId` ⇒ surface as a "stubbed" outcome.
 *
 *   - When `submitBundle` actually hits the API, the submit endpoint does not
 *     yet support `preInteractions` / `postInteractions` end-to-end. The call
 *     may throw or return a non-fulfilled status; both are captured here as
 *     non-fatal `failed` outcomes so callers can still print their gate-1 and
 *     gate-2 results.
 *
 * Polling is bounded by `pollTimeoutMs` (default 60s) with `pollIntervalMs`
 * spacing between checks (default 5s). A successful fulfillment means
 * `status === "fulfilled"`; any other terminal state (`partially_fulfilled`,
 * `expired`, `cancelled`) is reported with the final status string.
 */
import { getBundleById, submitBundle } from "@utils/api";
import type { Bundle } from "@gasless-intents/types";

export type SubmitPollOutcome =
  | {
      kind: "stubbed";
      message: string;
    }
  | {
      kind: "submit-error";
      message: string;
    }
  | {
      kind: "submitted";
      bundleId: string;
      status: string;
      pollAttempts: number;
      finalBundle?: Bundle;
    }
  | {
      kind: "poll-timeout";
      bundleId: string;
      lastStatus: string;
      pollAttempts: number;
    };

const TERMINAL_STATUSES = new Set([
  "fulfilled",
  "partially_fulfilled",
  "expired",
  "cancelled",
  "rejected",
  "failed",
]);

export async function submitAndPoll(opts: {
  bundle: Bundle;
  requestId: string;
  signedData: ReadonlyArray<{ actionId: string; signedData: string }>;
  referralCode?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}): Promise<SubmitPollOutcome> {
  const pollIntervalMs = opts.pollIntervalMs ?? 5_000;
  const pollTimeoutMs = opts.pollTimeoutMs ?? 60_000;
  const referralCode = opts.referralCode ?? 110000002;

  let response;
  try {
    response = await submitBundle({
      ...opts.bundle,
      requestId: opts.requestId,
      signedData: opts.signedData as any,
      referralCode,
    } as Bundle);
  } catch (err) {
    return {
      kind: "submit-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const bundleId = response?.bundleId;
  if (!bundleId || bundleId === "") {
    return {
      kind: "stubbed",
      message:
        "submitBundle returned empty bundleId — `postUrl` is commented out in src/utils/api.ts:38. Restore it to exercise the live /submit endpoint.",
    };
  }

  const deadline = Date.now() + pollTimeoutMs;
  let attempts = 0;
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const fetched = await getBundleById(bundleId);
      const status = (fetched as any).status ?? "unknown";
      lastStatus = String(status);
      if (TERMINAL_STATUSES.has(lastStatus)) {
        return {
          kind: "submitted",
          bundleId,
          status: lastStatus,
          pollAttempts: attempts,
          finalBundle: fetched,
        };
      }
    } catch (err) {
      lastStatus = `poll-error: ${err instanceof Error ? err.message : String(err)}`;
    }
    await sleep(pollIntervalMs);
  }

  return {
    kind: "poll-timeout",
    bundleId,
    lastStatus,
    pollAttempts: attempts,
  };
}

export function summariseOutcome(outcome: SubmitPollOutcome): string {
  switch (outcome.kind) {
    case "stubbed":
      return `Submit: STUBBED — ${outcome.message}`;
    case "submit-error":
      return `Submit: ERROR — ${outcome.message}`;
    case "submitted":
      return `Submit: bundleId=${outcome.bundleId} status=${outcome.status} (${outcome.pollAttempts} polls)`;
    case "poll-timeout":
      return `Submit: TIMEOUT — bundleId=${outcome.bundleId} lastStatus=${outcome.lastStatus} (${outcome.pollAttempts} polls)`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
