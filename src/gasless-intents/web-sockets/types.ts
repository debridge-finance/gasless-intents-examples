/** Individual filter keys accepted by the WS API. */
export enum WsFilterKey {
  bundleId = "bundleId",
  referralCode = "referralCode",
  intentOwner = "intentOwner",
  intentAuthority = "intentAuthority",
  cancelPartnerAuthority = "cancelPartnerAuthority",
  userId = "userId"
}

/** Map of filter keys to their value types. */
export type WsFilterMap = {
  bundleId?: string[];                // UUIDs designated by the API upon bundle submission
  referralCode?: string[];            // usually a single string, but sent as array
  intentOwner?: string[];             // addresses
  intentAuthority?: string[];         // addresses
  cancelPartnerAuthority?: string[];  // addresses
  userId?: string[];                  // UUID app-level identifiers
};

/**
 * The filter object the client sends. In the page code, each subscription
 * is one of these (exactly one key usually present).
 */
export type WsFilterWrapper = {
  filters: WsFilterMap;
};


/** The array shape returned by buildFilters() in your snippet. */
export type BuiltFilters = WsFilterWrapper[];


// ---- Client → Server messages ---------------------------------------------

export type ClientEvent = "subscribe" | "unsubscribe";

/** Base envelope for messages sent to the server. */
export interface ClientEnvelope<TEvent extends ClientEvent, TData> {
  event: TEvent;
  data: TData;
}

/** Subscribe with a specific filter wrapper (one per call in the snippet). */
export type SubscribeMessage = ClientEnvelope<"subscribe", WsFilterWrapper>;

/** Unsubscribe mirrors subscribe (same filter wrapper you used to subscribe). */
export type UnsubscribeMessage = ClientEnvelope<"unsubscribe", WsFilterWrapper>;

/** Union of all client-sent messages used by this page. */
export type ClientMessage = SubscribeMessage | UnsubscribeMessage;

// ---- Server → Client messages ---------------------------------------------

export enum ServerEvent {
  subscribe = "subscribe",
  bundle_update = "bundle_update",
  unsubscribed = "unsubscribed",
  error = "error"
}

/** Generic server envelope; `data` shape depends on `event`. */
export interface ServerEnvelope<TEvent extends ServerEvent = ServerEvent, TData = unknown> {
  event: TEvent;
  data: TData;
}

/** Echo/summary returned after a successful subscription. */
export interface SubscribeAckData {
  /** The filters the server accepted; may include normalization. */
  filters?: WsFilterMap;
  /** Optional server-assigned subscription identifier (if implemented). */
  subscriptionId?: string;
}

/** Echo/summary returned after unsubscribe. */
export interface UnsubscribedData {
  filters?: WsFilterMap;
  subscriptionId?: string;
}

/** Error payload sent by the server. */
export interface ServerErrorData {
  code?: string | number;
  message: string;
  details?: unknown;
}

/**
 * The payload of live updates. If you already have Bundle/Trade types
 * from your REST models, put them here to keep WS and REST aligned.
 * For now we keep it generic.
 */
export type BundleUpdateData = unknown;

/** Discriminated unions for server messages. */
export type SubscribeAckMessage = ServerEnvelope<ServerEvent.subscribe, SubscribeAckData>;
export type BundleUpdateMessage = ServerEnvelope<ServerEvent.bundle_update, BundleUpdateData>;
export type UnsubscribedMessage = ServerEnvelope<ServerEvent.unsubscribed, UnsubscribedData>;
export type ServerErrorMessage = ServerEnvelope<ServerEvent.error, ServerErrorData>;

/** Union of all server-received messages handled in the switch-case. */
export type ServerMessage =
  | SubscribeAckMessage
  | BundleUpdateMessage
  | UnsubscribedMessage
  | ServerErrorMessage;

/** DeBridgeWsClient constructor argument. */
export type WSConfig = {
  url: string;
  filters: WsFilterMap;
  reconnect?: {
    enabled: boolean;
    baseMs: number;
    maxMs: number;
    factor: 2;
  }
}

// ---- Narrow helpers / type guards -----------------------------------------

export function isServerEnvelope(x: unknown): x is ServerMessage {
  return (
    typeof x === "object" &&
    x !== null &&
    "event" in x &&
    typeof (x as any).event === "string" &&
    "data" in x
  );
}

export function isBundleUpdate(m: ServerMessage): m is BundleUpdateMessage {
  return m.event === "bundle_update";
}

export function isServerError(m: ServerMessage): m is ServerErrorMessage {
  return m.event === "error";
}
