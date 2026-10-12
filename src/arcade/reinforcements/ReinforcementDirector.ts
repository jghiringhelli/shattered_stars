/**
 * ReinforcementDirector — runs a reinforced match, frame by frame, without
 * Phaser. Sides are TEAMS: each team spends one pool and shares one
 * on-field cap; its squads (members) each keep their own sub-reserve — AI
 * squads top up from their strategy plan as soon as there is room (after
 * the AI deploy delay), human squads replace their wingmen from their
 * reserve, and every human squad replaces its own ship through its own
 * picker (default auto-accepted after the countdown, or another allowed
 * option chosen). While a team's picker is open the team holds its other
 * deployments for that replacement. The director also keeps the match
 * clock and — unless a scenario owns the result — the outcome (the
 * player's team vs every other team).
 *
 * The scene registers the opening squads, reports destroyed ships, spawns
 * every Deployment `tick` / `choose` return, and reads summaries.
 */

import {
  coalitionExhausted,
  coalitionOf,
  createSideState,
  matchTotals,
  opposingRolesOf,
  playerSideFirst,
  retireFromSide,
  sideExhausted,
  standingsOf,
  summarize,
  withMember,
  type CoalitionStats,
  type SideState,
  type SideSummary,
} from "./directorSides";
import {
  countDownPicker,
  pickerRowsOf,
  pickerViewOf,
  reservePreviewOf,
} from "./directorMembers";
import {
  bookDeployment,
  bookPick,
  humanMembersOf,
  memberOf,
  sideByKey,
  sideOfMember,
} from "./directorRoster";
import { nextTopUp } from "./directorTopUp";
import { deployShip, isOnField } from "./poolLedger";
import {
  decideReinforcedOutcome,
  type ReinforcedResult,
  type ReinforcedSide,
} from "./reinforcementOutcome";
import type { PickerOption } from "./reserveQueue";
import type { DeployOption, ReinforcementRules } from "./reinforcementTypes";
import type {
  DeployPilot,
  Deployment,
  DirectorSetup,
  PickerView,
} from "./directorTypes";

/** Safety bound on deployments per side per tick. */
const MAX_DEPLOYS_PER_TICK = 8;

export class ReinforcementDirector {
  private readonly sides = new Map<string, SideState>();
  private elapsed = 0;
  private outcome: ReinforcedResult | null = null;

  /** @param setup - Rules, team sides and their squads, outcome ownership, id source. */
  constructor(private readonly setup: DirectorSetup) {
    for (const side of setup.sides) {
      const isPlayer = side.key === setup.playerSide;
      this.sides.set(side.key, createSideState(setup.rules, side, isPlayer));
    }
  }

  /** The match rules. */
  get rules(): ReinforcementRules {
    return this.setup.rules;
  }

  /** The ship the primary human (the player's team's first human squad) flies now. */
  get playerShipId(): string | null {
    const key = this.primaryMember();
    return key === null ? null : this.pilotShipOf(key);
  }

  /** Battle time elapsed (ms). */
  get elapsedMs(): number {
    return this.elapsed;
  }

  /** Battle time left before 3:00 (ms). */
  get remainingMs(): number {
    return Math.max(0, this.setup.rules.timeLimitMs - this.elapsed);
  }

  /** How the match ended, or null (always null when a scenario owns it). */
  get result(): ReinforcedResult | null {
    return this.outcome;
  }

  /** The primary human's replacement picker, or null while it is closed. */
  get picker(): PickerView | null {
    const key = this.primaryMember();
    return key === null ? null : this.pickerOf(key);
  }

  /** @returns Every human squad's key, the player's team first. */
  humanMembers(): string[] {
    return humanMembersOf(this.sides);
  }

  /** @param member - A squad. @returns Its human's ship, or null. */
  pilotShipOf(member: string): string | null {
    return memberOf(this.sides, member).pilotId;
  }

  /** @param member - A squad. @returns Its open picker, or null. */
  pickerOf(member: string): PickerView | null {
    const { ledger } = sideOfMember(this.sides, member);
    return pickerViewOf(memberOf(this.sides, member), ledger, this.rules);
  }

  /**
   * An opening-squad ship: its cost is spent from its team's pool.
   * @param shipId - The ship.
   * @param member - Its squad.
   * @param option - What it is.
   * @param pilot - Who flies it ("player": the squad's human).
   */
  registerInitial(
    shipId: string,
    member: string,
    option: DeployOption,
    pilot: DeployPilot,
  ): void {
    const side = sideOfMember(this.sides, member);
    const next = { ...side, ledger: deployShip(side.ledger, shipId, option) };
    this.sides.set(
      side.key,
      pilot === "player"
        ? withMember(next, member, (m) => ({ ...m, pilotId: shipId }))
        : next,
    );
  }

  /**
   * A ship was destroyed: it leaves its team's field; losing a human's
   * ship opens that human's picker.
   * @param shipId - The ship.
   */
  shipDestroyed(shipId: string): void {
    const { aiDeployDelayMs, pickerAutoAcceptMs } = this.rules;
    for (const side of [...this.sides.values()]) {
      if (!isOnField(side.ledger, shipId)) continue;
      this.sides.set(
        side.key,
        retireFromSide(side, shipId, {
          readyAtMs: this.elapsed + aiDeployDelayMs,
          pickerMs: pickerAutoAcceptMs,
        }),
      );
    }
  }

