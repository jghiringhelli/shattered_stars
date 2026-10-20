/**
 * Room — a lobby: seats, teams, loadouts, the ready check and the start
 * countdown. Once every member is ready the countdown runs, then the relay
 * core turns the room into a match (see MatchRelay). Pure apart from the
 * injected scheduler.
 */

import {
  MODE_RULES,
  type ErrorCode,
  type Loadout,
  type MatchMode,
  type RoomOptions,
  type RoomPhase,
  type RoomView,
  type ServerMessage,
  type TeamId,
} from "../../src/net/protocol";
import { isOnlineScenarioId } from "../../src/net/rules/scenarioIds";
import { validateLoadout } from "../../src/net/rules/squadRules";
import type { Scheduler, TimerHandle } from "../../src/net/time";
import { resolveMatchOptions } from "./matchDefinition";
import { defaultTeam, freeSeat } from "./roomSeats";

/** A refused request: the code the client reacts to and the sentence its lobby shows. */
export interface Refusal {
  readonly code: ErrorCode;
  readonly message: string;
}

/** Why a newcomer was not seated. */
export type JoinRefusal = "room_full" | "room_started";

const refuse = (code: ErrorCode, message: string): Refusal => ({
  code,
  message,
});

/** A player seated in a room. */
export interface Member {
  readonly id: string;
  name: string;
  readonly seat: number;
  team: TeamId;
  loadout: Loadout | null;
  ready: boolean;
  connected: boolean;
  pingMs: number;
}

/** What a room asks of the relay core. */
export interface RoomHooks {
  send(playerId: string, message: ServerMessage): void;
  /** The countdown elapsed with everyone still ready. */
  onCountdownDone(room: Room): void;
  /** A quick-match ready check expired: these members never readied. */
  onReadyTimeout(room: Room, unreadyIds: readonly string[]): void;
  /** The rematch window closed without a replay. */
  onRematchExpired(room: Room): void;
}

/** Room settings fixed at creation. */
export interface RoomSetup {
  readonly code: string;
  readonly mode: MatchMode;
  readonly build: string;
  readonly quickMatch: boolean;
  readonly countdownMs: number;
  /** Quick match: ready-check window (ms); 0 for none. */
  readonly readyWindowMs: number;
  /** How long a finished match's rematch stays open (ms). */
  readonly rematchWindowMs: number;
}

/** Ping change (ms) worth re-broadcasting the room view for. */
const PING_BROADCAST_DELTA_MS = 10;

export class Room {
  phase: RoomPhase = "lobby";
  options: RoomOptions;
  hostId = "";
  /** Whether a match was ever played in this room. */
  hasPlayed = false;
  private readonly members = new Map<string, Member>();
  private countdown: TimerHandle | null = null;
  private startsAt: number | null = null;
  private readyDeadline: number | null = null;
  private readyTimer: TimerHandle | null = null;
  private rematchClosesAt: number | null = null;
  private rematchTimer: TimerHandle | null = null;

  /**
   * @param setup - Code, mode, build, quick-match flag and timings.
   * @param scheduler - Timer source.
   * @param hooks - Relay-core callbacks.
   */
  constructor(
    readonly setup: RoomSetup,
    private readonly scheduler: Scheduler,
    private readonly hooks: RoomHooks,
  ) {
    this.options = resolveMatchOptions(setup.mode, {});
  }

  /** @returns Members ordered by seat. */
  list(): Member[] {
    return [...this.members.values()].sort((a, b) => a.seat - b.seat);
  }

  /** @param id - Player id. @returns The member, if seated. */
  member(id: string): Member | undefined {
    return this.members.get(id);
  }

  /** @returns Why a newcomer cannot be seated now, or null. */
  joinRefusal(): JoinRefusal | null {
    if (this.phase !== "lobby") return "room_started";
    return this.isFull() ? "room_full" : null;
  }

  /** @returns Whether every seat is taken. */
  isFull(): boolean {
    return this.members.size >= MODE_RULES[this.setup.mode].maxPlayers;
  }

  /**
   * @param id - Player id.
   * @param name - Display name.
   * @param pingMs - Last known round trip.
   * @returns Why the room refused, or null when seated.
   */
  add(id: string, name: string, pingMs: number): JoinRefusal | null {
    const refusal = this.joinRefusal();
    if (refusal) return refusal;
    const seat = freeSeat(this.members.values());
    this.members.set(id, {
      id,
      name,
      seat,
      team: defaultTeam(this.setup.mode, seat, this.members.values()),
      loadout: null,
      ready: false,
      connected: true,
      pingMs,
    });
    if (!this.hostId) this.hostId = id;
    this.armReadyCheck();
    this.cancelCountdown();
    return null;
  }

