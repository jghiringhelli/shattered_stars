/**
 * CampaignMissionRuntime — runs one compiled campaign mission inside a
 * battle: objective states, the declarative script, hazards and the mission
 * clock. The scene feeds it ships and events and executes the actions it
 * hands back (dialogue, spawns, banners, music); objective, flag and hazard
 * actions are applied here. No Phaser — unit tested on its own.
 */

import {
  completedBonusIds,
  createObjectiveState,
  finalizeOnVictory,
  forceObjectiveStatus,
  missionOutcome,
  objectiveMarkers,
  objectivePoses,
  objectiveReadout,
  objectiveSpawns,
  revealObjectiveState,
  stepObjectiveState,
  type EntityPose,
  type EntitySpawn,
  type MissionOutcome,
  type ObjectiveDefinition,
  type ObjectiveEvent,
  type ObjectiveMarker,
  type ObjectiveShip,
  type ObjectiveState,
  type ObjectiveStatus,
} from "../objectives";
import type { MissionPlan } from "../../campaign/mission/compileMission";
import type { DebriefLine } from "../../data/campaign/campaignTypes";
import {
  createScriptState,
  stepScript,
  type ScriptDestroyed,
  type ScriptState,
} from "../../campaign/scripting/ScriptInterpreter";
import type { ScriptAction } from "../../campaign/scripting/scriptTypes";
import {
  addHazard,
  createHazardState,
  hazardVisuals,
  setHazardActive,
  stepHazards,
  type HazardState,
} from "../../campaign/hazards/hazardModel";
import type {
  HazardDefinition,
  HazardEffect,
  HazardVisual,
} from "../../campaign/hazards/hazardTypes";

/** A living ship as the runtime reads it. */
export type RuntimeShip = ObjectiveShip;

/** A destruction to report. */
export type RuntimeDestroyed = Omit<
  Extract<ObjectiveEvent, { kind: "destroyed" }>,
  "kind"
>;

/** One objective tracker row. */
export interface TrackerRow {
  readonly id: string;
  readonly description: string;
  readonly progressText: string;
  readonly status: ObjectiveStatus;
  readonly optional: boolean;
}

/** Script actions the scene performs. */
const SCENE_ACTIONS: ReadonlySet<ScriptAction["do"]> = new Set([
  "say",
  "spawn",
  "banner",
  "music",
]);

export class CampaignMissionRuntime {
  private objectiveStates: ObjectiveState[];
  private script: ScriptState;
  private hazards: HazardState;
  private clockMs = 0;
  private objectiveEvents: ObjectiveEvent[] = [];
  private scriptDestroyed: ScriptDestroyed[] = [];
  private readonly spawned = new Set<string>();

  /**
   * @param plan - Compiled mission.
   * @param storyFlags - Story flags of the save.
   * @param worldSize - Torus side.
   */
  constructor(
    plan: MissionPlan,
    storyFlags: Readonly<Record<string, boolean>>,
    private readonly worldSize: number,
  ) {
    this.objectiveStates = plan.objectives.map(createObjectiveState);
    this.script = createScriptState(plan.script, storyFlags);
    this.hazards = createHazardState(plan.hazards);
  }

  /** Mission time (ms). */
  get elapsedMs(): number {
    return this.clockMs;
  }

  /** Every objective state (hidden ones included). */
  get objectives(): readonly ObjectiveState[] {
    return this.objectiveStates;
  }

  /** @param deltaMs - Frame length to add to the mission clock. */
  tick(deltaMs: number): void {
    this.clockMs += deltaMs;
  }

  /** @returns Entities of the objectives visible at mission start. */
  initialSpawns(): EntitySpawn[] {
    return this.objectiveStates
      .filter((s) => !s.hidden)
      .flatMap((s) => this.spawnsOf(s.def));
  }

  /** @param event - A ship destroyed since the last frame. */
  recordDestroyed(event: RuntimeDestroyed): void {
    this.objectiveEvents.push({ kind: "destroyed", ...event });
    this.scriptDestroyed.push({
      shipId: event.shipId,
      side: event.side,
      tags: event.tags,
    });
  }

  /** @param shipId - A ship that boosted or barrel-rolled. */
  recordEvasive(shipId: string): void {
    this.objectiveEvents.push({ kind: "evasive", shipId });
  }

  /**
   * Steps every objective with the events since the last step.
   *
   * @param ships - Living ships.
   * @param flagshipId - The player's flagship.
   * @param deltaMs - Frame length.
   * @returns The mission outcome.
   */
  stepObjectives(
    ships: readonly RuntimeShip[],
    flagshipId: string | null,
    deltaMs = 0,
  ): MissionOutcome {
    const frame = {
      elapsedMs: this.clockMs,
      deltaMs,
      worldSize: this.worldSize,
      ships,
      events: this.objectiveEvents,
      flagshipId,
    };
    this.objectiveEvents = [];
    this.objectiveStates = this.objectiveStates.map((s) =>
      stepObjectiveState(s, frame),
    );
    return missionOutcome(this.objectiveStates);
  }

  /**
   * Runs the script one step and applies its objective/flag/hazard actions.
   *
   * @param ships - Living ships.
   * @returns Actions for the scene and entities newly needed.
   */
  stepScript(ships: readonly RuntimeShip[]): {
    sceneActions: ScriptAction[];
    newSpawns: EntitySpawn[];
  } {
    const { actions, newSpawns } = this.runScript(ships, false);
    return {
      sceneActions: actions.filter((a) => SCENE_ACTIONS.has(a.do)),
      newSpawns,
    };
  }

