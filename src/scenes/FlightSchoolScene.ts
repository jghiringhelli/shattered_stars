/**
 * FlightSchoolScene — the scripted first-flight course (P0-2).
 *
 * Sixteen short lessons on the REAL flight engine (PlayerFlightPilot +
 * CycleFlight, the BattleHud, the shared primary-fire / dice / squad-mark
 * modules): throttle, drift on the 500 ms cycle, bank, hard turn, Snap turn,
 * Hook, Knife, boost, barrel roll, primary arc, secondary, mark, radar &
 * edge arrows, the status ring, then a fight against one novice bot. Each
 * lesson advances only when the player's actual flight state proves the
 * input (FlightSchoolSteps); prompts name the player's bound keys. Deaths
 * respawn (no fail state). Completion is saved (FlightSchoolProgress).
 * Keys: N skip lesson, ESC / gamepad B / right-click leave.
 */

import Phaser from "phaser";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../config";
import { tickCycleFlight } from "../arcade/systems/CycleFlight";
import { PlayerFlightPilot } from "../arcade/systems/PlayerFlightPilot";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import { audioManager } from "../audio/AudioManager";
import { boundKeyLabel } from "../input/boundKeyLabel";
import { InputManager } from "../input/InputManager";
import type { ActionIntent } from "../input/InputTypes";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import { EffectsManager } from "../rendering/EffectsManager";
import {
  trackDeath,
  trackModeEnd,
  trackModeStart,
  trackTutorialExit,
  trackTutorialStep,
} from "../telemetry/telemetry";
import {
  markFlightSchoolComplete,
  recordFlightSchoolStep,
} from "../tutorial/FlightSchoolProgress";
import {
  FLIGHT_SCHOOL_STEPS,
  advanceFlightSchool,
  currentStep,
  skipFlightSchoolStep,
  startFlightSchool,
  type FlightSchoolObservation,
  type FlightSchoolState,
} from "../tutorial/FlightSchoolSteps";
import { BattleHud } from "../ui/hud/BattleHud";
import { cameraViewFrom } from "../ui/hud/hudMath";
import {
  bindMenuBack,
  goToScene,
  playUiPress,
} from "../ui/menu/menuTransitions";
import { installBattleSpace } from "../rendering/spaceMap/installBattleSpace";
import { buildDuelHudSnapshot, playerTargetId } from "./duel/duelHudSnapshot";
import { LessonPanel } from "./flightSchool/LessonPanel";
import { SchoolCombat, type SchoolShot } from "./flightSchool/SchoolCombat";
import { SchoolField } from "./flightSchool/SchoolField";
import { setSchoolFlight, type SchoolShip } from "./flightSchool/schoolShips";
import type {
  BattleWeapons,
  BattleWeaponsLink,
  WeaponHit,
} from "./battleUi/BattleWeapons";
import { createSceneWeapons, weaponBodyOf } from "./battleUi/sceneWeapons";
import { NEUTRAL_MODIFIERS } from "../core/CombatModifiers";

/** Edge intents the lessons look at. */
const WATCHED: ReadonlySet<ActionIntent> = new Set(["CONFIRM"]);
/** The trainee's secondary: a rack of homing missiles (real ordnance). */
const TRAINING_ORDNANCE: readonly string[] = ["concussion_missile"];
const COMPLETE_TEXT =
  "You are cleared for combat, pilot.\nEvery key and button you learned can be rebound in Settings › Controls / Gamepad.\n\nPress ENTER or ESC to return to the menu.";

export class FlightSchoolScene extends Phaser.Scene {
  private readonly pilot = new PlayerFlightPilot(InputManager);
  private field!: SchoolField;
  private hud!: BattleHud;
  private panel!: LessonPanel;
  private effects!: EffectsManager;
  private readonly combat = new SchoolCombat();
  private machine: FlightSchoolState = startFlightSchool(0);
  private pressed = new Set<ActionIntent>();
  private subscriptions: number[] = [];
  private primaryHits = 0;
  private secondaryHits = 0;
  private finished = false;
  /** The shared secondary-weapons runtime (the lesson fires real missiles). */
  private weapons: BattleWeapons | null = null;

  constructor() {
    super({ key: "FlightSchoolScene" });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.cameras.main.setBackgroundColor(0x050510);
    installBattleSpace(this, { mapTheme: "prometheus_shadow" });
    audioManager.initialize();
    this.effects = new EffectsManager(this);
    this.field = new SchoolField(this);
    this.hud = new BattleHud(this, { worldSize: BATTLEFIELD_SIZE });
    this.panel = new LessonPanel(this);
    this.machine = startFlightSchool(this.time.now);
    this.primaryHits = 0;
    this.secondaryHits = 0;
    this.finished = false;
    this.weapons = createSceneWeapons(
      this,
      this.weaponsLink(),
      this.combat.tempoLedger,
    );
    this.armTrainee();
    this.setupInput();
    this.enterLesson();
    trackModeStart("flight_school");
    this.cameras.main.fadeIn(200);
  }

