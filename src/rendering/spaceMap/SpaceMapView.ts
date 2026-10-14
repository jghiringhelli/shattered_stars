/**
 * SpaceMapView — the parallax space behind a battle: a painted backdrop and
 * procedural star and dust layers that tile forever, a planet limb and drifting
 * rocks / debris / shards. Everything is screen-pinned and positioned from the
 * camera's unwrapped travel, drawn only by the rig's backdrop camera (under
 * the world, never colliding, render only). Optional layers are dropped when
 * the frame rate sinks (SpaceQualityGovernor).
 */

import Phaser from "phaser";
import { backgroundAsset } from "../../assets/assetManifest";
import { requestTexture } from "../../assets/textureLoading";
import { createSeededRng, type RandomGenerator } from "../../utils/random";
import { TorusViewRig } from "../torus/TorusViewRig";
import { UnwrappedTravel } from "../torus/torusFollowMath";
import { createPlanetTexture, ensureDecorAtlas } from "./decorAtlas";
import { DecorSprites } from "./DecorSprites";
import {
  createDustTexture,
  createSeamlessBackdropTile,
  createStarTexture,
  createWispTexture,
  type StarLayerSpec,
  type WispSpec,
} from "./layerTextures";
import type { MapTheme } from "./mapThemes";
import { generateDecorField, planetStart, tileOffset } from "./parallaxMath";
import { SpaceQualityGovernor } from "./spaceQualityGovernor";

/** Depth of the lowest layer; background depth only orders objects among themselves. */
const BASE_DEPTH = -1000;
const BACKDROP_FACTOR = 0.03;
const BACKDROP_TILE_SCALE = 2.5;
/** The painted backdrop is dimmed so ships, stars and HUD read against it. */
const BACKDROP_DIM = 0.7;
const WISP_FACTOR = 0.08;
const WISP_TILE_SCALE = 1.5;
const DUST_FACTOR = 0.62;
/** Two star depths (counts are per 1024² tile at density 1): a dense far sky and a few near stars. */
const STAR_LAYERS: ReadonlyArray<{
  factor: number;
  count: number;
  spec: Omit<StarLayerSpec, "tints" | "count">;
}> = [
  { factor: 0.07, count: 330, spec: { minRadius: 0.5, maxRadius: 1.3, minAlpha: 0.25, maxAlpha: 0.65 } },
  { factor: 0.3, count: 48, spec: { minRadius: 0.8, maxRadius: 2.2, minAlpha: 0.5, maxAlpha: 1 } },
];
/** Salts so textures draw independent random streams from the same seed. */
const TEXTURE_SEED_SALT = 0x7e47ed;
const WISP_SEED_SALT = 0x31f7;
const MS_PER_SECOND = 1000;
/** Governor level from which each optional part is drawn (see spaceQualityGovernor). */
const LEVEL_FAR_STARS = 1;
const LEVEL_NEAR_STARS = 2;
const LEVEL_PLANET = 2;
const LEVEL_DUST_AND_DECOR = 3;

/** Options of {@link SpaceMapView}. */
export interface SpaceMapViewOptions {
  readonly theme: MapTheme;
  readonly seed: number;
  readonly worldSize: number;
  readonly rig: TorusViewRig;
  /** Highest quality level to draw (0..3); lower on weak renderers. */
  readonly qualityCap: number;
}

interface ScrollingLayer {
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly factor: number;
  readonly tileScale: number;
  /** Lowest governor level at which the layer is drawn. */
  readonly minLevel: number;
}

export class SpaceMapView {
  private readonly layers: ScrollingLayer[] = [];
  private readonly ownedKeys: string[] = [];
  private readonly owned: Phaser.GameObjects.GameObject[] = [];
  private readonly travel: UnwrappedTravel;
  private readonly governor: SpaceQualityGovernor;
  private readonly decor: DecorSprites;
  private readonly prefix: string;
  private readonly view = { travelX: 0, travelY: 0, seconds: 0, halfWidth: 0, halfHeight: 0 };
  private depth = BASE_DEPTH;
  private destroyed = false;

  /**
   * @param scene - Battle scene.
   * @param options - Theme, seed, arena size and the rig.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: SpaceMapViewOptions,
  ) {
    this.travel = new UnwrappedTravel(options.worldSize);
    this.governor = new SpaceQualityGovernor(options.qualityCap);
    this.prefix = `spacemap:${scene.scene.key}:${options.theme.id}:${options.seed}`;
    this.decor = new DecorSprites(scene, (object) => this.adopt(object));
    this.observeCamera();
    this.build();
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Scrolling layers drawn so far (decor excluded), for diagnostics. */
  get layerCount(): number {
    return this.layers.length;
  }

  /** Rocks, debris and shards in the decor field. */
  get decorCount(): number {
    return this.decor.count;
  }

  /** Current quality level (0..3). */
  get quality(): number {
    return this.governor.quality;
  }

  private observeCamera(): void {
    const camera = this.scene.cameras.main;
    this.travel.observe(camera.scrollX + camera.width / 2, camera.scrollY + camera.height / 2);
  }

