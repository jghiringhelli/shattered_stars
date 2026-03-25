/**
 * ButtonFactory — shared UI button constructors.
 *
 * Provides two generic button primitives:
 *  - createHoverButton  — fills a rounded rect with an optional hover-tint and text scale
 *  - createToggleButton — two-state (selected/unselected) indicator button used for
 *                         option pickers (ship type, difficulty, etc.)
 *
 * All functions return the created Container and do NOT add it to the scene display list —
 * the caller is responsible for adding it where required:
 *   scene.add.existing(btn)          // scene root
 *   parentContainer.add(btn)         // inside another container
 */

import Phaser from 'phaser';

/** Configuration for {@link createHoverButton}. */
export interface HoverButtonConfig {
  /** Button width in pixels. */
  readonly width: number;
  /** Button height in pixels. */
  readonly height: number;
  /** Corner radius. Default: 8. */
  readonly radius?: number;
  /** Base fill color (normal, unhovered state). */
  readonly color: number;
  /** Fill color on pointer hover. Default: base color lightened by 20. */
  readonly hoverColor?: number;
  /** Button label. */
  readonly label: string;
  /** CSS font string. Default: 'bold 18px Arial'. */
  readonly font?: string;
  /** Label color hex string. Default: '#ffffff'. */
  readonly textColor?: string;
  /** Text scale multiplier applied on hover. Default: 1 (no scale change). */
  readonly hoverScale?: number;
}

/**
 * Create a hover-effect action button Container positioned at (x, y).
 *
 * @param scene   - The Phaser scene to create objects in.
 * @param x       - Center X in the parent coordinate space.
 * @param y       - Center Y in the parent coordinate space.
 * @param config  - Visual and label configuration.
 * @param onClick - Callback invoked on pointerdown.
 * @returns An interactive Container. Add to scene or a parent container after creation.
 */
export function createHoverButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: HoverButtonConfig,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const {
    width, height, radius = 8, color, label,
    font = 'bold 18px Arial', textColor = '#ffffff', hoverScale = 1,
  } = config;
  const hoverColor = config.hoverColor ?? Phaser.Display.Color.ValueToColor(color).lighten(20).color;
  const halfW = width / 2;
  const halfH = height / 2;

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const text = scene.add.text(0, 0, label, { font, color: textColor }).setOrigin(0.5);
  container.add([bg, text]);

  const draw = (hover: boolean): void => {
    bg.clear();
    bg.fillStyle(hover ? hoverColor : color, 1);
    bg.fillRoundedRect(-halfW, -halfH, width, height, radius);
  };
  draw(false);

  container.setInteractive(
    new Phaser.Geom.Rectangle(-halfW, -halfH, width, height),
    Phaser.Geom.Rectangle.Contains,
  );
  container.on('pointerover', () => { draw(true); text.setScale(hoverScale); });
  container.on('pointerout',  () => { draw(false); text.setScale(1); });
  container.on('pointerdown', onClick);

  return container;
}

/** Configuration for {@link createToggleButton}. */
export interface ToggleButtonConfig {
  /** Button width in pixels. */
  readonly width: number;
  /** Button height in pixels. */
  readonly height: number;
  /** Corner radius. Default: 4. */
  readonly radius?: number;
  /** Fill color when selected. */
  readonly selectedColor: number;
  /** Fill color (at 0.8 alpha) when not selected. */
  readonly normalColor: number;
  /** Border stroke color when selected. Default: 0x66aaff. */
  readonly strokeColor?: number;
  /** Font used when not selected. Default: '10px Arial'. */
  readonly font?: string;
  /** Font used when selected. Default: 'bold 10px Arial'. */
  readonly selectedFont?: string;
}

/**
 * Create a two-state selection button whose appearance reflects selected vs. unselected.
 * Used for option pickers (ship type, difficulty, pilot, etc.).
 *
 * @param scene    - The Phaser scene to create objects in.
 * @param x        - Center X in the parent coordinate space.
 * @param y        - Center Y in the parent coordinate space.
 * @param label    - Button label text.
 * @param selected - Initial selected state controlling fill, border, font, and text color.
 * @param config   - Visual configuration.
 * @param onClick  - Callback invoked on pointerdown.
 * @returns An interactive Container. Add to scene or a parent container after creation.
 */
export function createToggleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  selected: boolean,
  config: ToggleButtonConfig,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const {
    width, height, radius = 4, selectedColor, normalColor,
    strokeColor = 0x66aaff, font = '10px Arial', selectedFont = 'bold 10px Arial',
  } = config;
  const halfW = width / 2;
  const halfH = height / 2;

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(selected ? selectedColor : normalColor, selected ? 1 : 0.8);
  bg.fillRoundedRect(-halfW, -halfH, width, height, radius);
  if (selected) {
    bg.lineStyle(2, strokeColor, 1);
    bg.strokeRoundedRect(-halfW, -halfH, width, height, radius);
  }

  const text = scene.add
    .text(0, 0, label, { font: selected ? selectedFont : font, color: selected ? '#44ffaa' : '#666666' })
    .setOrigin(0.5);

  const hitArea = scene.add.rectangle(0, 0, width, height).setInteractive({ useHandCursor: true });
  container.add([bg, text, hitArea]);
  hitArea.on('pointerdown', onClick);

  return container;
}
