/**
 * WingmenStep — step 2 of the Skirmish setup (YOUR WINGMEN): the six wingmen
 * types on the left (details only for the focused one), the resulting squad
 * as a normal list on the right, and SHUFFLE / EDIT SQUAD under the types.
 * Pure view: the flow owns the choice and the plan.
 */

import Phaser from "phaser";
import { createHoverButton } from "../../ButtonFactory";
import { drawHoloFrame } from "../../menu/holoChrome";
import type { FocusTarget } from "../../menu/MenuFocus";
import type { HoloPressButton } from "../../menu/HoloPressButton";
import { fitOrEllipsize } from "../../picker/pickerStyle";
import { fitNameText } from "../../theme/nameFit";
import { t } from "../../../i18n";
import { WINGMEN_TYPES, type WingmenType } from "../../../systems/setup/wingmenTypes";
import type { WingmenPlan } from "../../../systems/setup/wingmen";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../../theme/HoloTheme";
import { SQUAD_TYPE, addCaption, addSquadText } from "../squadBuilderStyle";
import { squadRows, wingmenText, type SquadRow } from "./skirmishModel";
import { drawToggleGroup } from "./toggleGroup";

/** What the step reads and changes. */
export interface WingmenStepHost {
  readonly type: () => WingmenType;
  /** The squad that would fly, or null while no ship is staged. */
  readonly plan: () => WingmenPlan | null;
  readonly select: (type: WingmenType) => void;
  readonly shuffle: () => void;
  readonly edit: () => void;
}

/** Geometry (scene coordinates). */
const STEP = {
  top: 104,
  height: 560,
  leftX: 32,
  leftW: 420,
  gap: 16,
  pad: HOLO_SPACING.lg,
  titleY: 14,
  rowsTop: 44,
  typeH: 40,
  typeGap: 8,
  detailGap: 14,
  buttonH: 32,
  rowH: 56,
  rowGap: 8,
} as const;

/** Step 2 of the Skirmish setup. */
export class WingmenStep {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private typeTargets: FocusTarget[] = [];
  private buttons: HoloPressButton[] = [];
  private detailTitle: Phaser.GameObjects.Text | null = null;
  private detailBody: Phaser.GameObjects.Text | null = null;
  /** Type rows, shuffle and edit — one array so a MenuFocus keeps it across renders. */
  readonly focusTargets: FocusTarget[] = [];

  /**
   * @param scene - The Squad Builder scene.
   * @param host - Choice, plan and actions.
   * @param accent - Faction accent for the frames.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: WingmenStepHost,
    private readonly accent: number,
  ) {}

  /** Draw (or redraw) the step. */
  render(): void {
    this.clear();
    const rightX = STEP.leftX + STEP.leftW + STEP.gap;
    const rightW = this.scene.scale.width - STEP.leftX - rightX;
    this.panel(STEP.leftX, STEP.leftW, t("skirmish.wingmen.listTitle"));
    this.panel(rightX, rightW, t("skirmish.wingmen.squadTitle"));
    this.drawTypes();
    this.drawDetail();
    this.drawActions();
    this.drawSquad(rightX, rightW);
    this.focusTargets.splice(0, this.focusTargets.length, ...this.typeTargets, ...this.buttons);
  }

  /** Remove everything the step drew. */
  destroy(): void {
    this.clear();
  }

  private clear(): void {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.typeTargets = [];
    this.buttons = [];
    this.focusTargets.length = 0;
    this.detailTitle = null;
    this.detailBody = null;
  }

  private panel(x: number, width: number, title: string): void {
    const frame = this.scene.add.graphics();
    drawHoloFrame(
      frame,
      { x, y: STEP.top, width, height: STEP.height },
      { accent: this.accent, radius: HOLO_RADIUS.lg },
    );
    const caption = addCaption(this.scene, x + STEP.pad, STEP.top + STEP.titleY, title);
    this.objects.push(frame, caption);
  }

  private drawTypes(): void {
    const width = STEP.leftW - STEP.pad * 2;
    const group = drawToggleGroup(this.scene, {
      options: WINGMEN_TYPES.map((type) => ({
        value: type,
        label: wingmenText(type).title,
        name: `wingmenType_${type}`,
      })),
      selected: this.host.type(),
      accent: this.accent,
      slot: (index) => ({
        x: STEP.leftX + STEP.leftW / 2,
        y: STEP.top + STEP.rowsTop + index * (STEP.typeH + STEP.typeGap) + STEP.typeH / 2,
        width,
        height: STEP.typeH,
      }),
      onPick: (type) => this.host.select(type),
      onPreview: (type) => this.preview(type),
    });
    this.objects.push(...group.objects);
    this.typeTargets = group.targets;
  }

