/**
 * Entry point for battle scenes: installs the torus view rig plus the themed
 * parallax space. One call replaces the old fixed backdrop + starfield.
 */

import Phaser from "phaser";
import { BATTLEFIELD_SIZE } from "../../config";
import { fadeInScene } from "../../ui/TexturedPanel";
import { TorusViewRig } from "../torus/TorusViewRig";
import { resolveMapRequest } from "./mapRequest";
import type { MapTheme } from "./mapThemes";
import { SpaceMapView } from "./SpaceMapView";
import {
  isSoftwareRenderer,
  SPACE_QUALITY_FULL,
  SPACE_QUALITY_MIN,
  SPACE_QUALITY_SOFTWARE,
} from "./spaceQualityGovernor";

/** Registry key holding the id of the map theme in use (read by tests and HUDs). */
export const ACTIVE_MAP_THEME_KEY = "activeMapTheme";
/** Registry key that overrides the quality cap (0..3), e.g. to inspect full quality on software GL. */
export const SPACE_QUALITY_CAP_KEY = "spaceQualityCap";

/**
 * @param scene - Scene whose renderer to inspect.
 * @returns The highest space quality level to draw: an override from the
 *   registry, else lighter on software rasterisers, else full.
 */
function qualityCapFor(scene: Phaser.Scene): number {
  const override = scene.registry.get(SPACE_QUALITY_CAP_KEY) as unknown;
  if (typeof override === "number") {
    return Math.max(SPACE_QUALITY_MIN, Math.min(SPACE_QUALITY_FULL, Math.round(override)));
  }
  const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
  const gl = renderer?.gl;
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  if (!gl || !info) return SPACE_QUALITY_FULL;
  const name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  return isSoftwareRenderer(name) ? SPACE_QUALITY_SOFTWARE : SPACE_QUALITY_FULL;
}

/** Explicit overrides of {@link installBattleSpace}. */
export interface BattleSpaceOptions {
  readonly worldSize?: number;
  /** Fixed seed (e.g. a Survival sector); else read from the start data. */
  readonly seed?: number;
  /** Theme id or "random"; else read from the start data. */
  readonly mapTheme?: string;
}

/** What an installed battle space exposes. */
export interface BattleSpaceHandle {
  readonly theme: MapTheme;
  readonly seed: number;
  readonly rig: TorusViewRig;
  readonly view: SpaceMapView;
}

/**
 * Install the seamless torus view and the themed space for a battle scene.
 * Call from `create()` after the camera's background colour is set and the
 * camera has no bounds. Seed and theme come from the options, the scene's
 * start data or `battleConfig` (see resolveMapRequest).
 *
 * @param scene - Battle scene.
 * @param options - Optional overrides (arena size, seed, theme).
 * @returns The rig, view and chosen theme.
 */
export function installBattleSpace(
  scene: Phaser.Scene,
  options: BattleSpaceOptions = {},
): BattleSpaceHandle {
  const { seed, theme } = resolveMapRequest(
    [
      { mapSeed: options.seed, mapTheme: options.mapTheme },
      scene.sys.settings.data,
      scene.registry.get("battleConfig"),
    ],
    Math.random,
  );
  fadeInScene(scene);
  scene.registry.set(ACTIVE_MAP_THEME_KEY, theme.id);
  const worldSize = options.worldSize ?? BATTLEFIELD_SIZE;
  const rig = new TorusViewRig(scene, { worldSize, skyColor: theme.skyColor });
  const view = new SpaceMapView(scene, {
    theme,
    seed,
    worldSize,
    rig,
    qualityCap: qualityCapFor(scene),
  });
  return { theme, seed, rig, view };
}
