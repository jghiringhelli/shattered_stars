/**
 * SceneCreatures — the creature layer of a battle scene (Survival, Campaign):
 * the shared {@link CreatureHost} that steps every creature through the
 * mode's own damage path, one {@link CreatureView} and telegraph layer per
 * creature, the boss bar of the first boss creature, and the cues — audio
 * (a rising warble on every wind-up, a growl when a power lands), floating
 * text for destroyed parts, phase-shifts and feeding, a banner on a new
 * phase, and the boss's final-phase music cue. The scene supplies ships,
 * damage, spawning and its message banner through {@link SceneCreatureBridge}.
 */

import type Phaser from "phaser";
import {
  CreatureHost,
  type CreatureHostBridge,
  type CreatureHostShip,
} from "../../arcade/creatures/CreatureHost";
import type { CreatureEventKind } from "../../arcade/creatures/CreatureWorld";
import { audioManager } from "../../audio/AudioManager";
import type { EffectsManager } from "../../rendering/EffectsManager";
import { CreatureBossBar } from "./CreatureBossBar";
import { CreatureTelegraphLayer } from "./CreatureTelegraphLayer";
import { CreatureView, type CreatureContainer } from "./CreatureView";

/** What the scene gives its creature layer beyond the host bridge. */
export interface SceneCreatureBridge<S extends CreatureHostShip> extends Omit<
  CreatureHostBridge<S>,
  "event"
> {
  effects(): EffectsManager;
}

const TELEGRAPH_VOLUME = 0.5;
const ROAR_VOLUME = 0.7;
const FLOAT_LIFT_PX = 40;
const PART_COLOR = "#ff8800";
const FEED_COLOR = "#a8d848";
const SHIFT_COLOR = "#c8a8ff";

interface CreatureLayers {
  readonly view: CreatureView;
  readonly telegraph: CreatureTelegraphLayer;
}

/** Views, telegraphs, bar and cues of one scene's creatures. */
export class SceneCreatures<S extends CreatureHostShip> {
  private readonly host: CreatureHost<S>;
  private readonly layers = new Map<string, CreatureLayers>();
  private bar: CreatureBossBar | null = null;
  private barShip: S | null = null;
  private finalPhaseCued = false;

  /**
   * @param scene - The battle scene.
   * @param bridge - The scene's ship, damage and spawn path.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: SceneCreatureBridge<S>,
  ) {
    this.host = new CreatureHost<S>({
      ...bridge,
      event: (ship, kind, label, x, y) => this.cue(ship, kind, label, x, y),
    });
  }

  /**
   * Gives a creature ship its body, telegraph layer and (for the first boss)
   * the boss bar.
   *
   * @param ship - The creature's ship record.
   * @returns The sprite container the scene keeps like a ship sprite.
   */
  register(ship: S): CreatureContainer {
    const encounter = ship.creature!;
    const view = new CreatureView(this.scene, encounter, ship.id);
    this.layers.set(ship.id, {
      view,
      telegraph: new CreatureTelegraphLayer(this.scene),
    });
    if (ship.isBossCreature && !this.bar) {
      this.bar = new CreatureBossBar(
        this.scene,
        encounter.definition.name.toUpperCase(),
      );
      this.barShip = ship;
    }
    return view.container;
  }

  /**
   * One frame: the creatures act, then their visuals follow.
   *
   * @param nowMs - Sim time (ms).
   * @param deltaMs - Frame length (ms).
   */
  update(nowMs: number, deltaMs: number): void {
    this.host.step(nowMs, deltaMs);
    for (const [shipId, layer] of this.layers) {
      const ship = this.shipOf(shipId);
      const encounter = ship?.creature;
      if (!ship || !encounter) continue;
      layer.view.update(nowMs);
      layer.telegraph.update(encounter, nowMs);
    }
    const bossShip = this.barShip;
    if (bossShip?.creature && bossShip.hull > 0) {
      this.bar?.update(bossShip.creature, bossShip, nowMs);
      this.bar?.sync(this.scene.cameras.main);
    }
  }

  /** @param victim - A ship that died (a wreck to feed on). */
  noteWreck(victim: Pick<S, "x" | "y">): void {
    this.host.noteWreck(victim);
  }

  /** @param shipId - A creature ship that was destroyed or removed. */
  remove(shipId: string): void {
    const layer = this.layers.get(shipId);
    if (!layer) return;
    layer.telegraph.destroy();
    layer.view.destroy();
    this.layers.delete(shipId);
    this.host.forget(shipId);
    if (this.barShip?.id !== shipId) return;
    this.bar?.destroy();
    this.bar = null;
    this.barShip = null;
  }

  /** Removes every creature visual (scene shutdown / restart). */
  destroy(): void {
    for (const id of [...this.layers.keys()]) this.remove(id);
    this.finalPhaseCued = false;
  }

  /** @returns True when a boss creature is on the field. */
  get hasBoss(): boolean {
    return this.bar !== null;
  }

  private shipOf(shipId: string): S | undefined {
    for (const ship of this.bridge.ships()) if (ship.id === shipId) return ship;
    return undefined;
  }

  private cue(
    ship: S,
    kind: CreatureEventKind,
    label: string,
    x: number,
    y: number,
  ): void {
    const float = (text: string, color: string): void =>
      this.bridge.effects().showFloatingText(x, y - FLOAT_LIFT_PX, text, color);
    switch (kind) {
      case "telegraph":
        audioManager.playSoundAt("creature_telegraph", x, y, TELEGRAPH_VOLUME);
        break;
      case "power":
        audioManager.playSoundAt("creature_roar", x, y, ROAR_VOLUME);
        break;
      case "part_destroyed":
        audioManager.playSoundAt("explosion_small", x, y, TELEGRAPH_VOLUME);
        float(`${label.toUpperCase()} DESTROYED`, PART_COLOR);
        break;
      case "phase_shift":
        float("PHASE-SHIFT", SHIFT_COLOR);
        break;
      case "feed":
        float("FEEDING — hit it to break the meal", FEED_COLOR);
        break;
      case "phase":
        this.phaseCue(ship, label);
        break;
      case "feed_broken":
        break;
    }
  }

  private phaseCue(ship: S, phaseName: string): void {
    audioManager.playSoundAt("creature_roar", ship.x, ship.y, ROAR_VOLUME);
    this.bridge
      .effects()
      .showFloatingText(
        ship.x,
        ship.y - FLOAT_LIFT_PX,
        `PHASE: ${phaseName}`,
        PART_COLOR,
      );
    const encounter = ship.creature!;
    const isFinal = encounter.phaseIndex + 1 >= encounter.phaseCount;
    if (!ship.isBossCreature || !isFinal || this.finalPhaseCued) return;
    this.finalPhaseCued = true;
    audioManager.setBossFinalPhase(true);
  }
}
