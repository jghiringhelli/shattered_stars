# Map themes and the seamless torus view

Every battle arena is a torus (`BATTLEFIELD_SIZE` = 6000 px, ships and shots wrap). This spec covers what the
player SEES of it. Render only: nothing here touches the simulation, collisions or the online lockstep hashes.

## Seamless seams

`src/rendering/torus/` — `TorusViewRig` adds cameras to the battle scene, in draw order:

1. `space_backdrop` — draws only the background objects (parallax layers, decor) and owns the sky colour;
2. `torus_copy_0..n` — one per piece of the view past an arena seam (0–3 for the usual view, up to 8 when zoomed far out).
   Each shows the real world displaced by ±arena size inside its own viewport (`seamRegions.ts`: which pieces exist,
   viewport + scroll of each copy camera, which objects a copy needs). A ship 40 px past the edge is drawn there,
   with its bars, bolts, effects and markers, by the same display objects — no per-entity copies;
3. the scene's main camera (moved last) — world + HUD.

Every frame (`PRE_RENDER`) the rig sets `cameraFilter` bits: background → backdrop camera only, screen-pinned objects
(`scrollFactor` ≠ 1: HUD, overlays) → main only, world objects → a copy camera only when within
`DEFAULT_OBJECT_PADDING` (1200 px) of its region. No per-frame allocations.

Contract for battle scenes: no `setBounds` on the main camera, view centre kept in `[0, size)`
(`TorusFollow` replaces `startFollow` — it follows the short way round), call `installBattleSpace(this)` from `create()`
after `setBackgroundColor`.

## Parallax space

`src/rendering/spaceMap/SpaceMapView.ts` — screen-pinned layers placed from the camera's *unwrapped* travel
(`UnwrappedTravel`, so nothing jumps when the wrapped centre crosses a seam): the painted backdrop
(`blendSeamless`: cross-blended with itself shifted by half a tile; factor 0.03), far stars (0.07), a planet limb (0.07),
near stars (0.3), dust (0.62), then drifting decor (rocks, debris, shards: factors 0.22–0.92, bigger when nearer, slow
spin and drift; `parallaxMath.ts`). Textures are procedural canvases that wrap at their edges (`layerTextures.ts`,
`decorAtlas.ts`), drawn from a seeded stream and freed on scene shutdown. Layers cost one fullscreen quad each, so
`SpaceQualityGovernor` drops dust + decor, then near stars, then far stars when the smoothed frame time exceeds 24 ms
(and restores them cautiously); software rasterisers (SwiftShader, llvmpipe) start at level 1. Override with
`registry.set("spaceQualityCap", 0..3)`.

## Themes

`mapThemes.ts` — Cinder Reach, Deepmaw Trench, Kessa Lane, Tessaly Junction, Hale's Run, Prometheus Shadow,
Void-quiet Blackfield, Reach Shards, Cinder Gate (names and colours from docs/lore/universe.md). Each theme = painted
backdrop + tint, star density/tints, dust, nebula wisps, counts and tints of rocks / debris / shards, optional planet.

Choosing the map (`mapRequest.ts`):

| Mode | Seed | Theme |
|------|------|-------|
| Skirmish / Epic format / Scenarios, Dogfight, Ace Duel, Continuous, Boss Raid (offline) | random per battle | `battleConfig.mapTheme` (theme id) if set, else random |
| Online battles | the shared match seed (`seed` in the start data / `battleConfig`) | derived from the seed; local choice ignored, so both clients see the same map |
| Survival | the node's `combatSeed` | by sector (`themeIdForSector`) |
| Campaign | `seedFromText(mission.id)` | by seed (same map every time a mission is played) |
| Flight School | random | Prometheus Shadow |

`MAP_THEMES` / `MAP_THEME_IDS` / `RANDOM_MAP_THEME` are exported for pickers ("Map: Random | …").
The theme in use is in `registry.get("activeMapTheme")`.

## Radar

`src/ui/hud/radarSeams.ts` + `radarSeamDraw.ts`: the radar already projects torus-correct; it now also draws the
arena edge within range as a faint dashed line with a small arrow showing which way crossing it leads.

## Tests

Unit: `tests/unit/rendering/torus`, `tests/unit/rendering/spaceMap`, `tests/unit/ui/hud/radarSeams.test.ts`.
E2E: `tests/e2e/space-map.spec.ts` (copy cameras at a seam and corner, layers beyond the arena, render cost with 40
ships, a screenshot of every theme in the OS temp dir).
