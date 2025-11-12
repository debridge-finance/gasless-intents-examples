import WebSocket from "ws";
import {
  BuiltFilters,
  ClientMessage,
  isServerEnvelope,
  ServerEvent,
  WsFilterMap,
  WsFilterWrapper,
} from "./types";
import { warn, log, err } from "./utils";

export class DebridgeWsClient {
  private config: any;
  private url: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private activeFilters: WsFilterWrapper[] = [];
  private reconnectAttempts = 0;
  private closing = false;

  constructor(config: any) {
    this.url = config.url;
    this.config = config;
  }

  connect() {
    if (this.ws && this.connected) {
      warn("Already connected.");
      return;
    }
    this.closing = false;
    log(`Connecting to ${this.url} ...`);
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      log("Connection established.");
      // Auto-subscribe once connected (based on CONFIG.filters)
      this.subscribeAll(buildFilters(this.config.filters));
    });

    this.ws.on("message", (data) => this.onMessage(data));
    this.ws.on("close", (code, reason) => this.onClose(code, reason.toString()));
    this.ws.on("error", (e) => {
      err("WebSocket error:", (e as any)?.message || e);
    });
  }

  private onMessage(raw: WSRawData) {
    const text = dataToString(raw);

    try {
      const msg = JSON.parse(text);
      if (!isServerEnvelope(msg)) {
        log("[RAW]", text);
        return;
      }

      switch (msg.event) {
        case ServerEvent.subscribe:
          log("[CONFIRM] Subscribed →", JSON.stringify(msg.data));
          break;
        case ServerEvent.bundle_update:
          log("[UPDATE]", JSON.stringify(msg.data, null, 2));
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
    log(`Disconnected. Code: ${code}, Reason: ${reason || "N/A"}`);
    if (this.closing) return;

    if (this.config.reconnect.enabled) {
      const delay = Math.min(
        this.config.reconnect.baseMs * Math.pow(this.config.reconnect.factor, this.reconnectAttempts++),
        this.config.reconnect.maxMs
      );
      log(`Reconnecting in ${delay}ms ...`);
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

  subscribeAll(list: BuiltFilters) {
    if (list.length === 0) {
      warn("No filters to subscribe.");
      return;
    }
    list.forEach((f) => {
      this.safeSend({ event: "subscribe", data: f });
      this.activeFilters.push(f);
    });
  }

  unsubscribeAll() {
    if (this.activeFilters.length === 0) {
      warn("No active subscriptions.");
      return;
    }
    this.activeFilters.forEach((f) => {
      this.safeSend({ event: "unsubscribe", data: f });
    });
    this.activeFilters = [];
    log("Unsubscribed from all filters.");
  }

  close() {
    this.closing = true;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log("Already disconnected.");
      return;
    }
    this.unsubscribeAll();
    this.ws.close(1000, "Manual disconnect");
    log("Manual disconnect requested.");
  }
}

// Helpers

// Build one WsFilterWrapper per key present, same as the HTML demo.
function buildFilters(map: WsFilterMap): BuiltFilters {
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

// Canonical raw data type from `ws`
type WSRawData = WebSocket.Data; // string | Buffer | ArrayBuffer | Buffer[]

function dataToString(raw: WSRawData): string {
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
  // ArrayBuffer branch
  return Buffer.from(new Uint8Array(raw as ArrayBuffer)).toString("utf8");
}