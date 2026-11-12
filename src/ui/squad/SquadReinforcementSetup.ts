/**
 * SquadReinforcementSetup — everything the Squad Builder knows about
 * reinforcement battles behind one object: the saved setup (versioned in
 * local storage: battle type, strategy, reserve), the header controls, the
 * reserve editor, and the `battle` / `reinforcements` fields it adds to the
 * battle config at launch. Reinforcements are the default for Skirmish,
 * Epic and Scenario; Classic stays one toggle away.
 */

import type Phaser from "phaser";
import {
  loadReinforcementPrefs,
  rulesFor,
  saveReinforcementPrefs,
  type ReinforcementFormat,
  type ReinforcementPrefs,
  type ReserveEntry,
  type StrategyId,
} from "../../arcade/reinforcements";
import type { FactionId } from "../../config";
import type { GameMode } from "../../core/squadTypes";
import { browserStore, type KeyValueStore } from "../../systems/keyValueStore";
import type { WingmenRules } from "../../systems/setup/wingmen";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { BattleTypeControls } from "./BattleTypeControls";
import { ReserveEditor } from "./ReserveEditor";
import { formatOfMode, reserveForBattle } from "./reserveEditorModel";

/** What the setup reads from the Squad Builder. */
export interface SquadReinforcementHost {
  readonly mode: () => GameMode;
  readonly hasScenario: () => boolean;
  /** The faction the player will fly (simple flow selection or squad). */
  readonly playerFaction: () => FactionId;
}

/** A launched squad, as the battle config lists it. */
interface FactionSlot {
  readonly factionId: string | null;
  readonly controller: "player" | "ai";
}

/** Strategy the AI opponents plan with. */
const AI_STRATEGY: StrategyId = "balanced";

/** Plain-words faction names for the editor title. */
function factionName(faction: FactionId): string {
  return faction.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export class SquadReinforcementSetup {
  private prefs: ReinforcementPrefs;
  private readonly controls: BattleTypeControls;
  private editor: ReserveEditor | null = null;

  /**
   * @param scene - The Squad Builder scene.
   * @param host - Mode, scenario and faction accessors.
   * @param store - Where the setup is saved (local storage by default).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: SquadReinforcementHost,
    private readonly store: KeyValueStore = browserStore(),
  ) {
    this.prefs = loadReinforcementPrefs(store);
    this.controls = new BattleTypeControls(scene, {
      prefs: () => this.prefs,
      setPrefs: (prefs) => this.save(prefs),
      format: () => this.format(),
      openEditor: () => this.openEditor(),
    });
  }

  /** The saved setup (e2e). */
  get current(): ReinforcementPrefs {
    return this.prefs;
  }

  /** Whether the reserve editor is open (the builder's own keys pause). */
  get isEditing(): boolean {
    return this.editor !== null;
  }

  /** The open editor (e2e), or null. */
  get openEditorView(): ReserveEditor | null {
    return this.editor;
  }

  /** @returns Header buttons for keyboard focus (none when the mode has no reinforcements). */
  focusTargets(): HoloPressButton[] {
    return this.controls.focusTargets();
  }

  /** The mode or scenario changed: refresh the controls. */
  refresh(): void {
    this.controls.refresh();
  }

  /** @param box - Where the controls go inside a panel (Skirmish step 3). */
  placeInPanel(box: { readonly x: number; readonly y: number }): void {
    this.controls.placeInPanel(box);
  }

  /** Draws the controls above anything created after them (the step's panels). */
  bringToFront(): void {
    this.controls.bringToFront();
  }

  /** Moves the controls back to the header row (advanced builder). */
  placeInHeader(): void {
    this.controls.placeInHeader();
  }

  /** @param shown - Whether the controls may show. */
  setShown(shown: boolean): void {
    this.controls.setShown(shown);
  }

  /**
   * @returns The limits the wingmen fill must respect: the format's quotas and field cap when
   *   reinforcements are on, else undefined (classic battles have no quotas).
   */
  wingmenRules(): WingmenRules | undefined {
    const format = this.format();
    if (!format || this.prefs.battle !== "reinforcements") return undefined;
    const rules = rulesFor(format);
    return { quotas: rules.quotas, fieldCapPoints: rules.fieldCapPoints };
  }

  /** @param battle - Classic or Reinforcements (e2e / settings). */
  setBattle(battle: ReinforcementPrefs["battle"]): void {
    this.save({ ...this.prefs, battle });
    this.controls.refresh();
  }

  /** Open the reserve editor for the player's faction. */
  openEditor(): void {
    const format = this.format();
    if (!format || this.editor) return;
    const faction = this.host.playerFaction();
    this.editor = new ReserveEditor(this.scene, {
      faction,
      factionName: factionName(faction),
      format,
      prefs: this.prefs,
      onChange: (prefs) => this.save(prefs),
      onClose: () => {
        this.editor = null;
        this.controls.refresh();
      },
    });
  }

  /**
   * @param factions - The launched squads.
   * @returns The reinforcement fields of the battle config ({} for classic or other modes).
   */
  battleConfigFields(
    factions: readonly FactionSlot[],
  ): Record<string, unknown> {
    const format = this.format();
    if (!format) return {};
    if (this.prefs.battle === "classic") return { battle: "classic" };
    const player = factions.find((f) => f.controller === "player");
    if (!player?.factionId) return { battle: "reinforcements" };
    const faction = player.factionId as FactionId;
    const reserve: readonly ReserveEntry[] = reserveForBattle(
      this.prefs,
      faction,
      format,
    );
    this.save({ ...this.prefs, factionId: faction, reserve });
    // One plan per squad (index = battle-config squad), so a mirror match
    // never merges two sides' plans under one faction.
    const squads = factions.map((slot) =>
      slot === player
        ? { strategy: this.prefs.strategy, reserve }
        : { strategy: AI_STRATEGY },
    );
    return { battle: "reinforcements", reinforcements: { format, squads } };
  }

  /** Destroy the controls (and an open editor). */
  destroy(): void {
    this.editor?.close();
    this.controls.destroy();
  }

  private format(): ReinforcementFormat | null {
    return formatOfMode(this.host.mode(), this.host.hasScenario());
  }

  private save(prefs: ReinforcementPrefs): void {
    this.prefs = prefs;
    saveReinforcementPrefs(this.store, prefs);
  }
}
