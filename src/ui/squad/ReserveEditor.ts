/**
 * ReserveEditor — the Squad Builder's reserve editor (modal): pick a
 * strategy preset (Balanced / Swarm / Aces / Heavy-Bombers — rebuilds the
 * list from the faction's quick builds), then reorder, remove or add ships
 * by hand. The list is the order reinforcements deploy in: AI wingmen take
 * the next ship as soon as there is room, and the player's picker offers
 * it first. Every change is reported (and saved) at once; DONE or Esc close.
 */

import Phaser from "phaser";
import {
  STRATEGY_IDS,
  STRATEGY_LABELS,
  buildReserve,
  factionCatalog,
  rulesFor,
  type ReinforcementFormat,
  type ReinforcementPrefs,
  type ReserveEntry,
  type StrategyId,
} from "../../arcade/reinforcements";
import type { FactionId } from "../../config";
import { createHoverButton } from "../ButtonFactory";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { HoloPanel } from "../hud/HoloPanel";
import { createHoloText } from "../hud/holoPrimitives";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { ReserveListView } from "./ReserveListView";
import {
  addEntry,
  moveEntry,
  removeEntry,
  reserveForBattle,
  reserveTotal,
} from "./reserveEditorModel";

const PANEL = { width: 760, height: 540 } as const;
const STRATEGY = { y: -190, width: 168, height: 32, gap: 8 } as const;
const SUMMARY_Y = -224;
const FOOTER = { y: 236, width: 200, height: 36, gap: 130 } as const;
const DIM_ALPHA = 0.7;
/** Opaque backing under the translucent panel so the builder does not show through. */
const BACKING_ALPHA = 0.95;

/** What the editor opens with and reports to. */
export interface ReserveEditorOptions {
  readonly faction: FactionId;
  readonly factionName: string;
  readonly format: ReinforcementFormat;
  readonly prefs: ReinforcementPrefs;
  readonly onChange: (prefs: ReinforcementPrefs) => void;
  readonly onClose: () => void;
}

export class ReserveEditor {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: HoloPanel;
  private readonly list: ReserveListView;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly strategyButtons = new Map<StrategyId, HoloPressButton>();
  private prefs: ReinforcementPrefs;
  private readonly onEsc = (): void => {
    // Deferred: the scene's back handler must still see the editor open.
    this.scene.time.delayedCall(0, () => this.close());
  };

  /**
   * @param scene - The Squad Builder scene.
   * @param options - Faction, format, saved prefs and callbacks.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: ReserveEditorOptions,
  ) {
    this.prefs = {
      ...options.prefs,
      factionId: options.faction,
      reserve: reserveForBattle(options.prefs, options.faction, options.format),
    };
    this.root = scene.add.container(0, 0).setDepth(HOLO_DEPTH.modal);
    const dim = scene.add
      .rectangle(
        0,
        0,
        scene.scale.width,
        scene.scale.height,
        0x000000,
        DIM_ALPHA,
      )
      .setOrigin(0)
      .setInteractive();
    const backing = scene.add.rectangle(
      scene.scale.width / 2,
      scene.scale.height / 2,
      PANEL.width,
      PANEL.height,
      HOLO_PALETTE.panelFill,
      BACKING_ALPHA,
    );
    this.root.add([dim, backing]);
    this.panel = new HoloPanel(
      scene,
      scene.scale.width / 2,
      scene.scale.height / 2,
      {
        ...PANEL,
        title: `Reserve — ${options.factionName}`,
      },
    );
    this.root.add(this.panel);
    this.summary = createHoloText(
      scene,
      0,
      SUMMARY_Y,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    );
    this.panel.add(this.summary);
    this.createStrategyRow();
    this.createFooter();
    this.list = new ReserveListView(
      scene,
      this.panel,
      factionCatalog(options.faction, options.format),
      {
        onMove: (i, d) => this.move(i, d),
        onRemove: (i) => this.remove(i),
        onAdd: (entry) => this.add(entry),
      },
    );
    scene.input.keyboard?.on("keydown-ESC", this.onEsc);
    this.commit(this.prefs);
  }

  /** The reserve as edited (e2e). */
  get reserve(): readonly ReserveEntry[] {
    return this.prefs.reserve;
  }

