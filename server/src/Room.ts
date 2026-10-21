/**
 * Room — a lobby: seats, teams, loadouts, the ready check and the start
 * countdown. Once every member is ready the countdown runs, then the relay
 * core turns the room into a match (see MatchRelay). Pure apart from the
 * injected scheduler.
 */

import {
  MODE_RULES,
  type Loadout,
  type RoomOptions,
  type RoomPhase,
  type RoomView,
  type ServerMessage,
  type TeamId,
} from "../../src/net/protocol";
import type { Scheduler } from "../../src/net/time";
import { DeadlineTimer } from "./DeadlineTimer";
import { resolveMatchOptions } from "./matchDefinition";
import {
  applyLoadout,
  applyTeam,
  canStartRoom,
  optionsRefusal,
} from "./roomEdits";
import { RoomRoster } from "./RoomRoster";
import {
  refuse,
  type JoinRefusal,
  type Member,
  type Refusal,
  type RoomHooksFor,
  type RoomSetup,
} from "./roomTypes";
import { buildRoomView } from "./roomView";

/** What a room asks of the relay core. */
export type RoomHooks = RoomHooksFor<Room>;

export class Room {
  phase: RoomPhase = "lobby";
  options: RoomOptions;
  /** Whether a match was ever played in this room. */
  hasPlayed = false;
  private readonly roster: RoomRoster;
  private readonly countdown: DeadlineTimer;
  private readonly readyCheck: DeadlineTimer;
  private readonly rematchWindow: DeadlineTimer;

  /**
   * @param setup - Code, mode, build, quick-match flag and timings.
   * @param scheduler - Timer source.
   * @param hooks - Relay-core callbacks.
   */
  constructor(
    readonly setup: RoomSetup,
    scheduler: Scheduler,
    private readonly hooks: RoomHooks,
  ) {
    this.options = resolveMatchOptions(setup.mode, {});
    this.roster = new RoomRoster(setup.mode);
    this.countdown = new DeadlineTimer(scheduler);
    this.readyCheck = new DeadlineTimer(scheduler);
    this.rematchWindow = new DeadlineTimer(scheduler);
  }

  /** @returns The player who may change the room's options. */
  get hostId(): string {
    return this.roster.hostId;
  }

  /** @returns Members ordered by seat. */
  list(): Member[] {
    return this.roster.list();
  }

  /** @param id - Player id. @returns The member, if seated. */
  member(id: string): Member | undefined {
    return this.roster.get(id);
  }

  /** @returns Why a newcomer cannot be seated now, or null. */
  joinRefusal(): JoinRefusal | null {
    if (this.phase !== "lobby") return "room_started";
    return this.isFull() ? "room_full" : null;
  }

  /** @returns Whether every seat is taken. */
  isFull(): boolean {
    return this.roster.size >= MODE_RULES[this.setup.mode].maxPlayers;
  }

  /** @param id - Player id. @param name - Display name. @param pingMs - Last known round trip. @returns Why the room refused, or null when seated. */
  add(id: string, name: string, pingMs: number): JoinRefusal | null {
    const refusal = this.joinRefusal();
    if (refusal) return refusal;
    this.roster.seat(id, name, pingMs);
    this.armReadyCheck();
    this.cancelCountdown();
    return null;
  }

  /** @param id - Player id leaving the room (host passes to the lowest seat). */
  remove(id: string): void {
    this.roster.remove(id);
    this.cancelCountdown();
  }

  /** @returns Whether nobody is seated. */
  isEmpty(): boolean {
    return this.roster.size === 0;
  }

  /** @param id - Player id. @param loadout - Proposed squad (game rules checked here). @returns A refusal, or null when stored (un-readies). */
  setLoadout(id: string, loadout: Loadout): Refusal | null {
    const member = this.editable(id);
    if (!("id" in member)) return member;
    const refusal = applyLoadout(this.setup.mode, member, loadout);
    if (!refusal) this.cancelCountdown();
    return refusal;
  }

  /** @param id - Player id. @param team - Team to join (team modes only, within the mode's size). @returns A refusal or null. */
  setTeam(id: string, team: TeamId): Refusal | null {
    const member = this.editable(id);
    if (!("id" in member)) return member;
    const before = member.team;
    const refusal = applyTeam(this.setup.mode, this.list(), member, team);
    if (!refusal && before !== team) this.cancelCountdown();
    return refusal;
  }

