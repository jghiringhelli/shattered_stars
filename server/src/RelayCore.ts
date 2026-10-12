/**
 * RelayCore — the relay's socket-independent heart: the version handshake,
 * sessions and their reconnection window, heartbeat replies and message
 * dispatch. The WebSocket layer (wsServer.ts) only frames, validates and
 * rate-limits; everything here is testable with fake connections and a
 * virtual clock.
 */

import {
  CLOSE_CODES,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "../../src/net/protocol";
import { RoomService } from "./RoomService";
import type { Connection, RelayDeps, Session } from "./types";

/** The hello message. */
type Hello = Extract<ClientMessage, { t: "hello" }>;

/** Random characters in a public player id (never derived from the secret token). */
const SESSION_ID_RANDOM_CHARS = 6;

/** Health-endpoint counters. */
export interface RelayStats {
  readonly sessions: number;
  readonly connected: number;
  readonly rooms: number;
  readonly matches: number;
  readonly queued: number;
  readonly desyncs: number;
}

export class RelayCore {
  private readonly sessions = new Map<string, Session>();
  private readonly byToken = new Map<string, Session>();
  private readonly rooms: RoomService;
  private sessionCounter = 0;

  /** @param deps - Scheduler, randomness, logger, config. */
  constructor(private readonly deps: RelayDeps) {
    this.rooms = new RoomService(deps, (id) => this.sessions.get(id));
  }

  /**
   * Handshake. Refuses (and closes) a mismatched protocol or an expired
   * resume token; otherwise attaches the connection to a new or resumed
   * session and sends `welcome`.
   *
   * @param connection - The new socket.
   * @param hello - Its validated first message.
   * @returns The session, or null when refused.
   */
  hello(connection: Connection, hello: Hello): Session | null {
    if (hello.protocol !== PROTOCOL_VERSION) {
      return this.refuse(
        connection,
        "version_mismatch",
        CLOSE_CODES.versionMismatch,
      );
    }
    if (hello.token === undefined)
      return this.welcome(this.newSession(hello), connection, false);
    const session = this.byToken.get(hello.token);
    if (!session || session.build !== hello.build) {
      return this.refuse(
        connection,
        "session_expired",
        CLOSE_CODES.sessionExpired,
      );
    }
    const previous = session.connection;
    session.connection = null;
    previous?.close(CLOSE_CODES.replaced, "replaced by a new connection");
    session.expiry?.cancel();
    session.expiry = null;
    session.name = hello.name;
    this.welcome(session, connection, true);
    this.rooms.reconnected(session);
    return session;
  }

  /** @param session - Sender. @param message - A validated message (never `hello`). */
  handle(session: Session, message: ClientMessage): void {
    switch (message.t) {
      case "hello":
        return;
      case "ping":
        this.send(session, {
          t: "pong",
          id: message.id,
          ct: message.ct,
          st: this.deps.scheduler.now(),
        });
        if (message.rtt !== undefined) this.rooms.ping(session, message.rtt);
        return;
      case "create_room":
        return this.rooms.create(session, message.mode);
      case "join_room":
        return this.rooms.join(session, message.code);
      case "quick_match":
        return this.rooms.quickMatch(session, message.mode);
      case "cancel_queue":
        return this.rooms.cancelQueue(session);
      case "leave_room":
        return this.rooms.leave(session);
      case "chat":
        return this.rooms.chat(session, message.text);
      case "set_loadout":
      case "set_team":
      case "set_options":
      case "set_ready":
        return this.rooms.edit(session, message);
      default:
        return this.rooms.matchMessage(session, message);
    }
  }

  /**
   * The socket closed: the session keeps its seat for the reconnection window.
   *
   * @param session - The session whose connection closed.
   * @param connection - That connection (ignored if already replaced).
   */
  disconnected(session: Session, connection: Connection): void {
    if (session.connection !== connection) return;
    session.connection = null;
    this.rooms.disconnected(session);
    session.expiry = this.deps.scheduler.setTimeout(
      () => this.expire(session),
      this.deps.config.reconnectWindowMs,
    );
  }

  /** @returns Counters for /healthz. */
  stats(): RelayStats {
    const connected = [...this.sessions.values()].filter(
      (s) => s.connection,
    ).length;
    return { sessions: this.sessions.size, connected, ...this.rooms.stats() };
  }

  /** Tell every client the relay is going away (deploy), then close them. */
  shutdown(): void {
    for (const session of this.sessions.values()) {
      session.connection?.send({ t: "shutdown" });
      session.connection?.close(CLOSE_CODES.shutdown, "server shutting down");
      session.expiry?.cancel();
    }
  }

  private newSession(hello: Hello): Session {
    const token = this.deps.random.token();
    const session: Session = {
      id: `p${++this.sessionCounter}_${this.deps.random.token().slice(0, SESSION_ID_RANDOM_CHARS)}`,
      token,
      name: hello.name,
      build: hello.build,
      connection: null,
      rttMs: 0,
      roomCode: null,
      expiry: null,
    };
    this.sessions.set(session.id, session);
    this.byToken.set(token, session);
    return session;
  }

  private welcome(
    session: Session,
    connection: Connection,
    resumed: boolean,
  ): Session {
    session.connection = connection;
    const { config, scheduler } = this.deps;
    connection.send({
      t: "welcome",
      playerId: session.id,
      token: session.token,
      protocol: PROTOCOL_VERSION,
      resumed,
      reconnectWindowMs: config.reconnectWindowMs,
      heartbeatMs: config.heartbeatIntervalMs,
      serverTime: scheduler.now(),
    });
    this.deps.logger.debug(resumed ? "session resumed" : "session opened", {
      player: session.id,
    });
    return session;
  }

  private refuse(
    connection: Connection,
    reason: "version_mismatch" | "session_expired",
    code: number,
  ): null {
    connection.send({ t: "refused", reason, serverProtocol: PROTOCOL_VERSION });
    connection.close(code, reason);
    return null;
  }

  private expire(session: Session): void {
    session.expiry = null;
    if (session.connection) return;
    this.rooms.leave(session);
    this.sessions.delete(session.id);
    this.byToken.delete(session.token);
    this.deps.logger.debug("session expired", { player: session.id });
  }

  private send(session: Session, message: ServerMessage): void {
    session.connection?.send(message);
  }
}
