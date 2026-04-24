import WebSocket from "ws";
import {
  BuiltFilters,
  ClientEvent,
  ClientMessage,
  isServerEnvelope,
  ServerEvent,
  ServerMessage,
  WSConfig,
  WsFilterMap,
  WsFilterWrapper,
} from "./types";
import { warn, log, err } from "./log-utils";

/** Extra fields accepted by the client beyond the documented WSConfig. */
type WSConfigExt = WSConfig & {
  /** Called for every parsed server envelope, before the built-in switch logs it. Use for persistence. */
  onEvent?: (msg: ServerMessage) => void;
  /** Called for every raw (unparseable / non-envelope) message. */
  onRaw?: (raw: string) => void;
};

// TODO: Implement runtime filter updates
export class DebridgeWsClient {
  private config: WSConfigExt;
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private activeFilters: WsFilterWrapper[] = [];
  private reconnectAttempts = 0;
  private closing = false;

  // Ping/pong heartbeat
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private awaitingPong = false;
  private lastPongAt = 0;

  constructor(config: WSConfigExt) {
    this.url = config.url;
    this.config = config;
  }

  connect() {
    // Avoid duplicate sockets
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      warn("Already connected/connecting.");
      return;
    }

    this.closing = false;
    log(`Connecting to ${this.url} ...`);

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      log("Connection established.");

      this.startHeartbeat();

      // Auto-subscribe once connected (based on CONFIG.filters)
      this.restoreSubscriptions();
    });

    this.ws.on("message", (data) => this.onMessage(data));

    // If the server pings us, ws auto-replies with pong; we can still log it.
    this.ws.on("ping", () => {
      // Optional: treat as liveness signal
      log("[PING] received from server");
    });

    this.ws.on("pong", () => {
      this.onPong();
    });

    this.ws.on("close", (code, reason) => this.onClose(code, reason.toString()));
    this.ws.on("error", (e) => {
      err("WebSocket error:", (e as any)?.message || e);
    });
  }

  private onMessage(raw: WebSocket.Data) {
    const text = dataToString(raw);

    try {
      const msg = JSON.parse(text);
      if (!isServerEnvelope(msg)) {
        this.config.onRaw?.(text);
        log("[RAW]", text);
        return;
      }

      this.config.onEvent?.(msg);

      switch (msg.event) {
        case ServerEvent.subscribe:
          log("[CONFIRM] Subscribed →", JSON.stringify(msg.data));
          break;
        case ServerEvent.bundle_update:
          log("[UPDATE]", JSON.stringify(msg.data, null, 2));
          break;
        case ServerEvent.explorer_bundle_update:
          log("[EXPLORER UPDATE]", JSON.stringify(msg.data, null, 2));
          break;
        case ServerEvent.unsubscribed:
          log("[INFO] Unsubscribed →", JSON.stringify(msg.data));
          break;
        case ServerEvent.error:
          err("[SERVER ERROR]", JSON.stringify(msg.data ?? { message: "unknown" }));
          break;
        default:
          log("[RECV]", text);
      }
    } catch {
      err("Invalid JSON from server:", text);
    }
  }

  private onClose(code: number, reason: string) {
    this.connected = false;
    this.stopHeartbeat();

    log(`Disconnected. Code: ${code}, Reason: ${reason || "N/A"}`);
    if (this.closing) return;

    if (this.config.reconnect?.enabled) {
      const delay = Math.max(0, this.config.reconnect.baseMs ?? 1000);
      this.reconnectAttempts++;
      log(`Reconnecting in ${delay}ms ... (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  private safeSend(msg: ClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      warn("WebSocket is not connected.");
      return;
    }
    const json = JSON.stringify(msg);
    this.ws.send(json);
    log("[SEND]", json);
  }

  private restoreSubscriptions() {
    const list = buildFilters(this.config.filters);

    // Prevent duplicates across reconnects
    this.activeFilters = list;

    if (list.length === 0) {
      warn("No filters to subscribe.");
      return;
    }

    list.forEach((f) => {
      this.safeSend({ event: ClientEvent.subscribe, data: f });
    });
  }

  subscribeAll(list: BuiltFilters) {
    if (list.length === 0) {
      warn("No filters to subscribe.");
      return;
    }
    list.forEach((f) => {
      this.safeSend({ event: ClientEvent.subscribe, data: f });
      this.activeFilters.push(f);
    });
  }

  unsubscribeAll() {
    if (this.activeFilters.length === 0) {
      warn("No active subscriptions.");
      return;
    }
    this.activeFilters.forEach((f) => {
      this.safeSend({ event: ClientEvent.unsubscribe, data: f });
    });
    this.activeFilters = [];
    log("Unsubscribed from all filters.");
  }

  close() {
    this.closing = true;
    this.stopHeartbeat();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log("Already disconnected.");
      return;
    }
    this.unsubscribeAll();
    this.ws.close(1000, "Manual disconnect");
    log("Manual disconnect requested.");
  }

  private getPingConfig() {
    const pingCfg = (this.config as any)?.ping ?? {};
    return {
      enabled: pingCfg.enabled ?? true,
      intervalMs: pingCfg.intervalMs ?? 25_000,
      timeoutMs: pingCfg.timeoutMs ?? 10_000,
      log: pingCfg.log ?? false,
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    const { enabled, intervalMs, timeoutMs, log: pingLog } = this.getPingConfig();
    if (!enabled) return;

    this.lastPongAt = Date.now();
    this.awaitingPong = false;

    const tick = () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Kill the socket if previous ping unanswered
      if (this.awaitingPong) {
        warn(`No pong received within ${timeoutMs}ms. Terminating socket...`);
        try {
          this.ws.terminate();
        } catch {}
        return;
      }

      this.awaitingPong = true;

      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      this.pongTimeout = setTimeout(() => {
        if (this.awaitingPong) {
          warn(`Pong timeout (${timeoutMs}ms). Terminating socket...`);
          try {
            this.ws?.terminate();
          } catch {}
        }
      }, timeoutMs);

      try {
        this.ws.ping();
        if (pingLog) log("[PING] sent");
      } catch (e) {
        err("Failed to send ping:", (e as any)?.message || e);
      }
    };

    this.heartbeatInterval = setInterval(tick, intervalMs);

    this.heartbeatInterval.unref?.();
    this.pongTimeout?.unref?.();
  }

  private onPong() {
    this.lastPongAt = Date.now();
    this.awaitingPong = false;

    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }

    const { log: pingLog } = this.getPingConfig();
    if (pingLog) log("[PONG] received");
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
    this.awaitingPong = false;
  }
}

export function buildFilters(map: WsFilterMap): BuiltFilters {
  const out: BuiltFilters = [];
  if (map.bundleId?.length) out.push({ filters: { bundleId: map.bundleId } });
  if (map.referralCode?.length)
    out.push({ filters: { referralCode: map.referralCode } });
  if (map.intentOwner?.length)
    out.push({ filters: { intentOwner: map.intentOwner } });
  if (map.intentAuthority?.length)
    out.push({ filters: { intentAuthority: map.intentAuthority } });
  if (map.cancelPartnerAuthority?.length)
    out.push({ filters: { cancelPartnerAuthority: map.cancelPartnerAuthority } });
  if (map.userId?.length) out.push({ filters: { userId: map.userId } });
  return out;
}

function dataToString(raw: WebSocket.Data): string {
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
  return Buffer.from(new Uint8Array(raw as ArrayBuffer)).toString("utf8");
}