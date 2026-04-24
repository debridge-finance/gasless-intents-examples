import { EXPLORER_WS_URL } from "@utils/constants";
import { DebridgeWsClient } from "./DebridgeWsClient";
import { WSConfig, WsFilterMap } from "./types";
import { log } from "./log-utils";
import { openWsPayloadSink } from "./_saveWsPayload";

// Pre-submit explorer WS subscription: filter by the partner referralCode used by
// submit-bundle-poly-to-base.ts, so we capture the bundle from `created` through
// `fulfilled` in a single session.
const CONFIG: WSConfig = {
  url: EXPLORER_WS_URL,
  filters: {
    bundleId: [],
    referralCode: ["110000002"],
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
  const sink = openWsPayloadSink("explorer-by-referral");
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
