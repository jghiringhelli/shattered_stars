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
import { attachTermTooltip } from "../menu/HintTooltip";
import { addTipZone } from "../menu/tooltipTargets";
import type { TermId } from "../../data/tooltips";
import { fieldCapNote, poolNote } from "../picker/pointsBudget";
import { createHoverButton } from "../ButtonFactory";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { HoloPanel } from "../hud/HoloPanel";
import { createHoloText } from "../hud/holoPrimitives";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { ReserveListView } from "./ReserveListView";
import {
  RESERVE_STRATEGY_TERMS,
  quotaSentence,
  reserveSummaryLine,
} from "./reserveExplain";
import {
  addEntry,
  moveEntry,
  removeEntry,
  reserveForBattle,
  reserveTotal,
} from "./reserveEditorModel";

const PANEL = { width: 760, height: 540 } as const;
/** Panel header size (px) — nothing under 12 px at 1280x720. */
const PANEL_TITLE_PX = 12;
const STRATEGY = { y: -178, width: 168, height: 32, gap: 8 } as const;
/** Plain-language lines (pool, cap) under the title, then summary and quotas under the list. */
const NOTE_Y = { pool: -228, cap: -210, summary: 168, quota: 190 } as const;
/** Width the notes wrap at (px) and their font size — nothing under 12 px. */
const NOTE = { width: 700, height: 18, fontPx: 12 } as const;
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
  private readonly poolLine: Phaser.GameObjects.Text;
  private readonly capLine: Phaser.GameObjects.Text;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly quotaLine: Phaser.GameObjects.Text;
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
        titleSize: PANEL_TITLE_PX,
      },
    );
    this.root.add(this.panel);
    this.poolLine = this.note(NOTE_Y.pool, "reserve.pool");
    this.capLine = this.note(NOTE_Y.cap, "reserve.field_cap");
    this.summary = this.note(NOTE_Y.summary, "reserve.summary");
    this.quotaLine = this.note(NOTE_Y.quota, "reserve.quota");
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
    this.poolLine.setText(`${poolNote(rules.poolPoints)}.`);
    this.capLine.setText(`${fieldCapNote(rules.fieldCapPoints)}.`);
    this.summary.setText(
      reserveSummaryLine(prefs.reserve.length, reserveTotal(prefs.reserve)),
    );
    this.quotaLine.setText(quotaSentence(rules));
    for (const [id, button] of this.strategyButtons)
      button.setVariant(
        id === prefs.strategy && !prefs.edited ? "primary" : "secondary",
      );
    this.list.render(prefs.reserve);
  }

  /** A plain-language line of the panel with a hover explanation. */
  private note(y: number, term: TermId): Phaser.GameObjects.Text {
    const text = createHoloText(this.scene, 0, y, "", "caption", HOLO_PALETTE.textSecondary)
      .setFontSize(NOTE.fontPx)
      .setWordWrapWidth(NOTE.width);
    this.panel.add(text);
    addTipZone(
      this.scene,
      this.panel,
      { x: -NOTE.width / 2, y: y - NOTE.height / 2, width: NOTE.width, height: NOTE.height },
      term,
    );
    return text;
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
      attachTermTooltip(this.scene, button, RESERVE_STRATEGY_TERMS[id]);
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
    attachTermTooltip(this.scene, reset, "battle.reset_reserve");
    attachTermTooltip(this.scene, done, "reserve.edit_close");
    this.panel.add([reset, done]);
  }
}
