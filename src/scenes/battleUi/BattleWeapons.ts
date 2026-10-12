/**
 * BattleWeapons — the Phaser-side glue of the shared secondary-weapons
 * runtime, identical in every battle scene:
 * - equips each ship's arsenal from its quick build;
 * - reads the human's FIRE_SECONDARY (Shift+Space / tap / pad X),
 *   WEAPON_CYCLE (Tab / RB) and CLOAK (C) and flashes why a press was
 *   refused (PilotFeedback);
 * - runs the runtime once per frame with the bots' ordnance decider,
 *   draws shots, devices and effects (SecondaryWeaponsView) and hands every
 *   hit to the scene's own damage path (shields, then hull);
 * - builds the weapon-bar slots and shows cloaks on the ships' sprites.
 *
 * The scene only supplies a {@link BattleWeaponsLink}.
 */

import Phaser from "phaser";
import { decideOrdnance } from "../../arcade/ai/OrdnanceDecision";
import type { HitImmunityLedger } from "../../arcade/systems/CombatTempo";
import type { FlightRefusal } from "../../arcade/systems/FlightCapabilities";
import type { SecondaryWeapons } from "../../arcade/weapons/SecondaryWeapons";
import {
  WeaponsDriver,
  type WeaponHit,
  type WeaponsLoadout,
} from "../../arcade/weapons/WeaponsDriver";
import type { FireOutcome, WeaponBody } from "../../arcade/weapons/weaponTypes";
import type { ActionIntent, InputEvent } from "../../input/InputTypes";
import { SecondaryWeaponsView } from "../../rendering/SecondaryWeaponsView";
import type { WeaponSlotDescriptor } from "../../ui/hud/types";
import { PilotFeedback } from "./PilotFeedback";
import {
  cloakRefusalLabel,
  fireOutcomeLabel,
  refusalLabel,
  secondaryWeaponSlots,
} from "./weaponHud";

export type { WeaponHit, WeaponsLoadout };

/** What the glue reads from (and asks of) its scene. */
export interface BattleWeaponsLink {
  /** Every ship as the weapons see it. */
  bodies(): Iterable<WeaponBody>;
  /** The enemy this ship's pilot wants (HUD target / bot target). */
  wantedTargetOf(shipId: string): string | null;
  /** The ship the human flies now, or null. */
  playerShipId(): string | null;
  /** The human's side key (friendly colours). */
  playerSide(): string;
  /** A ship's side key, or null when unknown. */
  sideOf(shipId: string): string | null;
  /** Apply a hit through the scene's damage path (shields, then hull). */
  applyHit(hit: WeaponHit): void;
  /** True for ships a bot flies (default: every ship but the player's). */
  isBotControlled?(shipId: string): boolean;
  /** The ship's sprite, faded while it is cloaked. */
  spriteOf?(shipId: string): { setAlpha(alpha: number): unknown } | undefined;
}

/** The slice of InputManager the glue needs. */
export interface WeaponIntentSource {
  onAny(callback: (event: InputEvent) => void): number;
  off(subscriptionId: number): boolean;
}

/** How a battle's weapons are set up. */
export interface BattleWeaponsConfig {
  readonly worldSize: number;
  readonly ledger: HitImmunityLedger;
  readonly random: () => number;
  /** Human input (InputManager); omit for AI-only battles. */
  readonly input?: WeaponIntentSource;
}

const WEAPON_INTENTS: ReadonlySet<ActionIntent> = new Set<ActionIntent>([
  "FIRE_SECONDARY",
  "WEAPON_CYCLE",
  "CLOAK",
]);
/** Sprite alpha of a cloaked ship. */
const CLOAKED_ALPHA = 0.3;

export class BattleWeapons {
  readonly feedback: PilotFeedback;
  private readonly driver: WeaponsDriver;
  private readonly view: SecondaryWeaponsView;
  private pressed = new Set<ActionIntent>();
  private subscription: number | null = null;

  /**
   * @param scene - The battle scene.
   * @param link - What the glue reads from its scene.
   * @param config - World size, tempo ledger, dice and input.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly link: BattleWeaponsLink,
    private readonly config: BattleWeaponsConfig,
  ) {
    this.driver = new WeaponsDriver(
      {
        bodies: () => link.bodies(),
        wantedTargetOf: (id) => link.wantedTargetOf(id),
        applyHit: (hit) => link.applyHit(hit),
        isBotControlled: (id) =>
          link.isBotControlled?.(id) ?? id !== link.playerShipId(),
      },
      {
        worldSize: config.worldSize,
        ledger: config.ledger,
        random: config.random,
        decide: decideOrdnance,
      },
    );
    this.feedback = new PilotFeedback(scene);
    this.view = new SecondaryWeaponsView(scene, {
      playerSide: () => link.playerSide(),
      sideOf: (id) => link.sideOf(id),
    });
  }

  /** The shared runtime (e2e, HUD). */
  get runtime(): SecondaryWeapons {
    return this.driver.runtime;
  }

  /** The player's last FIRE_SECONDARY outcome, held launches included (e2e), or null. */
  get lastFireOutcome(): FireOutcome | null {
    const playerId = this.link.playerShipId();
    return playerId ? this.driver.lastOutcomeOf(playerId) : null;
  }