  /** @param id - Player id (must be host). @param options - New options (a known scenario). @returns A refusal or null. */
  setOptions(id: string, options: RoomOptions): Refusal | null {
    const refusal = optionsRefusal(
      this.setup.mode,
      this.phase,
      id === this.hostId,
      options,
    );
    if (refusal) return refusal;
    this.options = resolveMatchOptions(this.setup.mode, options);
    this.roster.unreadyAll();
    this.cancelCountdown();
    return null;
  }

  /** @param id - Player id. @param ready - Ready flag. @returns A refusal or null. */
  setReady(id: string, ready: boolean): Refusal | null {
    const member = this.roster.get(id);
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
    if (!this.roster.get(id))
      return refuse("not_in_room", "You are not in a room.");
    if (!this.rematchOpen())
      return refuse("no_rematch", "There is no rematch to vote on.");
    return this.setReady(id, vote);
  }

  /** @returns Whether a finished match's rematch window is open. */
  rematchOpen(): boolean {
    return (
      this.rematchWindow.armed &&
      this.phase !== "playing" &&
      this.roster.size >= MODE_RULES[this.setup.mode].minPlayers
    );
  }

  /** @param id - Player id. @param connected - Socket state. */
  setConnected(id: string, connected: boolean): void {
    const member = this.roster.get(id);
    if (!member) return;
    member.connected = connected;
    if (!connected) this.cancelCountdown();
  }

  /** @param id - Player id. @param pingMs - Reported round trip. @returns Whether the change is worth a broadcast. */
  setPing(id: string, pingMs: number): boolean {
    return this.roster.setPing(id, pingMs) && this.phase !== "playing";
  }

  /** The match began: freeze the lobby. */
  beginPlaying(): void {
    this.phase = "playing";
    this.hasPlayed = true;
    this.countdown.clear();
    this.readyCheck.clear();
    this.rematchWindow.clear();
  }

  /**
   * The match ended: back to the lobby with everyone un-readied. A match that
   * finished opens the rematch window (everyone present can vote to replay).
   *
   * @param finished - Whether the match finished (an abandoned one opens no rematch).
   */
  endPlaying(finished: boolean): void {
    this.phase = "lobby";
    this.roster.unreadyAll();
    if (!finished) return;
    this.rematchWindow.arm(this.setup.rematchWindowMs, () =>
      this.hooks.onRematchExpired(this),
    );
  }

  /** @returns The room as members see it. */
  view(): RoomView {
    return buildRoomView({
      code: this.setup.code,
      mode: this.setup.mode,
      quickMatch: this.setup.quickMatch,
      options: this.options,
      hostId: this.hostId,
      phase: this.phase,
      readyDeadline: this.readyCheck.deadline,
      startsAt: this.countdown.deadline,
      rematchClosesAt: this.rematchOpen() ? this.rematchWindow.deadline : null,
      members: this.list(),
    });
  }

  /** @param message - Sent to every member. @param exceptId - Member to skip. */
  broadcast(message: ServerMessage, exceptId?: string): void {
    for (const id of this.roster.ids())
      if (id !== exceptId) this.hooks.send(id, message);
  }

  /** Send every member the current view. */
  broadcastView(): void {
    this.broadcast({ t: "room", room: this.view() });
  }

  /** Cancel timers (room closing). */
  dispose(): void {
    this.cancelCountdown();
    this.readyCheck.clear();
    this.rematchWindow.clear();
  }

  /** @returns Whether the room can start right now. */
  canStart(): boolean {
    return canStartRoom(this.setup.mode, this.phase, this.list());
  }

  private evaluateStart(): void {
    if (!this.canStart()) {
      this.cancelCountdown();
      return;
    }
    if (this.phase === "starting") return;
    this.phase = "starting";
    this.countdown.arm(this.setup.countdownMs, () => {
      if (this.canStart()) this.hooks.onCountdownDone(this);
    });
  }

  private cancelCountdown(): void {
    this.countdown.clear();
    if (this.phase === "starting") this.phase = "lobby";
  }

  private armReadyCheck(): void {
    if (!this.setup.quickMatch || this.readyCheck.armed || !this.isFull())
      return;
    this.readyCheck.arm(this.setup.readyWindowMs, () => {
      if (this.phase === "playing") return;
      const unready = this.list()
        .filter((m) => !m.ready)
        .map((m) => m.id);
      if (unready.length > 0) this.hooks.onReadyTimeout(this, unready);
    });
  }

  private editable(id: string): Member | Refusal {
    const member = this.roster.get(id);
    if (!member) return refuse("not_in_room", "You are not in a room.");
    return this.phase === "playing"
      ? refuse("room_started", "The match already started.")
      : member;
  }
}
