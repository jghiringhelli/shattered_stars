/**
 * onlineGraph — the StateGraph options every online battle scene snapshots
 * with: Phaser objects (sprites, scenes, cameras, tweens) stay live and are
 * never serialized, and the common frozen defaults keep their identity.
 */

import Phaser from "phaser";
import type { GraphOptions } from "../../net/lockstep/StateGraph";
import { DeterministicRng } from "../../net/lockstep/DeterministicRng";
import { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import { NEUTRAL_MODIFIERS } from "../../core/CombatModifiers";
import { INITIAL_STRESS } from "../../arcade/ArcadeStress";
import { INITIAL_PILOT_CONTROL } from "../../arcade/systems/PilotFlightControls";
import { NO_SQUAD_MARKS } from "../../arcade/systems/SquadMark";
import {
  BotPilot,
  PilotHands,
  SnapshotHistory,
  SquadCommand,
} from "../../arcade/ai";

/**
 * @param value - An object in the simulation graph.
 * @returns Whether it is a Phaser object (presentation, kept live).
 */
function isPhaserObject(value: object): boolean {
  return (
    value instanceof Phaser.Events.EventEmitter ||
    value instanceof Phaser.Scene ||
    value instanceof Phaser.Game
  );
}

/** Graph options shared by DogfightScene and ArcadeBattleScene. */
export const ONLINE_GRAPH_OPTIONS: GraphOptions = {
  isOpaque: isPhaserObject,
  classes: [
    DeterministicRng,
    HitImmunityLedger,
    BotPilot,
    SquadCommand,
    SnapshotHistory,
    PilotHands,
  ],
  constants: [
    NEUTRAL_MODIFIERS,
    INITIAL_STRESS,
    INITIAL_PILOT_CONTROL,
    NO_SQUAD_MARKS,
  ],
};