  /** @param id - Player id leaving the room (host passes to the lowest seat). */
  remove(id: string): void {
    this.members.delete(id);
    if (this.hostId === id) this.hostId = this.list()[0]?.id ?? "";
    this.cancelCountdown();
  }

  /** @returns Whether nobody is seated. */
  isEmpty(): boolean {
    return this.members.size === 0;
  }

  /**
   * @param id - Player id.
   * @param loadout - Proposed squad (shape-valid; the game's squad rules are checked here).
   * @returns A refusal, or null when stored (changing a loadout un-readies).
   */
  setLoadout(id: string, loadout: Loadout): Refusal | null {
    const member = this.editable(id);
    if (!("id" in member)) return member;
    const problem = validateLoadout(this.setup.mode, loadout);
    if (problem) return refuse("invalid_loadout", problem);
    member.loadout = loadout;
    member.ready = false;
    this.cancelCountdown();
    return null;
  }

  /**
   * @param id - Player id.
   * @param team - Team to join (team modes only; the relay keeps teams within the mode's size).
   * @returns A refusal or null.
   */
  setTeam(id: string, team: TeamId): Refusal | null {
    const member = this.editable(id);
    if (!("id" in member)) return member;
    const rules = MODE_RULES[this.setup.mode];
    if (!rules.teams)
      return refuse("not_allowed", "Teams are fixed in this mode.");
    if (member.team === team) return null;
    const crew = this.list().filter((m) => m.team === team).length;
    if (crew >= rules.maxPerTeam)
      return refuse("team_full", "That team is full.");
    member.team = team;
    member.ready = false;
    this.cancelCountdown();
    return null;
  }

  /**
   * @param id - Player id (must be host).
   * @param options - New options (a known scenario, scenario rooms only).
   * @returns A refusal or null.
   */
  setOptions(id: string, options: RoomOptions): Refusal | null {
    if (this.phase === "playing")
      return refuse("room_started", "The match already started.");
    if (id !== this.hostId)
      return refuse("not_host", "Only the room host can change options.");
    if (this.setup.mode !== "scenario")
      return refuse("not_allowed", "This mode has no options.");
    if (!isOnlineScenarioId(options.scenarioId))
      return refuse("invalid_options", "Unknown scenario.");
    this.options = resolveMatchOptions(this.setup.mode, options);
    for (const member of this.members.values()) member.ready = false;
    this.cancelCountdown();
    return null;
  }

  /** @param id - Player id. @param ready - Ready flag. @returns A refusal or null. */
  setReady(id: string, ready: boolean): Refusal | null {
    const member = this.members.get(id);
    if (!member) return refuse("not_in_room", "You are not in a room.");
    if (this.phase === "playing")
      return refuse("room_started", "The match already started.");
    if (ready && !member.loadout)
      return refuse("invalid_loadout", "Pick your ship first.");
    member.ready = ready;
    this.evaluateStart();
    return null;
  }

  /**
   * A vote for replaying the match that just ended (same squads, same teams,
   * fresh seed). Once everyone present votes yes the countdown starts.
   *
   * @param id - Player id.
   * @param vote - Yes / no.
   * @returns A refusal (no rematch open) or null.
   */
  voteRematch(id: string, vote: boolean): Refusal | null {
    if (!this.members.has(id))
      return refuse("not_in_room", "You are not in a room.");
    if (!this.rematchOpen())
      return refuse("no_rematch", "There is no rematch to vote on.");
    return this.setReady(id, vote);
  }

  /** @returns Whether a finished match's rematch window is open. */
  rematchOpen(): boolean {
    return (
      this.rematchClosesAt !== null &&
      this.phase !== "playing" &&
      this.members.size >= MODE_RULES[this.setup.mode].minPlayers
    );
  }

  /** @param id - Player id. @param connected - Socket state. */
  setConnected(id: string, connected: boolean): void {
    const member = this.members.get(id);
    if (!member) return;
    member.connected = connected;
    if (!connected) this.cancelCountdown();
  }

  /**
   * @param id - Player id.
   * @param pingMs - Reported round trip.
   * @returns Whether the change is worth a broadcast.
   */
  setPing(id: string, pingMs: number): boolean {
    const member = this.members.get(id);
    if (!member) return false;
    const changed = Math.abs(member.pingMs - pingMs) >= PING_BROADCAST_DELTA_MS;
    member.pingMs = Math.round(pingMs);
    return changed && this.phase !== "playing";
  }

