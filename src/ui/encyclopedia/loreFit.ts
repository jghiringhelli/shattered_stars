/**
 * loreFit — fit wrapped body text into a fixed-height column: step the font
 * size down through the allowed body sizes, then trim whole words with an
 * ellipsis as a last resort, so lore never spills into the next section.
 */

import type Phaser from "phaser";

/** Body text sizes tried in order, and the line spacing. */
export const LORE_STYLE = {
  sizes: [14, 13, 12] as const,
  lineSpacing: 4,
  ellipsis: "…",
} as const;

/**
 * Set wrapped text that fits within a maximum height.
 *
 * @param text - Text object with a word-wrap width already set.
 * @param content - Full text.
 * @param maxHeight - Available height in pixels.
 */
export function fitLoreText(
  text: Phaser.GameObjects.Text,
  content: string,
  maxHeight: number,
): void {
  text.setText(content);
  for (const size of LORE_STYLE.sizes) {
    text.setFontSize(size);
    if (text.height <= maxHeight) return;
  }
  const words = content.split(/\s+/);
  while (words.length > 1 && text.height > maxHeight) {
    words.pop();
    text.setText(words.join(" ") + LORE_STYLE.ellipsis);
  }
}
