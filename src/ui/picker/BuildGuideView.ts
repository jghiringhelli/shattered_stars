/**
 * BuildGuideView — draws one guide tab (HOW TO FLY, PROS & CONS or COST) of
 * the ship picker's detail panel from a BuildExplanation. Lines that would
 * spill past the panel are left out and replaced by a pointer to the BUILD
 * tab, so the panel never overflows. Hovering a heading explains it.
 */

import type Phaser from "phaser";
import type { BuildExplanation } from "../../data/roleHints";
import type { TermId } from "../../data/tooltips";
import { addTipZone } from "../menu/tooltipTargets";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import {
  guideSections,
  type GuideSection,
  type GuideTab,
  type SectionTone,
} from "./guideSections";
import { PICKER_TYPE, pickerTextStyle } from "./pickerStyle";

const TONE_COLOR: Readonly<Record<SectionTone, number>> = {
  normal: HOLO_PALETTE.textPrimary,
  good: HOLO_PALETTE.success,
  bad: HOLO_PALETTE.warning,
  example: HOLO_PALETTE.accent,
};
const LINE_GAP = 2;
const SECTION_GAP = 6;
const BULLET = "\u25c6 ";
const MORE_NOTE = "\u2026 more in the LOADOUT tab";

/** Term shown when hovering a section heading. */
const HEADING_TERMS: Readonly<Partial<Record<string, TermId>>> = {
  "WHEN TO PICK IT": "ui.build",
  "HOW TO FLY": "ui.tab_guide",
  "COST BREAKDOWN": "ui.cost_breakdown",
  STRENGTHS: "ui.tab_pros_cons",
  WEAKNESSES: "ui.tab_pros_cons",
};

/** Where to draw. */
export interface GuideBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** Lowest y the content may reach. */
  readonly bottom: number;
}

/** Draws guide tabs into a container. */
export class BuildGuideView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
  ) {}

  /**
   * @param tab - Which tab.
   * @param guide - The build's explanation.
   * @param box - Content box.
   * @returns y just below the content.
   */
  render(tab: GuideTab, guide: BuildExplanation, box: GuideBox): number {
    return this.renderSections(guideSections(tab, guide), box);
  }

  /**
   * @param sections - Sections to draw, top to bottom.
   * @param box - Content box.
   * @returns y just below the content.
   */
  renderSections(sections: readonly GuideSection[], box: GuideBox): number {
    let y = box.y;
    for (const section of sections) {
      y = this.drawSection(section, box, y) + SECTION_GAP;
    }
    return y - SECTION_GAP;
  }

  private drawSection(section: GuideSection, box: GuideBox, top: number): number {
    const heading = this.scene.add
      .text(box.x, top, section.heading, pickerTextStyle("caption", HOLO_PALETTE.textSecondary))
      .setLetterSpacing(PICKER_TYPE.caption.letterSpacing);
    this.container.add(heading);
    const term = HEADING_TERMS[section.heading];
    if (term) {
      const zone = { x: box.x, y: top, width: heading.width, height: heading.height };
      addTipZone(this.scene, this.container, zone, term);
    }
    let y = top + heading.height + LINE_GAP;
    if (y + PICKER_TYPE.small.size > box.bottom) {
      heading.destroy();
      return top;
    }
    if (section.rows) return this.drawRows(section, box, y);
    for (const [index, line] of section.lines.entries()) {
      const text = this.scene.add.text(
        box.x,
        y,
        `${section.bullets ? BULLET : ""}${line}`,
        pickerTextStyle("small", TONE_COLOR[section.tone], {
          wordWrap: { width: box.width },
          ...(section.tone === "example" ? { fontStyle: "italic" } : {}),
        }),
      );
      if (y + text.height > box.bottom) {
        text.destroy();
        return this.drawMore(box, y, section.lines.length - index);
      }
      this.container.add(text);
      y += text.height + LINE_GAP;
    }
    return y - LINE_GAP;
  }

  private drawMore(box: GuideBox, y: number, left: number): number {
    if (left <= 0 || y + PICKER_TYPE.micro.size > box.bottom) return y;
    const note = this.scene.add.text(
      box.x,
      y,
      MORE_NOTE,
      pickerTextStyle("micro", HOLO_PALETTE.textMuted, { fontStyle: "400" }),
    );
    this.container.add(note);
    return y + note.height;
  }

  private drawRows(section: GuideSection, box: GuideBox, top: number): number {
    let y = top;
    for (const row of section.rows ?? []) {
      const total = row.label === "TOTAL";
      const color = total ? HOLO_PALETTE.accent : HOLO_PALETTE.textPrimary;
      const style = pickerTextStyle(total ? "name" : "small", color);
      const label = this.scene.add.text(box.x, y, row.label, style);
      const value = this.scene.add
        .text(box.x + box.width, y, row.value, style)
        .setOrigin(1, 0);
      this.container.add([label, value]);
      y += label.height + LINE_GAP;
      if (y > box.bottom) break;
    }
    return y - LINE_GAP;
  }
}
