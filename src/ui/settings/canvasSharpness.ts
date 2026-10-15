/**
 * canvasSharpness — the game canvas is a fixed 1280×720 bitmap that the
 * browser scales to the window. At an integer factor (2× on a 1440p screen,
 * 3× on 4K) nearest-neighbour scaling keeps every edge razor sharp, where
 * the default smooth scaling blurs text; at fractional factors (1.5× on
 * 1080p) smooth scaling stays, because nearest-neighbour would make uneven
 * pixels. Pure decision plus one tiny DOM hook.
 *
 * Real supersampling (a backbuffer at devicePixelRatio) is not offered:
 * Phaser 3.87 has no renderer resolution, and a camera zoom ≠ 1 breaks the
 * hit-testing of every screen-pinned control (see CLAUDE.md pitfalls).
 */

/** Smallest scale at which crisp scaling is applied (below it the picture is not magnified enough). */
export const MIN_SHARP_SCALE = 2;
/** How far from an integer the scale may be and still count as integer. */
export const INTEGER_SCALE_TOLERANCE = 0.03;

/** CSS `image-rendering` values the game uses. */
export type CanvasRendering = "auto" | "pixelated";

/**
 * @param displayScale - CSS width of the canvas divided by its 1280 px bitmap width.
 * @param enabled - The "Sharp scaling" setting.
 * @returns The `image-rendering` to apply.
 */
export function renderingFor(
  displayScale: number,
  enabled: boolean,
): CanvasRendering {
  if (!enabled || !Number.isFinite(displayScale)) return "auto";
  const nearest = Math.round(displayScale);
  const isInteger = Math.abs(displayScale - nearest) <= INTEGER_SCALE_TOLERANCE;
  return nearest >= MIN_SHARP_SCALE && isInteger ? "pixelated" : "auto";
}

/** What the hook needs from a Phaser game. */
export interface SharpnessHost {
  readonly canvas: HTMLCanvasElement;
  readonly scale: {
    readonly gameSize: { readonly width: number };
    readonly displaySize: { readonly width: number };
    on(event: "resize", listener: () => void): unknown;
  };
}

let enabledSetting = true;
let host: SharpnessHost | null = null;

function apply(): void {
  if (!host) return;
  const { gameSize, displaySize } = host.scale;
  const scale = gameSize.width > 0 ? displaySize.width / gameSize.width : 1;
  host.canvas.style.imageRendering = renderingFor(scale, enabledSetting);
}

/**
 * @param enabled - The "Sharp scaling" setting (re-applies immediately).
 */
export function setSharpScaling(enabled: boolean): void {
  enabledSetting = enabled;
  apply();
}

/**
 * Keep the canvas's `image-rendering` in step with its display scale.
 *
 * @param game - The game (its canvas and scale manager).
 */
export function installCanvasSharpness(game: SharpnessHost): void {
  host = game;
  game.scale.on("resize", apply);
  apply();
}