  /**
   * One logic tick: clock, pickers, top-ups, outcome.
   * @param deltaMs - Tick length.
   * @returns Ships to spawn now.
   */
  tick(deltaMs: number): Deployment[] {
    if (this.outcome) return [];
    this.elapsed += deltaMs;
    const deployed: Deployment[] = [];
    for (const key of [...this.sides.keys()]) {
      const members = sideByKey(this.sides, key).members;
      const pickerOpen = members.some((m) => m.pickerMs !== null);
      deployed.push(...this.tickPickers(key, deltaMs));
      if (!pickerOpen) deployed.push(...this.topUp(key));
    }
    if (this.setup.ownsOutcome) this.outcome = this.decide();
    return deployed;
  }

  /**
   * A human picks a row of their picker.
   * @param index - Row index.
   * @param member - The human's squad (default: the primary human).
   * @returns The deployment, or null (picker closed / row disabled).
   */
  choose(index: number, member = this.primaryMember()): Deployment | null {
    if (member === null || this.outcome) return null;
    const state = memberOf(this.sides, member);
    if (state.pickerMs === null) return null;
    const { ledger } = sideOfMember(this.sides, member);
    const row = pickerRowsOf(state, ledger, this.rules)[index];
    if (!row?.check.allowed) return null;
    return this.deployPick(member, row);
  }

  /**
   * @param side - A coalition.
   * @returns Whether it can still field a ship (scenario annihilation rule).
   */
  canField(side: ReinforcedSide): boolean {
    const coalition = coalitionOf(this.sides.values(), side === "player");
    return !coalitionExhausted(coalition, this.rules);
  }

  /** @param key - A team's side key. @returns Its summary. */
  summary(key: string): SideSummary {
    const side = sideByKey(this.sides, key);
    return summarize(side, sideExhausted(side, this.rules));
  }

  /** @returns Every team's summary, the player's first. */
  summaries(): SideSummary[] {
    return playerSideFirst(this.sides.values()).map((s) => this.summary(s.key));
  }

  /** @returns Both coalitions' totals (end screen, telemetry). */
  matchStats(): Readonly<Record<ReinforcedSide, CoalitionStats>> {
    return matchTotals(this.sides.values());
  }

  /**
   * @param count - How many.
   * @param member - A human squad (default: the primary human).
   * @returns Its next reserve ships from the cursor on.
   */
  reservePreview(count: number, member = this.primaryMember()): DeployOption[] {
    if (member === null) return [];
    return reservePreviewOf(memberOf(this.sides, member), count);
  }

  /** Debug hook (e2e): move the match clock on. @param ms - Battle time to skip. */
  debugAdvanceClock(ms: number): void {
    this.elapsed += Math.max(0, ms);
  }

  private tickPickers(key: string, deltaMs: number): Deployment[] {
    const out: Deployment[] = [];
    for (const { key: member } of sideByKey(this.sides, key).members) {
      const side = sideByKey(this.sides, key);
      const state = memberOf(this.sides, member);
      const step = countDownPicker(state, side.ledger, this.rules, deltaMs);
      if (step.due) out.push(this.deployPick(member, step.due));
      else
        this.sides.set(
          key,
          withMember(side, member, () => step.member),
        );
    }
    return out;
  }

  private topUp(key: string): Deployment[] {
    const out: Deployment[] = [];
    const context = {
      rules: this.rules,
      elapsedMs: this.elapsed,
      opposingRoles: opposingRolesOf(this.sides.values(), key),
    };
    let progressed = true;
    while (progressed && out.length < MAX_DEPLOYS_PER_TICK) {
      progressed = false;
      for (const { key: member } of sideByKey(this.sides, key).members) {
        if (out.length >= MAX_DEPLOYS_PER_TICK) break;
        const side = sideByKey(this.sides, key);
        const state = memberOf(this.sides, member);
        const step = nextTopUp(side, state, context);
        this.sides.set(key, step.side);
        if (!step.option) continue;
        out.push(this.deploy(member, step.option, step.pilot));
        progressed = true;
      }
    }
    return out;
  }

  private deployPick(member: string, row: PickerOption): Deployment {
    const shipId = this.setup.nextShipId(member, "player");
    const booked = bookPick(
      sideOfMember(this.sides, member),
      member,
      row,
      shipId,
    );
    this.sides.set(booked.side.key, booked.side);
    return booked.deployment;
  }

  private deploy(
    member: string,
    option: DeployOption,
    pilot: DeployPilot,
  ): Deployment {
    const shipId = this.setup.nextShipId(member, pilot);
    const booked = bookDeployment(sideOfMember(this.sides, member), {
      member,
      shipId,
      option,
      pilot,
    });
    this.sides.set(booked.side.key, booked.side);
    return booked.deployment;
  }

  private decide(): ReinforcedResult | null {
    return decideReinforcedOutcome({
      standings: standingsOf(this.sides.values(), this.rules),
      elapsedMs: this.elapsed,
      timeLimitMs: this.rules.timeLimitMs,
    });
  }

  private primaryMember(): string | null {
    return this.humanMembers()[0] ?? null;
  }
}