  /** The secondary-weapons glue (e2e). */
  get secondaryWeapons(): BattleWeapons | null {
    return this.weapons;
  }

  /** The step machine state (e2e / debugging). */
  get lessonState(): FlightSchoolState {
    return this.machine;
  }

  update(time: number, delta: number): void {
    InputManager.update();
    if (this.finished) return;
    this.flyPlayer(time, delta);
    this.flyBots(delta);
    this.tickShips(delta);
    if (this.pilot.takeMarkRequest()) this.markHudTarget();
    // Secondaries first: a held or chosen launch is this cycle's attack.
    this.weapons?.update(delta, time);
    this.combat
      .fire([...this.field.ships.values()], this.field.crew, {
        deltaMs: delta,
        nowMs: time,
      })
      .forEach((shot) => this.onShot(shot));
    const player = this.field.player;
    this.cameras.main.centerOn(player.x, player.y);
    this.updateHud();
    const control = player.flight.motion.control;
    this.panel.setBeat(
      control.maneuverProgress,
      control.currentManeuver,
      control.nextManeuver,
    );
    this.advanceLessons(time);
    this.pressed.clear();
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.pilot.attach();
    this.subscriptions = [
      InputManager.onAny((event) => {
        if (WATCHED.has(event.intent)) this.pressed.add(event.intent);
      }),
    ];
    const keyboard = this.input.keyboard;
    bindMenuBack(this, () => this.leave());
    keyboard?.on("keydown-N", () => this.skipLesson());
    keyboard?.on("keydown-ENTER", () => {
      if (this.finished) this.returnToMenu();
    });
  }

  private shutdown(): void {
    this.subscriptions.forEach((id) => InputManager.off(id));
    this.subscriptions = [];
    teardownSceneInput();
    this.pilot.detach();
    this.hud?.destroy();
    this.weapons?.destroy();
    this.weapons = null;
  }

  private flyPlayer(time: number, delta: number): void {
    const ship = this.field.player;
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.pilot.fly({
      flight: ship.flight,
      ship: ship.flight.motion,
      dial: ship.dial,
      nowMs: time,
      deltaMs: delta,
      worldSize: BATTLEFIELD_SIZE,
    });
    setSchoolFlight(ship, { motion: result.motion, stress: result.stress });
    this.weapons?.showRefusals(result.refusals, ship);
    for (const event of result.events)
      playFlightEventFx(this, {
        event,
        origin,
        definitionId: ship.definitionId,
        faction: ship.faction,
        sprite: ship.sprite ?? undefined,
        cameraShake: true,
        zoomPulse: false,
      });
  }

  private flyBots(delta: number): void {
    const crew = this.field.crew;
    if (!crew) return;
    const ships = [...this.field.ships.values()];
    const contacts = crew.contactsOf(ships);
    crew.command(contacts, this.time.now);
    for (const ship of ships) {
      if (ship.role !== "bot" || ship.hull <= 0) continue;
      const result = crew.fly(ship, contacts, this.time.now, delta);
      if (result)
        setSchoolFlight(ship, { motion: result.motion, stress: result.stress });
    }
  }

  private tickShips(delta: number): void {
    for (const ship of this.field.ships.values()) {
      if (ship.hull <= 0 || ship.role === "beacon") continue;
      const tick = tickCycleFlight(ship.flight, {
        deltaMs: delta,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
      });
      setSchoolFlight(ship, tick.state);
      if (!tick.completed) continue;
      this.field.crew?.onCycleCommitted(ship);
      if (ship.role === "player")
        this.pilot.onCycleCommitted(
          tick.state.motion.control.currentManeuver ?? "straight",
        );
    }
  }

  private markHudTarget(): void {
    const targetId = playerTargetId({
      ships: this.field.ships.values(),
      playerId: this.field.player.id,
      isAlly: (s: SchoolShip) => s.owner === "player",
      worldSize: BATTLEFIELD_SIZE,
    });
    if (!targetId) return;
    this.field.crew?.markTarget("player", targetId, this.time.now);
    const target = this.field.ships.get(targetId);
    if (target)
      this.effects.showFloatingText(
        target.x,
        target.y - 45,
        "MARKED",
        "#ff3344",
      );
  }

  /** Loads the trainee's missile rack (on start and after a respawn). */
  private armTrainee(): void {
    const player = this.field.player;
    this.weapons?.runtime.equip(player.id, {
      definitionId: player.definitionId,
      upgradeIds: TRAINING_ORDNANCE,
      modifiers: NEUTRAL_MODIFIERS,
    });
  }

  /** @returns What the secondary weapons read from (and ask of) the course. */
  private weaponsLink(): BattleWeaponsLink {
    return {
      bodies: () =>
        [...this.field.ships.values()]
          .filter((ship) => ship.role !== "beacon")
          .map((ship) => weaponBodyOf(ship, ship.owner, 1)),
      wantedTargetOf: (shipId: string) =>
        shipId === this.field.player.id
          ? playerTargetId({
              ships: this.field.ships.values(),
              playerId: shipId,
              isAlly: (s: SchoolShip) => s.owner === "player",
              worldSize: BATTLEFIELD_SIZE,
            })
          : (this.field.crew?.targetOf(shipId) ?? null),
      playerShipId: () => this.field.player.id,
      playerSide: () => "player",
      sideOf: (shipId: string) => this.field.ships.get(shipId)?.owner ?? null,
      applyHit: (hit: WeaponHit) => this.applyWeaponHit(hit),
    };
  }