  private adopt<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.push(object);
    this.options.rig.registerBackground(object);
    return object;
  }

  private build(): void {
    const { theme, seed } = this.options;
    const rng = createSeededRng((seed ^ TEXTURE_SEED_SALT) >>> 0);
    if (theme.backdrop) this.addBackdropLayer();
    else this.addWispLayer();
    this.addStarLayer(0, rng, LEVEL_FAR_STARS);
    this.addPlanet();
    this.addStarLayer(1, rng, LEVEL_NEAR_STARS);
    if (theme.dustAmount > 0) this.addDustLayer(rng);
    ensureDecorAtlas(this.scene);
    this.decor.addField(generateDecorField(theme, seed), this.depth);
  }

  private wispSpec(): WispSpec {
    const { theme } = this.options;
    return { count: theme.wispCount, colors: theme.wispColors, alpha: theme.wispAlpha };
  }

  private wispRng(): RandomGenerator {
    return createSeededRng((this.options.seed ^ WISP_SEED_SALT) >>> 0);
  }

  private addLayer(
    key: string,
    factor: number,
    tileScale: number,
    minLevel: number,
  ): Phaser.GameObjects.TileSprite {
    const { width, height } = this.scene.scale;
    this.ownedKeys.push(key);
    const sprite = this.adopt(
      this.scene.add
        .tileSprite(width / 2, height / 2, width, height, key)
        .setScrollFactor(0)
        .setDepth(this.depth++)
        .setTileScale(tileScale, tileScale),
    );
    this.layers.push({ sprite, factor, tileScale, minLevel });
    return sprite;
  }

  /** Themes without a painted backdrop show their wisps as a layer of their own. */
  private addWispLayer(): void {
    const key = `${this.prefix}:wisps`;
    createWispTexture(this.scene, key, this.wispRng(), this.wispSpec());
    this.addLayer(key, WISP_FACTOR, WISP_TILE_SCALE, 0).setBlendMode(Phaser.BlendModes.ADD);
  }

  private addDustLayer(rng: RandomGenerator): void {
    const { theme } = this.options;
    const key = `${this.prefix}:dust`;
    createDustTexture(this.scene, key, rng, theme.dustAmount, theme.dustColor);
    this.addLayer(key, DUST_FACTOR, 1, LEVEL_DUST_AND_DECOR);
  }

  private addStarLayer(index: number, rng: RandomGenerator, minLevel: number): void {
    const layer = STAR_LAYERS[index]!;
    const { theme } = this.options;
    const key = `${this.prefix}:stars${index}`;
    createStarTexture(this.scene, key, rng, {
      ...layer.spec,
      count: Math.round(layer.count * theme.starDensity),
      tints: theme.starTints,
    });
    this.addLayer(key, layer.factor, 1, minLevel);
  }

  private addBackdropLayer(): void {
    const { theme } = this.options;
    const backdropId = theme.backdrop!;
    const build = (): void => {
      if (this.destroyed) return;
      const key = `${this.prefix}:backdrop`;
      const wisps = { rng: this.wispRng(), spec: this.wispSpec() };
      if (!createSeamlessBackdropTile(this.scene, key, `bg_${backdropId}`, wisps)) return;
      const sprite = this.addLayer(key, BACKDROP_FACTOR, BACKDROP_TILE_SCALE, 0);
      sprite.setTint(theme.backdropTint).setAlpha(theme.backdropAlpha * BACKDROP_DIM);
      sprite.setDepth(BASE_DEPTH - 1);
      this.update();
    };
    requestTexture(this.scene, backgroundAsset(backdropId), build);
  }

  private addPlanet(): void {
    const spec = this.options.theme.planet;
    if (!spec) return;
    const key = `${this.prefix}:planet`;
    createPlanetTexture(this.scene, key, spec.kind, spec.color);
    this.ownedKeys.push(key);
    const start = planetStart(this.options.seed, this.travel.x, this.travel.y);
    this.decor.addPlanet(key, spec.scale, start, this.depth++);
  }

  /** Re-place every layer and decoration for the current camera (every frame). */
  update(): void {
    if (this.destroyed) return;
    this.observeCamera();
    const camera = this.scene.cameras.main;
    const level = this.governor.observe(this.scene.game.loop.delta, this.scene.time.now);
    const { travel, view } = this;
    for (const layer of this.layers) {
      const shown = level >= layer.minLevel;
      if (layer.sprite.visible !== shown) layer.sprite.setVisible(shown);
      if (!shown) continue;
      // Pinned objects are scaled by the camera zoom; undo it so a layer always covers the screen.
      layer.sprite.setScale(1 / camera.zoom);
      layer.sprite.tilePositionX = tileOffset(travel.x, layer.factor, layer.tileScale);
      layer.sprite.tilePositionY = tileOffset(travel.y, layer.factor, layer.tileScale);
    }
    view.travelX = travel.x;
    view.travelY = travel.y;
    view.seconds = this.scene.time.now / MS_PER_SECOND;
    view.halfWidth = camera.width / (2 * camera.zoom);
    view.halfHeight = camera.height / (2 * camera.zoom);
    this.decor.update(view, level >= LEVEL_DUST_AND_DECOR, level >= LEVEL_PLANET);
  }

  /** Destroy the layers and free the generated textures. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const object of this.owned) object.destroy();
    for (const key of this.ownedKeys) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }
}
