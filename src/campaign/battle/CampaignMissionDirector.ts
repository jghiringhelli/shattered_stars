/**
 * CampaignMissionDirector — runs a compiled mission inside the Campaign
 * battle scene: spawns objective entities and allied squadrons, drives the
 * mission runtime (objectives, script, hazards) and the hero powers, moves
 * scripted entities, executes script actions (comms, waves, banners, music)
 * and owns the campaign HUD extras (comms, power bar, world markers). The
 * scene talks to it through a {@link CampaignBattleBridge}.
 */

import type { FactionId } from "../../config";
import type {
  MissionOutcome,
  ObjectiveDefinition,
  ObjectivePoint,
} from "../../arcade/objectives";
import {
  CampaignMissionRuntime,
  type RuntimeShip,
} from "../../arcade/systems/CampaignMissionRuntime";
import {
  CampaignHeroPowers,
  type PowerHost,
} from "../../arcade/systems/CampaignHeroPowers";
import type { CampaignShipBonuses } from "../armory/bonusTypes";
import type { MissionPlan } from "../mission/compileMission";
import { HeroPowerInput } from "../powers/HeroPowerInput";
import type { PowerWorld } from "../powers/heroPowerEffects";
import type { CampaignSaveData } from "../save/campaignSaveTypes";
import type { ScriptAction } from "../scripting/scriptTypes";
import type { DebriefLine } from "../../data/campaign/campaignTypes";
import { InputManager } from "../../input/InputManager";
import { audioManager } from "../../audio/AudioManager";
import { campaignStingerTrack } from "../../audio/musicContexts";
import type { ContactHudState } from "../../ui/hud/types";
import type { ObjectiveProgress } from "../../ui/modeHud/objectiveRows";
import type { ZoomCameraLike } from "../../ui/modeHud/screenSpace";
import { HeroPowerBar } from "../../ui/campaign/HeroPowerBar";
import { MissionCommsView } from "../../ui/campaign/MissionCommsView";
import { ObjectiveWorldView } from "../../ui/campaign/ObjectiveWorldView";
import type { BattleShipView, CampaignBattleBridge } from "./battleTypes";
import { createPowerHost } from "./CampaignPowerHost";
import { markerContacts, trackerProgress } from "./hudAdapters";
import {
  allySpawnRequests,
  groupSpawnRequests,
  objectiveSpawnRequest,
  objectiveWeight,
} from "./missionSpawns";

/** Inputs of a director. */
export interface DirectorConfig {
  readonly bridge: CampaignBattleBridge;
  readonly plan: MissionPlan;
  readonly save: CampaignSaveData;
  readonly bonuses: CampaignShipBonuses;
  /** Player squad start point (allies deploy beside it). */
  readonly playerStart: ObjectivePoint;
  /** Faction of scripted enemy waves that name none. */
  readonly enemyFaction: FactionId;
}

export class CampaignMissionDirector {
  readonly runtime: CampaignMissionRuntime;
  readonly powers: CampaignHeroPowers;
  private comms: MissionCommsView | null = null;
  private worldView: ObjectiveWorldView | null = null;
  private powerBar: HeroPowerBar | null = null;
  private readonly host: PowerHost;
  private readonly bridge: CampaignBattleBridge;
  private posed = new Set<string>();
  private readonly expiries = new Map<string, number>();
  private sequence = 0;

  /** @param config - Bridge, plan, save and bonuses. */
  constructor(private readonly config: DirectorConfig) {
    this.bridge = config.bridge;
    this.runtime = new CampaignMissionRuntime(
      config.plan,
      config.save.storyFlags,
      config.bridge.worldSize,
    );
    this.powers = new CampaignHeroPowers(
      config.bridge.factionId,
      config.save.heroPowerRanks,
      config.bonuses.powerCooldownMultiplier,
      new HeroPowerInput(InputManager),
    );
    this.host = createPowerHost({
      bridge: this.bridge,
      addHazard: (def) => this.runtime.addHazard(def),
      nextId: () => ++this.sequence,
    });
  }

  /** Comms lines shown so far (debug / tests). */
  get commsHistory(): readonly { speaker: string; text: string }[] {
    return this.comms?.history ?? [];
  }

