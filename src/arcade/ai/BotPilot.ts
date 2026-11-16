/**
 * BotPilot â€” the AI pilot of a cycle-engine ship, with the same shape as
 * PlayerFlightPilot: one per AI ship, `fly(frame)` every frame,
 * `onCycleCommitted` when its ship commits a cycle, `reset` on respawn.
 *
 * It perceives the other ships through its tier's reaction delay
 * (Perception), decides on its tier's cadence (the same bots the skill
 * gates measure) and flies ONLY through the player's controls: its hands
 * press keys that go through applyPilotFlightInput. What the gates test is
 * exactly what the game flies.
 *
 * Pure: no Phaser.
 */

import type { ManeuverDefinition, ManeuverDirection } from "../../core/types";
import { createSeededRng } from "../../utils/random";
import type { CycleFlightState } from "../systems/CycleFlight";
import { canHullKTurn } from "./HullAgility";
import type { FlightControlResult } from "../systems/PilotFlightTypes";
import { offNoseDeg, type Point } from "./AiGeometry";
import {
  aceStrikeIntent,
  createAceMemory,
  type AceMemory,
} from "./AceStrikePolicy";
import { ACE_BOT_POLICY } from "../../data/aceConfig";
import { aceStrikeView } from "./AceTargeting";
import { botProfile } from "./BotDifficulty";
import {
  IDLE_INTENT,
  type BotProfile,
  type BotTier,
  type OwnShipView,
  type PilotBot,
  type PilotIntent,
  type SquadOrder,
} from "./BotTypes";
import { createBot } from "./bots/BotFactory";
import { steerForError, type SteerThresholds } from "./bots/BotKit";
import { contactSnapshot, ownShipView, type BotContact } from "./BotView";
import { SnapshotHistory } from "./Perception";
import { PilotHands } from "./PilotHands";

/** Seed used when neither a seed nor a random source is given. */
const DEFAULT_BOT_SEED = 1;

/** Steering escalation while escaping a hazard: turn hard, early. */
export const ESCAPE_STEER: SteerThresholds = { hold: 10, drift: 25, bank: 50 };

/** BotPilot options. */
export interface BotPilotOptions {
  /** Multiplier on reaction delay and decision interval (Brutal: 0.5). */
  readonly reactionScale?: number;
  /** Uniform random source in [0, 1) (the battle's seeded RNG). */
  readonly random?: () => number;
  /** Seed for a private RNG when no `random` is given. */
  readonly seed?: number;
  /** A specific bot to fly with (tests / experiments); default: the tier's. */
  readonly bot?: PilotBot;
}

/** One frame of an AI ship, as the scene supplies it. */
export interface BotFlightFrame {
  /** The ship itself (identity, hull/shields, arc, range; pose is read from `flight`). */
  readonly self: BotContact;
  readonly flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  /** Every other ship in the battle, as it is now (allies share `self.side`). */
  readonly contacts: readonly BotContact[];
  /** This ship's squad order (SquadCommand.orderFor), or null when flying alone. */
  readonly order?: SquadOrder | null;
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly worldSize: number;
  /**
   * A hazard (the arena's asteroid belt...) threatens the ship: break off
   * and fly toward this point. Null/omitted = no hazard.
   */
  readonly safePoint?: Point | null;
}

export class BotPilot {
  readonly profile: BotProfile;
  private bot: PilotBot;
  private hands = new PilotHands();
  private history: SnapshotHistory | null = null;
  private nextDecisionMs: number | null = null;
  /** Hit-and-run rhythm of an ace (AceStrikePolicy); idle for everyone else. */
  private aceMemory: AceMemory = createAceMemory();
  private readonly random: () => number;

  /**
   * @param tier - Skill tier (difficultyToTier picks it from a difficulty label).
   * @param options - Reaction scale, random source / seed, bot override.
   */
  constructor(
    readonly tier: BotTier,
    private readonly options: BotPilotOptions = {},
  ) {
    this.profile =
      options.bot?.profile ?? botProfile(tier, options.reactionScale);
    this.random =
      options.random ?? createSeededRng(options.seed ?? DEFAULT_BOT_SEED).next;
    this.bot = options.bot ?? createBot(tier, this.profile);
  }

  /** The enemy this pilot is trying to shoot (prefer it when several are in arc). */
  get targetId(): string | null {
    return this.hands.currentIntent().targetId;
  }