  /**
   * A secondary weapon's hit, through the course's damage path; the
   * trainee's hits count toward the secondary lesson.
   *
   * @param hit - The hit from the weapons runtime.
   */
  private applyWeaponHit(hit: WeaponHit): void {
    const target = this.field.ships.get(hit.targetId);
    const attacker = this.field.ships.get(hit.attackerId);
    if (!target || !attacker || target.hull <= 0) return;
    if (attacker.role === "player") this.secondaryHits++;
    this.effects.createExplosion(target.x, target.y, "small");
    this.onKill(
      this.combat.land(attacker, target, {
        damage: hit.damage,
        stress: hit.stress,
        nowMs: this.time.now,
      }),
    );
  }

  private onShot(shot: SchoolShot): void {
    const { attacker, target } = shot;
    this.effects.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      shot.hit,
    );
    if (shot.hit && attacker.role === "player") this.primaryHits++;
    this.onKill(shot);
  }

  private onKill(shot: SchoolShot): void {
    const { attacker, target } = shot;
    if (!shot.killed) return;
    this.effects.createExplosion(target.x, target.y, "medium");
    this.combat.forget(target.id);
    this.field.crew?.forget(target.id);
    if (target.role === "player") this.respawnPlayer(attacker);
    else target.sprite?.setVisible(false);
  }

  private respawnPlayer(killer: SchoolShip): void {
    trackDeath("flight_school", killer.definitionId, {
      lesson: currentStep(this.machine)?.id ?? "",
    });
    this.field.spawnPlayer();
    this.pilot.reset();
    this.armTrainee();
    this.panel.flashToast(
      "Ship lost — respawned. No penalty in Flight School.",
    );
  }

  private updateHud(): void {
    this.hud.update(
      buildDuelHudSnapshot({
        ships: this.field.ships.values(),
        playerId: this.field.player.id,
        isAlly: (s: SchoolShip) => s.owner === "player",
        camera: cameraViewFrom(this.cameras.main),
        worldSize: BATTLEFIELD_SIZE,
        markedId:
          this.field.crew?.markedTargetOf("player", this.time.now) ?? null,
        secondaryWeapons: this.weapons?.hudSlots() ?? [],
      }),
    );
  }

  private observe(nowMs: number): FlightSchoolObservation {
    const control = this.field.player.flight.motion.control;
    return {
      nowMs,
      speed: control.speed,
      minSpeed: control.minSpeed,
      maxSpeed: control.maxSpeed,
      currentManeuver: control.currentManeuver,
      nextManeuver: control.nextManeuver,
      boostCooldownMs: control.boostCooldown,
      barrelRollCooldownMs: control.barrelRollCooldown,
      pressed: this.pressed,
      primaryHits: this.primaryHits,
      secondaryHits: this.secondaryHits,
      markedTargetId: this.field.crew?.markedTargetOf("player", nowMs) ?? null,
      beaconOnScreen: this.field.beaconOnScreen(this.cameras.main),
      enemiesAlive: this.field.enemiesAlive(),
    };
  }

  private advanceLessons(nowMs: number): void {
    const result = advanceFlightSchool(this.machine, this.observe(nowMs));
    this.machine = result.state;
    if (result.event === "none") return;
    playUiPress();
    if (result.event === "course_complete") return this.completeCourse();
    this.panel.flashToast("✓ LESSON COMPLETE");
    this.enterLesson();
  }

  private enterLesson(): void {
    const step = currentStep(this.machine);
    if (!step) return;
    this.field.setScenario(step.scenario);
    this.panel.showLesson(
      this.machine.index,
      FLIGHT_SCHOOL_STEPS.length,
      step.title,
      step.prompt((intent) => boundKeyLabel(intent)),
    );
    trackTutorialStep(step.id, this.machine.index);
    recordFlightSchoolStep(undefined, this.machine.index);
  }

  private skipLesson(): void {
    if (this.finished) return;
    this.machine = skipFlightSchoolStep(this.machine, this.time.now);
    if (this.machine.completed) return this.completeCourse();
    this.enterLesson();
  }

  private completeCourse(): void {
    this.finished = true;
    markFlightSchoolComplete();
    trackTutorialExit("complete", true);
    trackModeEnd("flight_school", "completed");
    this.panel.showComplete(COMPLETE_TEXT);
  }

  private leave(): void {
    if (!this.finished) {
      trackTutorialExit(currentStep(this.machine)?.id ?? "unknown", false);
      trackModeEnd("flight_school", "quit");
    }
    this.returnToMenu();
  }

  private returnToMenu(): void {
    goToScene(this, "MainMenuScene");
  }
}
