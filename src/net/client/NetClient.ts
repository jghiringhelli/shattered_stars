/**
 * NetClient — the game's connection to the relay: version handshake, a
 * heartbeat that measures round trip and jitter (and reports them so the
 * relay can size the input delay and show pings), and automatic reconnection
 * with the session's resume token for the server's reconnection window.
 * Typed listeners per server message type. No Phaser.
 */

import {
  CLOSE_CODES,
  decodeServerMessage,
  encodeMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type RefusalReason,
  type ServerMessage,
  type ServerMessageType,
} from "../protocol";
import { repeatEvery, type TimerHandle } from "../time";
import type { Transport } from "../transport/Transport";
import {
  DEFAULT_RECONNECT_WINDOW_MS,
  INITIAL_ATTEMPTS,
  NORMAL_CLOSE,
  PING_INTERVAL_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  type NetClientOptions,
  type NetClientState,
} from "./netClientTypes";
import { RttTracker } from "./RttTracker";

export * from "./netClientTypes";

type Listener = (message: ServerMessage) => void;

export class NetClient {
  state: NetClientState = "idle";
  playerId = "";
  refusal: RefusalReason | null = null;
  private transport: Transport | null = null;
  private readonly listeners = new Map<ServerMessageType, Set<Listener>>();
  private readonly stateListeners = new Set<(state: NetClientState) => void>();
  private heartbeat: TimerHandle | null = null;
  private retryTimer: TimerHandle | null = null;
  private token: string | null;
  private attempts = 0;
  private droppedAt = 0;
  private lastHeardAt = 0;
  private pingId = 0;
  private reconnectWindowMs = DEFAULT_RECONNECT_WINDOW_MS;
  private welcomed = false;
  private readonly rtt = new RttTracker();

  /** @param options - URL, build, name, transport factory, clock. */
  constructor(private readonly options: NetClientOptions) {
    this.token = options.tokenStore?.load() ?? null;
  }

  /** Open the connection (resuming the stored session when there is one). */
  connect(): void {
    if (["online", "connecting", "reconnecting"].includes(this.state)) return;
    this.attempts = 0;
    this.open("connecting");
  }

  /** Leave online play: close the socket, forget the session. */
  close(): void {
    this.clearTimers();
    this.setState("closed");
    this.transport?.close(NORMAL_CLOSE, "client closed");
    this.transport = null;
    this.forgetToken();
  }

  /** @param message - Message for the relay. @returns Whether it was sent (only while online). */
  send(message: ClientMessage): boolean {
    if (this.state !== "online" || !this.transport) return false;
    this.transport.send(encodeMessage(message));
    return true;
  }

