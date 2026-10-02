import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

export type Capture = {
  dir: string;
  startedAt: number;
  elapsedMs(): number;
  save(step: string, payload: unknown): string;
  event(step: string, details?: Record<string, unknown>): void;
};

const REDACT_KEYS = new Set(["signedData", "x-api-key", "privateKey", "secretKey", "signature"]);

export function redact(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        REDACT_KEYS.has(key) && typeof item === "string"
          ? `<redacted ${item.length} chars>`
          : redact(item);
    }
    return out;
  }
  return value;
}

export function createCapture(label: string, root = "output/captures"): Capture {
  const startedAt = Date.now();
  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, "-");
  const dir = join(root, `${stamp}-${label}`);
  mkdirSync(dir, { recursive: true });
  const events = join(dir, "events.jsonl");
  let seq = 0;

  const elapsedMs = (): number => Date.now() - startedAt;
  const line = (record: Record<string, unknown>): void => {
    appendFileSync(
      events,
      JSON.stringify({ ts: new Date().toISOString(), elapsedMs: elapsedMs(), ...record }) + "\n",
    );
  };

  console.log(`[capture] run folder: ${dir}`);
  return {
    dir,
    startedAt,
    elapsedMs,
    save(step, payload) {
      const file = `${String(seq++).padStart(2, "0")}-${step}.json`;
      writeFileSync(join(dir, file), JSON.stringify(redact(payload), null, 2) + "\n");
      line({ step, file });
      console.log(`[capture +${(elapsedMs() / 1000).toFixed(1)}s] ${file}`);
      return file;
    },
    event(step, details = {}) {
      const safe = redact(details) as Record<string, unknown>;
      line({ step, ...safe });
      console.log(`[event +${(elapsedMs() / 1000).toFixed(1)}s] ${step} ${JSON.stringify(safe)}`);
    },
  };
}

export function openCapture(dir: string): Capture {
  const startedAt = Date.now();
  const events = join(dir, "events.jsonl");
  const numbers = readdirSync(dir)
    .map((file) => /^(\d+)-/.exec(file)?.[1])
    .filter((prefix): prefix is string => prefix !== undefined)
    .map(Number);
  let seq = numbers.length > 0 ? Math.max(...numbers) + 1 : 0;

  const elapsedMs = (): number => Date.now() - startedAt;
  const line = (record: Record<string, unknown>): void => {
    appendFileSync(
      events,
      JSON.stringify({ ts: new Date().toISOString(), elapsedMs: elapsedMs(), ...record }) + "\n",
    );
  };

  console.log(`[capture] reopened run folder: ${dir} (next file ${seq})`);
  line({ step: "reopened" });
  return {
    dir,
    startedAt,
    elapsedMs,
    save(step, payload) {
      const file = `${String(seq++).padStart(2, "0")}-${step}.json`;
      writeFileSync(join(dir, file), JSON.stringify(redact(payload), null, 2) + "\n");
      line({ step, file });
      console.log(`[capture +${(elapsedMs() / 1000).toFixed(1)}s] ${file}`);
      return file;
    },
    event(step, details = {}) {
      const safe = redact(details) as Record<string, unknown>;
      line({ step, ...safe });
      console.log(`[event +${(elapsedMs() / 1000).toFixed(1)}s] ${step} ${JSON.stringify(safe)}`);
    },
  };
}