  /** @returns The ship the human flies (e2e / HUD), or null. */
  playerShipId(): string | null {
    return this.link.playerShipId();
  }

  /** @returns Every ship as the weapons see it (e2e). */
  bodies(): WeaponBody[] {
    return [...this.link.bodies()];
  }

  /** Start listening to the human's weapon keys. */
  attach(): void {
    if (this.subscription !== null || !this.config.input) return;
    this.subscription = this.config.input.onAny((event) => {
      if (WEAPON_INTENTS.has(event.intent)) this.pressed.add(event.intent);
    });
  }

  /** Stop listening and remove everything from the field. */
  destroy(): void {
    if (this.subscription !== null) this.config.input?.off(this.subscription);
    this.subscription = null;
    this.pressed.clear();
    this.runtime.clear();
    this.view.destroy();
    this.feedback.reset();
  }

  /**
   * Arm a ship from its quick build.
   * @param shipId - The ship.
   * @param loadout - Hull, quick build and modifier sheet.
   */
  equip(shipId: string, loadout: WeaponsLoadout): void {
    this.driver.equip(shipId, loadout);
  }

  /** @param shipId - A ship destroyed or removed. */
  forget(shipId: string): void {
    this.driver.forget(shipId);
  }

  /**
   * One frame: the human's weapon keys, the runtime, effects and hits.
   * @param deltaMs - Frame length (ms).
   * @param nowMs - Battle time (ms).
   */
  update(deltaMs: number, nowMs: number): void {
    this.handleInput(nowMs);
    const events = this.driver.update(deltaMs, nowMs);
    this.view.play(events);
    for (const event of events) {
      if (event.kind === "cloak") this.showCloak(event.shipId, event.cloaked);
    }
    this.view.sync(
      this.runtime.shotsInFlight,
      this.runtime.devicesOnField,
      nowMs,
    );
  }

  /** @returns Weapon-bar slots of the player's ship (secondaries, turret). */
  hudSlots(): WeaponSlotDescriptor[] {
    const playerId = this.link.playerShipId();
    return secondaryWeaponSlots(
      playerId ? this.runtime.arsenalOf(playerId) : null,
    );
  }

  /**
   * @param shipId - A ship.
   * @returns Damage factor its cloak gives against every hit (1 = none).
   */
  incomingDamageFactor(shipId: string): number {
    return this.driver.incomingDamageFactor(shipId);
  }

  /** @param shipId - A ship that attacked (its cloak drops). */
  onAttack(shipId: string): void {
    this.driver.onAttack(shipId);
  }

  /**
   * Flash why the player's maneuvers were refused this frame.
   * @param refusals - Refusals from the pilot flight controls.
   * @param at - The player's ship.
   */
  showRefusals(
    refusals: readonly FlightRefusal[],
    at: { readonly x: number; readonly y: number },
  ): void {
    for (const refusal of refusals) {
      this.feedback.show(
        refusalLabel(refusal),
        at.x,
        at.y,
        this.scene.time.now,
      );
    }
  }

  private handleInput(nowMs: number): void {
    const pressed = this.pressed;
    this.pressed = new Set();
    const playerId = this.link.playerShipId();
    if (!playerId) return;
    this.pilotKeys(playerId, (intent) => pressed.has(intent), nowMs, true);
  }

  /**
   * One pilot's weapon keys (WEAPON_CYCLE, CLOAK, FIRE_SECONDARY) for any
   * ship a human flies — online every seat's keys arrive this way, from the
   * lockstep input; offline the attached input source feeds the player's.
   *
   * @param shipId - The human's ship.
   * @param pressed - Whether a weapon key was pressed this tick.
   * @param nowMs - Battle time (ms).
   * @param showFeedback - Flash refusals (the local pilot only).
   */
  pilotKeys(
    shipId: string,
    pressed: (intent: ActionIntent) => boolean,
    nowMs: number,
    showFeedback: boolean,
  ): void {
    if (pressed("WEAPON_CYCLE")) this.runtime.cycleWeapon(shipId);
    if (pressed("CLOAK")) this.toggleCloak(shipId, showFeedback);
    if (!pressed("FIRE_SECONDARY")) return;
    const outcome = this.driver.fire(shipId, nowMs);
    if (showFeedback) this.flash(shipId, fireOutcomeLabel(outcome));
  }

  /** The Phaser-free driver (runtime, held launches) — snapshotted online. */
  get simulation(): WeaponsDriver {
    return this.driver;
  }

  /** CLOAK for a ship, saying why when it cannot. */
  private toggleCloak(shipId: string, showFeedback: boolean): void {
    const cloak = this.runtime.arsenalOf(shipId)?.cloak ?? null;
    const wasCloaked = this.runtime.isCloaked(shipId);
    if (this.runtime.toggleCloak(shipId) || wasCloaked) return;
    if (showFeedback) this.flash(shipId, cloakRefusalLabel(cloak));
  }

  private flash(shipId: string, label: string | null): void {
    const self = [...this.link.bodies()].find((body) => body.id === shipId);
    if (label && self) {
      this.feedback.show(label, self.x, self.y, this.scene.time.now);
    }
  }

  private showCloak(shipId: string, cloaked: boolean): void {
    this.link.spriteOf?.(shipId)?.setAlpha(cloaked ? CLOAKED_ALPHA : 1);
  }
}