  /** The match began: freeze the lobby. */
  beginPlaying(): void {
    this.phase = "playing";
    this.hasPlayed = true;
    this.startsAt = null;
    this.clearReadyCheck();
    this.clearRematch();
  }

  /**
   * The match ended: back to the lobby with everyone un-readied. A match that
   * finished opens the rematch window (everyone present can vote to replay).
   *
   * @param finished - Whether the match finished (an abandoned one opens no rematch).
   */
  endPlaying(finished: boolean): void {
    this.phase = "lobby";
    for (const member of this.members.values()) member.ready = false;
    if (!finished) return;
    this.rematchClosesAt = this.scheduler.now() + this.setup.rematchWindowMs;
    this.rematchTimer = this.scheduler.setTimeout(() => {
      this.rematchTimer = null;
      this.rematchClosesAt = null;
      this.hooks.onRematchExpired(this);
    }, this.setup.rematchWindowMs);
  }

  /** @returns The room as members see it. */
  view(): RoomView {
    return {
      code: this.setup.code,
      mode: this.setup.mode,
      options: this.options,
      hostId: this.hostId,
      phase: this.phase,
      maxPlayers: MODE_RULES[this.setup.mode].maxPlayers,
      readyDeadline: this.readyDeadline,
      startsAt: this.startsAt,
      quickMatch: this.setup.quickMatch,
      pointLimit: MODE_RULES[this.setup.mode].pointLimit,
      rematch:
        this.rematchOpen() && this.rematchClosesAt !== null
          ? { closesAt: this.rematchClosesAt }
          : null,
      players: this.list().map((m) => ({
        id: m.id,
        name: m.name,
        seat: m.seat,
        team: m.team,
        loadout: m.loadout,
        ready: m.ready,
        pingMs: m.pingMs,
        connected: m.connected,
        isHost: m.id === this.hostId,
      })),
    };
  }

  /** @param message - Sent to every member. @param exceptId - Member to skip. */
  broadcast(message: ServerMessage, exceptId?: string): void {
    for (const id of this.members.keys())
      if (id !== exceptId) this.hooks.send(id, message);
  }

  /** Send every member the current view. */
  broadcastView(): void {
    this.broadcast({ t: "room", room: this.view() });
  }

  /** Cancel timers (room closing). */
  dispose(): void {
    this.cancelCountdown();
    this.clearReadyCheck();
    this.clearRematch();
  }

  /** @returns Whether the room can start right now. */
  canStart(): boolean {
    const rules = MODE_RULES[this.setup.mode];
    const members = this.list();
    if (this.phase === "playing" || members.length < rules.minPlayers)
      return false;
    if (!members.every((m) => m.ready && m.connected && m.loadout))
      return false;
    return new Set(members.map((m) => m.team)).size === 2;
  }

  private evaluateStart(): void {
    if (!this.canStart()) {
      this.cancelCountdown();
      return;
    }
    if (this.phase === "starting") return;
    this.phase = "starting";
    this.startsAt = this.scheduler.now() + this.setup.countdownMs;
    this.countdown = this.scheduler.setTimeout(() => {
      this.countdown = null;
      if (this.canStart()) this.hooks.onCountdownDone(this);
    }, this.setup.countdownMs);
  }

  private cancelCountdown(): void {
    this.countdown?.cancel();
    this.countdown = null;
    if (this.phase === "starting") this.phase = "lobby";
    this.startsAt = null;
  }

  private armReadyCheck(): void {
    if (!this.setup.quickMatch || this.readyTimer || !this.isFull()) return;
    this.readyDeadline = this.scheduler.now() + this.setup.readyWindowMs;
    this.readyTimer = this.scheduler.setTimeout(() => {
      this.readyTimer = null;
      if (this.phase === "playing") return;
      const unready = this.list()
        .filter((m) => !m.ready)
        .map((m) => m.id);
      if (unready.length > 0) this.hooks.onReadyTimeout(this, unready);
    }, this.setup.readyWindowMs);
  }

  private clearReadyCheck(): void {
    this.readyTimer?.cancel();
    this.readyTimer = null;
    this.readyDeadline = null;
  }

  private clearRematch(): void {
    this.rematchTimer?.cancel();
    this.rematchTimer = null;
    this.rematchClosesAt = null;
  }

  private editable(id: string): Member | Refusal {
    const member = this.members.get(id);
    if (!member) return refuse("not_in_room", "You are not in a room.");
    return this.phase === "playing"
      ? refuse("room_started", "The match already started.")
      : member;
  }
}
