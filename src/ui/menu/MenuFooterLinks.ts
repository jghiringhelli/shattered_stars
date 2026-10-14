/**
 * Pointer-only text links in the bottom-left of a menu footer, laid out left
 * to right. Deliberately outside the keyboard-navigable menu rows so they do
 * not shift the menu's positions.
 */

import Phaser from "phaser";

/** Gap between two links (px). */
const LINK_GAP = 28;

/** One footer link. */
export interface FooterLink {
  readonly label: string;
  readonly onPress: () => void;
}

/** Look of the links. */
export interface FooterLinkStyle {
  readonly style: Phaser.Types.GameObjects.Text.TextStyle;
  readonly hoverColor: string;
  readonly letterSpacing: number;
}

/**
 * @param scene - Owning scene.
 * @param links - Links, left to right.
 * @param origin - Left edge and vertical centre of the row.
 * @param look - Text style, hover colour and tracking.
 * @returns The created texts, in order.
 */
export function addFooterLinks(
  scene: Phaser.Scene,
  links: readonly FooterLink[],
  origin: { readonly x: number; readonly y: number },
  look: FooterLinkStyle,
): Phaser.GameObjects.Text[] {
  const baseColor = look.style.color ?? "#ffffff";
  let cursor = origin.x;
  return links.map((link) => {
    const text = scene.add
      .text(cursor, origin.y, link.label, look.style)
      .setLetterSpacing(look.letterSpacing)
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => text.setColor(look.hoverColor))
      .on("pointerout", () => text.setColor(String(baseColor)))
      .on("pointerdown", link.onPress);
    cursor += text.width + LINK_GAP;
    return text;
  });
}