  /**
   * @param type - Server message type.
   * @param listener - Receives each message of that type.
   * @returns Unsubscribe function.
   */
  on<T extends ServerMessageType>(
    type: T,
    listener: (message: Extract<ServerMessage, { t: T }>) => void,
  ): () => void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(type, set);
    return () => set.delete(listener as Listener);
  }

  /** @param listener - Receives every state change. @returns Unsubscribe function. */
  onState(listener: (state: NetClientState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** @returns Smoothed round trip (ms). */
  get rttMs(): number {
    return this.rtt.rttMs;
  }

  /** @returns Smoothed jitter (ms). */
  get jitterMs(): number {
    return this.rtt.jitterMs;
  }

  /** @returns Round trip plus twice the jitter: what the relay sizes the input delay from. */
  reportedRttMs(): number {
    return this.rtt.reportedMs();
  }

  private open(state: "connecting" | "reconnecting"): void {
    this.setState(state);
    this.attempts++;
    this.welcomed = false;
    this.retryTimer?.cancel();
    this.retryTimer = null;
    this.transport?.close(NORMAL_CLOSE, "superseded");
    // Events from a transport this client already abandoned are ignored.
    const transport: Transport = this.options.transport(this.options.url, {
      onOpen: () => {
        if (this.transport === transport) this.sendHello();
      },
      onMessage: (text) => {
        if (this.transport === transport) this.onText(text);
      },
      onClose: (code) => {
        if (this.transport === transport) this.onClose(code);
      },
    });
    this.transport = transport;
  }

  private sendHello(): void {
    const { build, name } = this.options;
    const hello: ClientMessage = this.token
      ? {
          t: "hello",
          protocol: PROTOCOL_VERSION,
          build,
          name,
          token: this.token,
        }
      : { t: "hello", protocol: PROTOCOL_VERSION, build, name };
    this.transport?.send(encodeMessage(hello));
  }

  private onText(text: string): void {
    const message = decodeServerMessage(text);
    if (!message) return;
    this.lastHeardAt = this.options.scheduler.now();
    if (message.t === "welcome") this.onWelcome(message);
    else if (message.t === "refused") this.onRefused(message.reason);
    else if (message.t === "pong")
      this.rtt.sample(message.ct, message.st, this.options.scheduler.now());
    this.listeners.get(message.t)?.forEach((listener) => listener(message));
  }

  private onWelcome(message: Extract<ServerMessage, { t: "welcome" }>): void {
    this.welcomed = true;
    this.attempts = 0;
    this.playerId = message.playerId;
    this.reconnectWindowMs = message.reconnectWindowMs;
    this.rtt.align(message.serverTime, this.options.scheduler.now());
    this.token = message.token;
    this.options.tokenStore?.save(message.token);
    this.startHeartbeat();
    this.setState("online");
    this.ping();
  }

  private onRefused(reason: RefusalReason): void {
    this.refusal = reason;
    if (reason === "session_expired") {
      // The old seat is gone; the next connect() starts a fresh session.
      this.forgetToken();
      this.finish("expired");
    } else if (reason === "server_full") {
      this.finish("unreachable");
    } else {
      this.finish("refused");
    }
  }

  /** @returns The relay's clock, estimated (room countdowns and deadlines use it). */
  serverNow(): number {
    return this.rtt.serverNow(this.options.scheduler.now());
  }

  private onClose(code: number): void {
    this.transport = null;
    this.stopHeartbeat();
    if (["closed", "refused", "expired", "unreachable"].includes(this.state))
      return;
    if (code === CLOSE_CODES.versionMismatch) return this.finish("refused");
    if (code === CLOSE_CODES.sessionExpired) return this.finish("expired");
    if (this.welcomed || this.state === "reconnecting")
      return this.scheduleReconnect();
    if (this.attempts >= INITIAL_ATTEMPTS) return this.finish("unreachable");
    this.retryTimer = this.options.scheduler.setTimeout(
      () => this.open("connecting"),
      this.backoffMs(),
    );
  }

  private scheduleReconnect(): void {
    const now = this.options.scheduler.now();
    if (this.state !== "reconnecting") {
      this.droppedAt = now;
      this.attempts = 0;
      this.setState("reconnecting");
    }
    if (now - this.droppedAt >= this.reconnectWindowMs) {
      this.forgetToken();
      return this.finish("expired");
    }
    this.retryTimer = this.options.scheduler.setTimeout(
      () => this.open("reconnecting"),
      this.backoffMs(),
    );
  }

  private backoffMs(): number {
    return Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** Math.max(0, this.attempts - 1),
    );
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = this.options.pingIntervalMs ?? PING_INTERVAL_MS;
    this.heartbeat = repeatEvery(
      this.options.scheduler,
      () => {
        if (this.options.scheduler.now() - this.lastHeardAt > 3 * interval) {
          // Silent socket: drop it ourselves (a dead TCP link may never close on its own).
          const dead = this.transport;
          this.transport = null;
          dead?.close(NORMAL_CLOSE, "heartbeat timeout");
          this.onClose(CLOSE_CODES.timeout);
          return;
        }
        this.ping();
      },
      interval,
    );
  }

  private ping(): void {
    const rtt = this.rtt.rttMs > 0 ? { rtt: this.reportedRttMs() } : {};
    this.send({
      t: "ping",
      id: ++this.pingId,
      ct: this.options.scheduler.now(),
      ...rtt,
    });
  }

  private stopHeartbeat(): void {
    this.heartbeat?.cancel();
    this.heartbeat = null;
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    this.retryTimer?.cancel();
    this.retryTimer = null;
  }

  private finish(state: NetClientState): void {
    this.clearTimers();
    this.transport?.close(NORMAL_CLOSE, state);
    this.transport = null;
    this.setState(state);
  }

  private forgetToken(): void {
    this.token = null;
    this.options.tokenStore?.save(null);
  }

  private setState(state: NetClientState): void {
    if (this.state === state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }
}