  /** The list view (e2e: the picked catalog ship). */
  get listView(): ReserveListView {
    return this.list;
  }

  /** @param strategy - Preset to apply (rebuilds the list). */
  applyStrategy(strategy: StrategyId): void {
    const { faction, format } = this.options;
    this.commit({
      ...this.prefs,
      strategy,
      edited: false,
      reserve: buildReserve(
        faction,
        strategy,
        rulesFor(format).poolPoints,
        format,
      ),
    });
  }

  /** @param index - Entry to move. @param delta - -1 up, +1 down. */
  move(index: number, delta: -1 | 1): void {
    this.edit(moveEntry(this.prefs.reserve, index, delta));
  }

  /** @param index - Entry to remove. */
  remove(index: number): void {
    this.edit(removeEntry(this.prefs.reserve, index));
  }

  /** @param entry - Ship to append (ignored when the reserve is full). */
  add(entry: ReserveEntry): void {
    this.edit(addEntry(this.prefs.reserve, entry));
  }

  /** Close the editor. */
  close(): void {
    this.scene.input.keyboard?.off("keydown-ESC", this.onEsc);
    this.list.clear();
    this.root.destroy();
    this.options.onClose();
  }

  private edit(reserve: readonly ReserveEntry[]): void {
    this.commit({ ...this.prefs, reserve, edited: true });
  }

  private commit(prefs: ReinforcementPrefs): void {
    this.prefs = prefs;
    this.options.onChange(prefs);
    const rules = rulesFor(this.options.format);
    this.summary.setText(
      `${prefs.reserve.length} SHIPS · ${reserveTotal(prefs.reserve)} PTS IN RESERVE  ·  POOL ${rules.poolPoints} (OPENING SQUAD INCLUDED)  ·  MAX ${rules.fieldCapPoints} ON FIELD`,
    );
    for (const [id, button] of this.strategyButtons)
      button.setVariant(
        id === prefs.strategy && !prefs.edited ? "primary" : "secondary",
      );
    this.list.render(prefs.reserve);
  }

  private createStrategyRow(): void {
    const total =
      STRATEGY_IDS.length * STRATEGY.width +
      (STRATEGY_IDS.length - 1) * STRATEGY.gap;
    STRATEGY_IDS.forEach((id, i) => {
      const x =
        -total / 2 + STRATEGY.width / 2 + i * (STRATEGY.width + STRATEGY.gap);
      const button = createHoverButton(
        this.scene,
        x,
        STRATEGY.y,
        {
          width: STRATEGY.width,
          height: STRATEGY.height,
          color: HOLO_PALETTE.panelFill,
          variant: "secondary",
          label: STRATEGY_LABELS[id].name.toUpperCase(),
          font: "600 12px",
        },
        () => this.applyStrategy(id),
      );
      this.panel.add(button);
      this.strategyButtons.set(id, button);
    });
  }

  private createFooter(): void {
    const reset = createHoverButton(
      this.scene,
      -FOOTER.gap,
      FOOTER.y,
      {
        width: FOOTER.width,
        height: FOOTER.height,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label: "RESET TO PRESET",
        font: "600 13px",
      },
      () => this.applyStrategy(this.prefs.strategy),
    );
    const done = createHoverButton(
      this.scene,
      FOOTER.gap,
      FOOTER.y,
      {
        width: FOOTER.width,
        height: FOOTER.height,
        color: HOLO_PALETTE.accent,
        variant: "primary",
        label: "DONE",
        font: "600 13px",
      },
      () => this.close(),
    );
    this.panel.add([reset, done]);
  }
}
