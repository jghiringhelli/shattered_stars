/**
 * WingmenChoice — the Skirmish WINGMEN state the setup flow keeps: the chosen
 * type, the CUSTOM wingmen the player picked and the SHUFFLE count, and how
 * they turn into a fill request. Pure: no Phaser.
 */

import type { FactionId } from "../../../config";
import type { GameMode } from "../../../core/squadTypes";
import {
  wingmenSeed,
  type WingmenPlan,
  type WingmenRequest,
  type WingmenRules,
} from "../../../systems/setup/wingmen";
import type { WingmenType } from "../../../systems/setup/wingmenTypes";

/** What a request needs besides the choice itself. */
export interface WingmenContext {
  readonly faction: FactionId;
  readonly shipId: string;
  readonly loadoutId: string | null;
  readonly gameMode: GameMode;
  readonly pointLimit: number;
  readonly rules?: WingmenRules | undefined;
}

/** The wingmen type, the CUSTOM list and the shuffle count. */
export class WingmenChoice {
  private reroll = 0;
  private customLoadouts: Record<string, string> = {};
  private customShips: string[];

  /**
   * @param type - The chosen type.
   * @param custom - The CUSTOM wingmen picked earlier (ships after the flagship).
   */
  constructor(
    public type: WingmenType,
    custom: readonly string[],
  ) {
    this.customShips = [...custom];
  }

  /** @returns The state to emit / remember. */
  snapshot(): { type: WingmenType; custom: string[]; customLoadouts: Record<string, string> } {
    return { type: this.type, custom: [...this.customShips], customLoadouts: { ...this.customLoadouts } };
  }

  /** Re-rolls the random choices of the fill (SHUFFLE). */
  shuffle(): void {
    this.reroll += 1;
  }

  /** A faction change invalidates the picked ships. */
  resetForFaction(): void {
    this.customShips = [];
    this.customLoadouts = {};
    if (this.type === "custom") this.type = "auto";
  }

  /**
   * Chooses a type. Choosing CUSTOM for the first time starts from the squad
   * that would fly now, so the player edits it instead of starting empty.
   *
   * @param type - The type pressed.
   * @param current - The squad that would fly now (null before a ship is staged).
   */
  choose(type: WingmenType, current: WingmenPlan | null): void {
    if (type === "custom" && this.customShips.length === 0 && current) {
      this.customShips = current.ships.slice(1);
      this.customLoadouts = {};
    }
    this.type = type;
  }

  /**
   * Takes the squad the player edited in the squad picker as the CUSTOM wingmen.
   *
   * @param flagship - The player's ship (its entry is not a wingman); null when none is staged.
   * @param ships - The picked squad.
   * @param loadoutChoices - Builds by index in `ships`.
   */
  applyPicked(
    flagship: string | null,
    ships: readonly string[],
    loadoutChoices: Readonly<Record<string, string>>,
  ): void {
    const own = Math.max(0, flagship ? ships.indexOf(flagship) : 0);
    this.customShips = [];
    this.customLoadouts = {};
    ships.forEach((id, index) => {
      if (index === own) return;
      const loadout = loadoutChoices[String(index)];
      if (loadout) this.customLoadouts[String(this.customShips.length)] = loadout;
      this.customShips.push(id);
    });
    this.type = "custom";
  }

  /**
   * @param context - Faction, flagship, mode, limit and reinforcement rules.
   * @returns The fill request for the current choice.
   */
  request(context: WingmenContext): WingmenRequest {
    return {
      faction: context.faction,
      shipId: context.shipId,
      loadoutId: context.loadoutId,
      type: this.type,
      gameMode: context.gameMode,
      pointLimit: context.pointLimit,
      seed: wingmenSeed(context.faction, context.shipId, this.type, context.pointLimit, this.reroll),
      custom: this.customShips,
      customLoadouts: this.customLoadouts,
      ...(context.rules ? { rules: context.rules } : {}),
    };
  }
}