  /** Hero power slots as the HUD shows them (debug / tests). */
  get powerReadout(): HeroPowerBar["readout"] {
    return this.powerBar?.readout ?? [];
  }

  /** Builds views, listens for V/B, deploys objective entities and allies. */
  create(): void {
    const scene = this.bridge.scene;
    this.worldView = new ObjectiveWorldView(scene);
    this.comms = new MissionCommsView(scene);
    this.powerBar = new HeroPowerBar(scene, this.bridge.factionId);
    this.powers.attach();
    for (const spawn of this.runtime.initialSpawns()) {
      this.spawn(objectiveSpawnRequest(spawn, this.bridge.factionId));
    }
    for (const ally of this.config.plan.allies) {
      for (const r of allySpawnRequests(
        ally,
        this.config.playerStart,
        this.bridge.factionId,
      ))
        this.spawn(r);
    }
  }

  /** Releases input and views. */
  destroy(): void {
    this.powers.detach();
    this.comms?.destroy();
    this.worldView?.destroy();
    this.powerBar?.destroy();
    this.comms = null;
    this.worldView = null;
    this.powerBar = null;
  }

  /**
   * Per frame (never stubbed): clock, scripted poses, powers, expiries, views.
   *
   * @param nowMs - Scene time.
   * @param deltaMs - Frame length.
   */
  update(nowMs: number, deltaMs: number): void {
    this.runtime.tick(deltaMs);
    this.applyPoses();
    const cast = this.powers.update(
      { nowMs, deltaMs, world: this.powerWorld() },
      this.host,
    );
    cast.forEach((id) =>
      this.powerBar?.flash(
        this.powers.slots.findIndex((s) => s.power.id === id),
      ),
    );
    for (const [id, until] of this.expiries) {
      if (nowMs < until) continue;
      this.expiries.delete(id);
      this.bridge.remove(id);
    }
    this.comms?.update(nowMs);
    this.powerBar?.update(this.powers.slots);
    this.worldView?.draw(this.runtime.markers(), this.runtime.hazardVisuals());
  }

  /** Script and hazards for one frame (the scene's delayed-spawn step). */
  stepScript(deltaMs: number): void {
    const ships = this.runtimeShips();
    const { sceneActions, newSpawns } = this.runtime.stepScript(ships);
    for (const spawn of newSpawns)
      this.spawn(objectiveSpawnRequest(spawn, this.bridge.factionId));
    for (const action of sceneActions) this.perform(action);
    for (const effect of this.runtime.stepHazards(ships, deltaMs)) {
      const ship = this.bridge.ship(effect.shipId);
      if (!ship) continue;
      if (effect.shieldDrain > 0)
        this.bridge.setShields(
          ship.id,
          Math.max(0, ship.shields - effect.shieldDrain),
        );
      if (effect.stress > 0) this.bridge.addStress(ship.id, effect.stress);
      if (effect.hullDamage > 0)
        this.bridge.damage(ship.id, effect.hullDamage, false);
    }
  }

  /**
   * @param deltaMs - Frame length.
   * @returns The mission outcome after this frame's objective step.
   */
  stepObjectives(deltaMs: number): MissionOutcome {
    return this.runtime.stepObjectives(
      this.runtimeShips(),
      this.bridge.flagship()?.id ?? null,
      deltaMs,
    );
  }

  /** @param ship - A ship just destroyed. */
  recordDestroyed(ship: BattleShipView): void {
    this.expiries.delete(ship.id);
    this.runtime.recordDestroyed({
      shipId: ship.id,
      side: ship.owner === "player" ? "player" : "enemy",
      tags: ship.tags,
      x: ship.x,
      y: ship.y,
    });
  }

  /** @param shipId - A ship that boosted or barrel-rolled. */
  recordEvasive(shipId: string): void {
    this.runtime.recordEvasive(shipId);
  }

  /**
   * @param ship - A ship.
   * @returns Whether an objective moves it (no pilot, no flight engine).
   */
  isScripted(ship: BattleShipView): boolean {
    return ship.scripted || this.posed.has(ship.id);
  }

