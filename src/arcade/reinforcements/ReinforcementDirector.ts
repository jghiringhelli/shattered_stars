/**
 * ReinforcementDirector — runs a reinforced match, frame by frame, without
 * Phaser: every side's pool ledger; AI sides topping up their field from
 * their strategy plan as soon as there is room (after the AI deploy delay);
 * the player's wingmen replaced from the player's reserve; the player's own
 * replacement through the picker (default auto-accepted after the
 * countdown, or another allowed option chosen); the match clock and — unless
 * a scenario owns the result — the outcome.
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
  pickerRowsFor,
  playerSideFirst,
  reservePreviewOf,
  sideExhausted,
  standingsOf,
  summarize,
  type CoalitionStats,
  type SideState,
  type SideSummary,
} from "./directorSides";
import { deployShip, isOnField, retireShip } from "./poolLedger";
import {
  decideReinforcedOutcome,
  type ReinforcedResult,
  type ReinforcedSide,
} from "./reinforcementOutcome";
import { ReinforcementError } from "./reinforcementErrors";
import {
  nextReserveIndex,
  takeReserve,
  type PickerOption,
} from "./reserveQueue";
import { planNextDeployment } from "./strategyPlanner";
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
  private pickerMs: number | null = null;
  private playerId: string | null = null;

  /** @param setup - Rules, sides, catalog, outcome ownership, id source. */
  constructor(private readonly setup: DirectorSetup) {
    for (const side of setup.sides) {
      const isPlayer = side.faction === setup.playerFaction;
      this.sides.set(
        side.faction,
        createSideState(
          setup.rules,
          side.faction,
          isPlayer,
          side.strategy,
          side.plan,
        ),
      );
    }
  }

  /** The match rules. */
  get rules(): ReinforcementRules {
    return this.setup.rules;
  }

  /** The ship the human flies now (null between ships). */
  get playerShipId(): string | null {
    return this.playerId;
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

  /** The player's replacement picker, or null while it is closed. */
  get picker(): PickerView | null {
    if (this.pickerMs === null) return null;
    const options = this.pickerRows();
    return {
      options,
      remainingMs: this.pickerMs,
      counting: options[0]?.check.allowed ?? false,
    };
  }

  /**
   * An opening-squad ship: its cost is spent from its side's pool.
   * @param shipId - The ship.
   * @param faction - Its side.
   * @param option - What it is.
   * @param pilot - Who flies it.
   */
  registerInitial(
    shipId: string,
    faction: string,
    option: DeployOption,
    pilot: DeployPilot,
  ): void {
    const side = this.side(faction);
    this.sides.set(faction, {
      ...side,
      ledger: deployShip(side.ledger, shipId, option),
    });
    if (pilot === "player") this.playerId = shipId;
  }

  /**
   * A ship was destroyed: it leaves its side's field; losing the player's
   * ship opens the picker.
   * @param shipId - The ship.
   */
  shipDestroyed(shipId: string): void {
    for (const side of this.sides.values()) {
      if (!isOnField(side.ledger, shipId)) continue;
      this.sides.set(side.faction, {
        ...side,
        ledger: retireShip(side.ledger, shipId),
        readyAtMs: this.elapsed + this.setup.rules.aiDeployDelayMs,
      });
    }
    if (shipId === this.playerId) {
      this.playerId = null;
      this.pickerMs = this.setup.rules.pickerAutoAcceptMs;
    }
  }

  /**
   * One logic tick: clock, AI and wingman top-ups, picker countdown, outcome.
   * @param deltaMs - Tick length.
   * @returns Ships to spawn now.
   */
  tick(deltaMs: number): Deployment[] {
    if (this.outcome) return [];
    this.elapsed += deltaMs;
    const deployed: Deployment[] = [];
    for (const side of [...this.sides.values()]) {
      if (side.isPlayerSide) deployed.push(...this.tickPlayerSide(deltaMs));
      else if (this.elapsed >= side.readyAtMs)
        deployed.push(...this.topUpAi(side.faction));
    }
    if (this.setup.ownsOutcome) this.outcome = this.decide();
    return deployed;
  }

  /**
   * The player picks a picker row.
   * @param index - Row index.
   * @returns The deployment, or null (picker closed / row disabled).
   */
  choose(index: number): Deployment | null {
    if (this.pickerMs === null || this.outcome) return null;
    const row = this.pickerRows()[index];
    if (!row?.check.allowed) return null;
    return this.deployPlayer(row);
  }

  /**
   * @param side - A coalition.
   * @returns Whether it can still field a ship (scenario annihilation rule).
   */
  canField(side: ReinforcedSide): boolean {
    const { rules, playerCatalog } = this.setup;
    return !coalitionExhausted(this.coalition(side), rules, playerCatalog);
  }

  /** @param faction - A side. @returns Its summary. */
  summary(faction: string): SideSummary {
    const side = this.side(faction);
    return summarize(
      side,
      sideExhausted(side, this.setup.rules, this.setup.playerCatalog),
    );
  }

  /** @returns Every side's summary, the player's first. */
  summaries(): SideSummary[] {
    return playerSideFirst(this.sides.values()).map((s) =>
      this.summary(s.faction),
    );
  }

  /** @returns Both coalitions' totals (end screen, telemetry). */
  matchStats(): Readonly<Record<ReinforcedSide, CoalitionStats>> {
    return matchTotals(this.sides.values());
  }

  /** @param count - How many. @returns The player's next reserve ships from the cursor on. */
  reservePreview(count: number): DeployOption[] {
    return reservePreviewOf(this.side(this.setup.playerFaction), count);
  }

  /** Debug hook (e2e): move the match clock on. @param ms - Battle time to skip. */
  debugAdvanceClock(ms: number): void {
    this.elapsed += Math.max(0, ms);
  }

  private tickPlayerSide(deltaMs: number): Deployment[] {
    if (this.pickerMs === null) return this.topUpWingmen();
    const row = this.pickerRows()[0];
    if (!row?.check.allowed) return [];
    this.pickerMs = Math.max(0, this.pickerMs - deltaMs);
    return this.pickerMs > 0 ? [] : [this.deployPlayer(row)];
  }

  private topUpAi(faction: string): Deployment[] {
    const out: Deployment[] = [];
    for (let i = 0; i < MAX_DEPLOYS_PER_TICK; i++) {
      const side = this.side(faction);
      const step = planNextDeployment({
        strategy: side.strategy,
        state: side.planner,
        ledger: side.ledger,
        quotas: this.setup.rules.quotas,
        battle: {
          opposingRoles: opposingRolesOf(this.sides.values(), faction),
        },
      });
      this.sides.set(faction, { ...side, planner: step.state });
      if (!step.option) break;
      out.push(this.deploy(faction, step.option, "ai"));
    }
    return out;
  }

  private topUpWingmen(): Deployment[] {
    const out: Deployment[] = [];
    const faction = this.setup.playerFaction;
    for (let i = 0; i < MAX_DEPLOYS_PER_TICK; i++) {
      const side = this.side(faction);
      const index = nextReserveIndex(
        side.reserve,
        side.ledger,
        this.setup.rules.quotas,
      );
      if (index === null) break;
      this.sides.set(faction, {
        ...side,
        reserve: takeReserve(side.reserve, index),
      });
      out.push(this.deploy(faction, side.reserve.entries[index]!, "wingman"));
    }
    return out;
  }

  private deployPlayer(row: PickerOption): Deployment {
    const faction = this.setup.playerFaction;
    const side = this.side(faction);
    if (row.reserveIndex !== null)
      this.sides.set(faction, {
        ...side,
        reserve: takeReserve(side.reserve, row.reserveIndex),
      });
    const deployment = this.deploy(faction, row.option, "player");
    this.playerId = deployment.shipId;
    this.pickerMs = null;
    return deployment;
  }

  private deploy(
    faction: string,
    option: DeployOption,
    pilot: DeployPilot,
  ): Deployment {
    const side = this.side(faction);
    const shipId = this.setup.nextShipId(faction, pilot);
    this.sides.set(faction, {
      ...side,
      ledger: deployShip(side.ledger, shipId, option),
      arrivals: side.arrivals + 1,
    });
    return { shipId, faction, option, pilot, slot: side.arrivals };
  }

  private pickerRows(): PickerOption[] {
    const side = this.side(this.setup.playerFaction);
    return pickerRowsFor(side, this.setup.rules, this.setup.playerCatalog);
  }

  private decide(): ReinforcedResult | null {
    const { rules, playerCatalog } = this.setup;
    return decideReinforcedOutcome({
      standings: standingsOf(this.sides.values(), rules, playerCatalog),
      elapsedMs: this.elapsed,
      timeLimitMs: rules.timeLimitMs,
    });
  }

  private coalition(side: ReinforcedSide): SideState[] {
    return coalitionOf(this.sides.values(), side === "player");
  }

  private side(faction: string): SideState {
    const side = this.sides.get(faction);
    if (!side) throw new ReinforcementError("side", `unknown side ${faction}`);
    return side;
  }
}
