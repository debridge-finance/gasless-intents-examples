import { EXPLORER_WS_URL } from "@utils/constants";
import { DebridgeWsClient } from "./DebridgeWsClient";
import { WSConfig, WsFilterMap } from "./types";
import { log } from "./log-utils";
import { openWsPayloadSink } from "./_saveWsPayload";

// Post-submit explorer WS subscription: subscribe to a specific bundleId so the
// session tracks exactly one bundle's state changes. Accepts the id via
// BUNDLE_ID env var or as argv[2].

const BUNDLE_ID = process.env.BUNDLE_ID ?? process.argv[2];

if (!BUNDLE_ID) {
  console.error(
    "BUNDLE_ID is required. Pass via env (BUNDLE_ID=<id>) or argv (npx tsx explorer-by-bundle-id.ts <id>).",
  );
  process.exit(1);
}

const CONFIG: WSConfig = {
  url: EXPLORER_WS_URL,
  filters: {
    bundleId: [BUNDLE_ID],
    referralCode: [],
    intentOwner: [],
    intentAuthority: [],
    cancelPartnerAuthority: [],
    userId: [],
  } as WsFilterMap,
  reconnect: {
    enabled: true,
    baseMs: 500,
    maxMs: 10_000,
  },
};

(async () => {
  const sink = openWsPayloadSink(`explorer-by-bundle-id-${BUNDLE_ID.slice(0, 10)}`);
  log(`Subscribing by bundleId=${BUNDLE_ID}`);
  log(`Persisting events to ${sink.path}`);

  const client = new DebridgeWsClient({
    ...CONFIG,
    onEvent: sink.write,
    onRaw: (raw) => sink.write({ event: null, raw }),
  });

  const shutdown = () => {
    log("Shutting down ...");
    client.close();
    sink.end();
    setTimeout(() => process.exit(0), 250);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  client.connect();
})();