  /** The intent the pilot's hands are carrying out. */
  get intent(): PilotIntent {
    return this.hands.currentIntent();
  }

  /**
   * Perceive, decide when due, and press this frame's keys.
   *
   * @param frame - The ship, everyone else, the squad order and timing.
   * @returns New motion and stress (and effect events) â€” apply like the player's.
   */
  fly(frame: BotFlightFrame): FlightControlResult {
    const history = this.historyFor(frame.worldSize);
    history.record(
      frame.nowMs,
      [frame.self, ...frame.contacts].map(contactSnapshot),
    );
    if (this.nextDecisionMs === null) {
      this.nextDecisionMs =
        frame.nowMs + this.random() * this.profile.decisionIntervalMs;
    }
    if (frame.nowMs >= this.nextDecisionMs) {
      this.decide(frame, history);
      this.nextDecisionMs = Math.max(
        this.nextDecisionMs + this.profile.decisionIntervalMs,
        frame.nowMs,
      );
    }
    const { motion, stress } = frame.flight;
    return this.hands.fly({
      flown: { ship: motion, motion, stress, dial: frame.dial },
      nowMs: frame.nowMs,
      deltaMs: frame.deltaMs,
      worldSize: frame.worldSize,
    });
  }

  /**
   * Tell the pilot a cycle committed on its ship (as PlayerFlightPilot).
   * @param started - The maneuver the new cycle started.
   */
  onCycleCommitted(started: ManeuverDirection): void {
    this.hands.onCycleCommitted(started);
  }

  /** Forget everything (new round / respawn): memory, hands, perception. */
  reset(): void {
    this.bot = this.options.bot ?? createBot(this.tier, this.profile);
    this.hands = new PilotHands();
    this.history = null;
    this.nextDecisionMs = null;
    this.aceMemory = createAceMemory();
  }

  /**
   * One decision: build the delayed view and hand the bot's intent to the hands.
   * @param frame - This frame.
   * @param history - Perception history.
   */
  private decide(frame: BotFlightFrame, history: SnapshotHistory): void {
    const { self } = frame;
    const others = history.perceive(
      frame.nowMs,
      this.profile.reactionMs,
      self.id,
    );
    const view = {
      nowMs: frame.nowMs,
      worldSize: frame.worldSize,
      self: ownShipView({
        self,
        flight: frame.flight,
        dial: frame.dial,
        maneuverable: canHullKTurn(self.definitionId),
        holdLeftMs: this.hands.analogHoldLeftMs(),
      }),
      allies: others.filter((s) => s.side === self.side),
      enemies: others.filter((s) => s.side !== self.side),
      order: frame.order ?? null,
    };
    const aceView =
      ACE_BOT_POLICY && self.isAce && !frame.safePoint
        ? aceStrikeView(view)
        : view;
    const decided = this.bot.decide(aceView, this.random);
    const intent =
      aceView === view
        ? decided
        : aceStrikeIntent(aceView, decided, this.aceMemory);
    this.hands.setIntent(
      frame.safePoint ? escapeIntent(intent, view.self, frame) : intent,
    );
  }

  /**
   * @param worldSize - Torus edge (px).
   * @returns The perception history (created on first use).
   */
  private historyFor(worldSize: number): SnapshotHistory {
    this.history ??= new SnapshotHistory(this.profile.reactionMs, worldSize);
    return this.history;
  }
}

/**
 * The bot's intent turned into a hazard escape: it steers for the safe point
 * (no specials, no dash) and keeps shooting whatever it was targeting. The
 * turn is judged from where the maneuver in flight ends (the next one starts
 * there): judged from the current pose, a ship with the point dead astern
 * queued the opposite of the turn it was flying, cycle after cycle, and
 * weaved straight into the hazard.
 *
 * @param intent - What the bot decided.
 * @param self - Its own ship.
 * @param frame - This frame (with the safe point).
 * @returns The escape intent.
 */
function escapeIntent(
  intent: PilotIntent,
  self: OwnShipView,
  frame: BotFlightFrame,
): PilotIntent {
  const point = frame.safePoint ?? self;
  const error = offNoseDeg(self.endPose, point, frame.worldSize);
  return {
    ...IDLE_INTENT,
    maneuver: steerForError(error, ESCAPE_STEER, self.isStressed),
    targetId: intent.targetId,
  };
}
