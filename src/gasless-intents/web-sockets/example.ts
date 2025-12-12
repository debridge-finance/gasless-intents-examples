import { DebridgeWsClient } from "./DebridgeWsClient";
import { WSConfig, WsFilterMap } from "./types";
import { log } from "./log-utils";

// Edit these values to your needs.
const CONFIG: WSConfig = {
  url: process.env.DEBRIDGE_WS_URL || "wss://api.debridge.io/ws",
  // Provide all supported filters here; one subscription will be sent per key.
  // Max 100 entries per filter, aside from `referralCode`. Only 1 `referralCode` per client.
  filters: {
    bundleId: [],
    referralCode: ["31805"],
    intentOwner: [
      "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8"
    ],
    intentAuthority: [
      "0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8"
    ],
    cancelPartnerAuthority: ["0x55A8f5cce1d53D9Ff84EC0962882b447E5914dB8"],
    userId: [],
  } as WsFilterMap,
  // Optional reconnect configuration
  reconnect: {
    enabled: true,
    baseMs: 500,
    maxMs: 10_000,
  },
};

// ---------------- Entrypoint ----------------

(async () => {
  const client = new DebridgeWsClient(CONFIG);

  // Graceful shutdown
  const shutdown = () => {
    log("Shutting down ...");
    client.close();
    setTimeout(() => process.exit(0), 250);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  client.connect();
})();