  /**
   * @param ships - Living ships.
   * @param victory - Whether this is the step that seals a won mission.
   * @returns Every action that fired, and entities newly needed.
   */
  private runScript(
    ships: readonly RuntimeShip[],
    victory: boolean,
  ): { actions: ScriptAction[]; newSpawns: EntitySpawn[] } {
    const result = stepScript(this.script, {
      elapsedMs: this.clockMs,
      objectives: this.objectiveStates.map((s) => ({
        id: s.def.id,
        status: s.status,
        hidden: s.hidden,
      })),
      destroyed: this.scriptDestroyed,
      ships,
      worldSize: this.worldSize,
      victory,
    });
    this.scriptDestroyed = [];
    this.script = result.state;
    const newSpawns = result.actions.flatMap((a) => this.applyAction(a));
    return { actions: result.actions, newSpawns };
  }

  /**
   * @param ships - Living ships.
   * @param deltaMs - Frame length.
   * @returns What hazards do to ships this frame.
   */
  stepHazards(ships: readonly RuntimeShip[], deltaMs: number): HazardEffect[] {
    const result = stepHazards(this.hazards, ships, deltaMs, this.worldSize);
    this.hazards = result.state;
    return result.effects;
  }

  /** @param def - A hazard added mid-battle (e.g. a power's minefield). */
  addHazard(def: HazardDefinition): void {
    this.hazards = addHazard(this.hazards, def);
  }

  /** @returns Poses objectives impose on their entities. */
  poses(): EntityPose[] {
    return this.objectiveStates
      .filter((s) => s.status === "active")
      .flatMap(objectivePoses);
  }

  /** @returns Markers of visible, active objectives. */
  markers(): ObjectiveMarker[] {
    return this.objectiveStates.flatMap(objectiveMarkers);
  }

  /** @returns Shapes of active hazards. */
  hazardVisuals(): HazardVisual[] {
    return hazardVisuals(this.hazards);
  }

  /** @returns Tracker rows of visible objectives, in mission order. */
  trackerRows(): TrackerRow[] {
    return this.objectiveStates
      .filter((s) => !s.hidden)
      .map((s) => ({
        id: s.def.id,
        description: s.def.description,
        progressText: objectiveReadout(s).progressText,
        status: s.status,
        optional: s.def.optional === true,
      }));
  }

  /**
   * @param id - Objective id.
   * @returns Its status, or undefined when unknown.
   */
  objectiveStatus(id: string): ObjectiveStatus | undefined {
    return this.objectiveStates.find((s) => s.def.id === id)?.status;
  }

  /**
   * Debug fast-forward: reveals and completes every required objective
   * (e2e / verify loop). The next objective step reports victory.
   */
  debugCompleteRequired(): void {
    this.objectiveStates = this.objectiveStates.map((s) =>
      s.def.optional === true ? s : forceObjectiveStatus(s, "completed"),
    );
  }

  /**
   * Seals a won mission: holding constraints complete and the on-win phase
   * runs (beats triggered by the winning completion and `victory` beats; they
   * may persist story flags).
   *
   * @returns Completed bonus objectives, the story flags to save, and the
   *   on-win dialogue that opens the debrief.
   */
  finalizeVictory(): {
    bonuses: ObjectiveDefinition[];
    storyFlags: Readonly<Record<string, boolean>>;
    victoryLines: DebriefLine[];
  } {
    this.objectiveStates = finalizeOnVictory(this.objectiveStates);
    const { actions } = this.runScript([], true);
    const ids = completedBonusIds(this.objectiveStates);
    return {
      bonuses: this.objectiveStates
        .filter((s) => ids.includes(s.def.id))
        .map((s) => s.def),
      storyFlags: this.script.storyFlags,
      victoryLines: actions.flatMap(
        (a): DebriefLine[] =>
          a.do === "say"
            ? [
                {
                  speaker: a.speaker,
                  portraitKey: a.portraitKey,
                  text: a.text,
                  ...(a.mood ? { mood: a.mood } : {}),
                },
              ]
            : [],
      ),
    };
  }

  /**
   * Applies a non-scene script action.
   *
   * @param action - The action.
   * @returns Entities it requires.
   */
  private applyAction(action: ScriptAction): EntitySpawn[] {
    switch (action.do) {
      case "addObjective": {
        const state = createObjectiveState(action.objective);
        this.objectiveStates = [...this.objectiveStates, state];
        return state.hidden ? [] : this.spawnsOf(state.def);
      }
      case "revealObjective":
        return this.updateObjective(action.objectiveId, revealObjectiveState);
      case "completeObjective":
        return this.updateObjective(action.objectiveId, (s) =>
          forceObjectiveStatus(s, "completed"),
        );
      case "failObjective":
        return this.updateObjective(action.objectiveId, (s) =>
          forceObjectiveStatus(s, "failed"),
        );
      case "hazard":
        this.hazards = setHazardActive(
          this.hazards,
          action.hazardId,
          action.active,
        );
        return [];
      default:
        return [];
    }
  }

  /**
   * @param id - Objective id.
   * @param change - State change.
   * @returns Entities of the objective if it just became visible.
   */
  private updateObjective(
    id: string,
    change: (s: ObjectiveState) => ObjectiveState,
  ): EntitySpawn[] {
    const spawns: EntitySpawn[] = [];
    this.objectiveStates = this.objectiveStates.map((s) => {
      if (s.def.id !== id) return s;
      const next = change(s);
      if (s.hidden && !next.hidden) spawns.push(...this.spawnsOf(next.def));
      return next;
    });
    return spawns;
  }

  /**
   * @param def - Objective definition.
   * @returns Its entities not spawned yet (each spawns once).
   */
  private spawnsOf(def: ObjectiveDefinition): EntitySpawn[] {
    if (this.spawned.has(def.id)) return [];
    this.spawned.add(def.id);
    return objectiveSpawns(def);
  }
}