  /** @returns Objective markers as radar / edge-arrow contacts. */
  contacts(): ContactHudState[] {
    return markerContacts(this.runtime.markers());
  }

  /** @returns Objective tracker rows. */
  tracker(): ObjectiveProgress[] {
    return trackerProgress(this.runtime.trackerRows());
  }

  /** @returns Bonus objectives, story flags to save and the on-win debrief lines. */
  finalizeVictory(): {
    bonuses: ObjectiveDefinition[];
    storyFlags: Readonly<Record<string, boolean>>;
    victoryLines: DebriefLine[];
  } {
    return this.runtime.finalizeVictory();
  }

  /** Debug fast-forward: completes every required objective (e2e). */
  debugWin(): void {
    this.runtime.debugCompleteRequired();
  }

  /** @param visible - Show/hide the campaign HUD extras. */
  setVisible(visible: boolean): void {
    this.comms?.setVisible(visible);
    this.powerBar?.setVisible(visible);
    this.worldView?.setVisible(visible);
  }

  /** @param camera - Scene camera (screen widgets stay 1:1). */
  sync(camera: ZoomCameraLike): void {
    this.comms?.sync(camera);
    this.powerBar?.sync(camera);
  }

  private spawn(request: Parameters<CampaignBattleBridge["spawn"]>[0]): void {
    this.bridge.spawn(request);
    if (request.lifetimeMs !== null) {
      this.expiries.set(
        request.id,
        this.bridge.scene.time.now + request.lifetimeMs,
      );
    }
  }

  private perform(action: ScriptAction): void {
    switch (action.do) {
      case "say":
        this.comms?.say({
          speaker: action.speaker,
          portraitKey: action.portraitKey,
          text: action.text,
          mood: action.mood,
        });
        return;
      case "banner":
        this.bridge.banner(action.title, action.subtitle);
        return;
      case "music": {
        const { cue } = action;
        const stinger = campaignStingerTrack(cue);
        if (stinger) audioManager.playMusic(stinger);
        else if (cue === "victory")
          audioManager.playFactionStinger(this.bridge.factionId, "victory");
        else if (cue === "tension") audioManager.playMusic("tension_alert");
        else if (cue === "tactical" || cue === "combat" || cue === "boss")
          audioManager.playFactionMusic(this.bridge.factionId, cue);
        return;
      }
      case "spawn": {
        const flagship = this.bridge.flagship() ?? {
          ...this.config.playerStart,
          angle: 0,
        };
        const ctx = {
          flagship,
          sequence: ++this.sequence,
          playerFaction: this.bridge.factionId,
          enemyFaction: this.config.enemyFaction,
        };
        for (const r of groupSpawnRequests(action.group, ctx)) this.spawn(r);
        return;
      }
      default:
        return;
    }
  }

  private applyPoses(): void {
    const poses = this.runtime.poses();
    this.posed = new Set(poses.map((p) => p.id));
    for (const p of poses)
      if (this.bridge.ship(p.id)) this.bridge.setPose(p.id, p.x, p.y, p.angle);
  }

  private runtimeShips(): RuntimeShip[] {
    return [...this.bridge.ships()]
      .filter((s) => s.hull > 0)
      .map((s) => ({
        id: s.id,
        side: s.owner === "player" ? "player" : "enemy",
        x: s.x,
        y: s.y,
        hull: s.hull,
        maxHull: s.maxHull,
        weight: objectiveWeight(s.definitionId),
        tags: s.tags,
        stressed: s.flight.stress.isStressed,
      }));
  }

  private powerWorld(): PowerWorld | null {
    const flagship = this.bridge.flagship();
    if (!flagship || flagship.hull <= 0) return null;
    const view = (s: BattleShipView) => ({
      id: s.id,
      side: s.owner === "player" ? ("player" as const) : ("enemy" as const),
      x: s.x,
      y: s.y,
      angle: s.angle,
    });
    return {
      flagship: view(flagship),
      ships: [...this.bridge.ships()].filter((s) => s.hull > 0).map(view),
      focusTargetId: this.bridge.focusTargetId(),
      worldSize: this.bridge.worldSize,
    };
  }
}
