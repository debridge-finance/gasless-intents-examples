import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from "fs";
import { dirname, join } from "path";

const PAYLOADS_DIR = join(__dirname, "payloads");

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

export type WsPayloadSink = {
  write: (envelope: unknown) => void;
  end: () => void;
  path: string;
};

/**
 * Durable JSONL sink for a WebSocket session. Opens a file like
 * `payloads/<session>-<UTC-YYYYMMDD-HHMMSS>.jsonl`, appends one
 * `{ ts, event, raw }` line per server envelope, fsyncs every write so
 * ungraceful shutdown can't lose events, and registers SIGINT/SIGTERM
 * handlers to close the fd cleanly.
 */
export function openWsPayloadSink(session: string): WsPayloadSink {
  const path = join(PAYLOADS_DIR, `${session}-${timestamp()}.jsonl`);
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a");
  let closed = false;

  const end = () => {
    if (closed) return;
    closed = true;
    try {
      fsyncSync(fd);
      closeSync(fd);
    } catch {
      // swallow; process is exiting anyway
    }
  };

  const cleanupSignal = (sig: NodeJS.Signals) => {
    end();
    // Let the default handler follow so the process actually exits.
    process.off(sig, cleanupSignal);
  };

  process.once("SIGINT", cleanupSignal);
  process.once("SIGTERM", cleanupSignal);
  process.once("exit", end);

  return {
    write: (envelope: unknown) => {
      if (closed) return;
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        event: (envelope as { event?: unknown })?.event ?? null,
        raw: envelope,
      }) + "\n";
      writeSync(fd, line);
      fsyncSync(fd);
    },
    end,
    path,
  };
}