  private drawDetail(): void {
    const x = STEP.leftX + STEP.pad;
    const y = STEP.top + STEP.rowsTop + WINGMEN_TYPES.length * (STEP.typeH + STEP.typeGap) + STEP.detailGap;
    const width = STEP.leftW - STEP.pad * 2;
    this.detailTitle = addSquadText(this.scene, x, y, "", {
      size: SQUAD_TYPE.name,
      weight: "600",
      color: HOLO_PALETTE.textPrimary,
    });
    this.detailBody = addSquadText(this.scene, x, y + 22, "", {
      size: SQUAD_TYPE.body,
      color: HOLO_PALETTE.textSecondary,
    }).setWordWrapWidth(width);
    this.objects.push(this.detailTitle, this.detailBody);
    this.preview(null);
  }

  /** Shows the description of the hovered / focused type, else of the selected one. */
  private preview(type: WingmenType | null): void {
    if (!this.detailTitle || !this.detailBody) return;
    const shown = wingmenText(type ?? this.host.type());
    this.detailTitle.setText(shown.title);
    this.detailBody.setText(shown.body);
  }

  private drawActions(): void {
    const width = (STEP.leftW - STEP.pad * 2 - HOLO_SPACING.sm) / 2;
    const y = STEP.top + STEP.height - STEP.pad - STEP.buttonH / 2;
    const hasPlan = this.host.plan() !== null;
    const make = (index: number, label: string, onPress: () => void): HoloPressButton =>
      createHoverButton(
        this.scene,
        STEP.leftX + STEP.pad + width / 2 + index * (width + HOLO_SPACING.sm),
        y,
        {
          width,
          height: STEP.buttonH,
          color: HOLO_PALETTE.panelFill,
          variant: "secondary",
          label,
          font: `600 ${SQUAD_TYPE.label}px`,
        },
        onPress,
      );
    const shuffle = make(0, t("skirmish.wingmen.shuffle"), this.host.shuffle).setName("wingmenShuffle");
    const edit = make(1, t("skirmish.wingmen.edit"), this.host.edit).setName("wingmenEdit");
    shuffle.setEnabled(hasPlan && this.host.type() !== "custom");
    edit.setEnabled(hasPlan);
    this.buttons = [shuffle, edit];
    this.objects.push(shuffle, edit);
  }

  private drawSquad(x: number, width: number): void {
    const plan = this.host.plan();
    const top = STEP.top + STEP.rowsTop;
    if (!plan) {
      this.objects.push(
        addSquadText(this.scene, x + STEP.pad, top, t("skirmish.wingmen.needShip"), {
          size: SQUAD_TYPE.body,
          color: HOLO_PALETTE.textMuted,
        }).setWordWrapWidth(width - STEP.pad * 2),
      );
      return;
    }
    squadRows(plan.ships, plan.loadoutChoices).forEach((row, index) =>
      this.drawRow(row, { x: x + STEP.pad, y: top + index * (STEP.rowH + STEP.rowGap), width: width - STEP.pad * 2 }),
    );
    if (plan.ships.length > 1) return;
    const below = top + STEP.rowH + STEP.rowGap;
    this.objects.push(
      addSquadText(this.scene, x + STEP.pad, below, t("skirmish.wingmen.noWingmen"), {
        size: SQUAD_TYPE.body,
        color: HOLO_PALETTE.textMuted,
      }),
    );
  }

  private drawRow(row: SquadRow, box: { x: number; y: number; width: number }): void {
    const frame = this.scene.add.graphics();
    drawHoloFrame(
      frame,
      { x: box.x, y: box.y, width: box.width, height: STEP.rowH },
      {
        accent: row.isFlagship ? this.accent : HOLO_PALETTE.border,
        radius: HOLO_RADIUS.md,
        fillAlpha: row.isFlagship ? 0.6 : 0.35,
        borderAlpha: row.isFlagship ? 0.9 : 0.4,
      },
    );
    const cost = addSquadText(this.scene, box.x + box.width - STEP.pad, box.y + STEP.pad, `${row.cost} pts`, {
      size: SQUAD_TYPE.name,
      weight: "600",
      color: HOLO_PALETTE.textPrimary,
    }).setOrigin(1, 0);
    const name = addSquadText(this.scene, box.x + STEP.pad, box.y + STEP.pad, row.name, {
      size: SQUAD_TYPE.name,
      weight: "600",
      color: HOLO_PALETTE.textPrimary,
    });
    fitNameText(name, cost.x - cost.width - box.x - STEP.pad * 2);
    const who = row.isFlagship ? t("skirmish.wingmen.flagship") : t("skirmish.wingmen.wingman");
    const detail = [who, row.roleLabel, row.buildName].filter((part) => part).join(" \u00b7 ");
    const line = addSquadText(this.scene, box.x + STEP.pad, box.y + STEP.pad + 20, detail, {
      size: SQUAD_TYPE.label,
      color: row.isFlagship ? this.accent : HOLO_PALETTE.textSecondary,
    });
    fitOrEllipsize(line, box.width - STEP.pad * 2);
    this.objects.push(frame, cost, name, line);
  }
}
