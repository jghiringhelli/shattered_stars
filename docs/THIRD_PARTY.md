# Third-party material, AI models and licences

Audit of 2026-10-14 for the public beta. Companion to `LICENSE`,
`public/THIRD_PARTY_NOTICES.txt` (shipped with the game) and
`src/data/credits.ts` (in-game credits roll).

Legend: ✅ verified from the model's own repository metadata · ⚠️ UNVERIFIED (could
not be machine-checked; owner must read the model page) · 🚩 flagged.

## 1. AI image models (art pipeline)

The art (ships, portraits, backdrops, creatures, UI textures) was generated with
Stable Diffusion through Forge (`scripts/sd_queue.py`, `direct_forge_worker.py`,
`generate_*_art.py`, `generate_sprites.py`) and ComfyUI (`scripts/*_comfy.py`).
Only models **referenced by the repo scripts** are listed; "file" is the name the
scripts load.

| Model (file) | Used for | Licence | Commercial OK? | Flag |
|---|---|---|---|---|
| **DreamShaper 8** (`dreamshaper_8.safetensors`, Lykon) | Default checkpoint of every Forge script (`sd_queue.py`, `generate_ship_art.py`, `generate_backgrounds.py`, `generate_ui_textures.py`, `generate_creature_art.py`, `generate_missing_portraits.py`, `regen_*.json`, `gen_missing_sprites.json`) | CreativeML OpenRAIL-M ✅ (Hugging Face `Lykon/dreamshaper-8`) | Yes: outputs may be used commercially; use-restrictions of OpenRAIL-M apply (no unlawful / harmful use) | none |
| **SDXL 1.0 base** (`sd_xl_base_1.0.safetensors`) | ComfyUI scripts (`ship_workflows_comfy.py`, `generate_creature_art_comfy.py`) | CreativeML Open RAIL++-M ✅ (`stabilityai/stable-diffusion-xl-base-1.0`) | Yes (same use-restrictions) | none |
| **SDXL VAE fp16-fix** (`sdxl_vae_fp16fix.safetensors`, madebyollin) | ComfyUI VAE | MIT ✅ | Yes | none |
| **ControlNet Union ProMax SDXL** (`controlnet-union-promax-sdxl.safetensors`, xinsir) | ComfyUI silhouette/guide control for ships and creatures | Apache-2.0 ✅ (`xinsir/controlnet-union-sdxl-1.0`) | Yes | none |
| **`concept_art` LoRA** (`concept_art.safetensors`; file metadata name `Lined_Concept_Art`, Civitai model 1711179) | `<lora:concept_art:0.60>` baked into the Forge ship/background/UI/creature prompts | Civitai "CreativeML Open RAIL++-M Addendum" per listing; the per-model "sell generated images" switch could not be read (Civitai API returns 403 to scripts) ⚠️ | Probably yes, UNVERIFIED | ⚠️ confirm on the model page. Also note: it is an **SDXL** LoRA but is applied to the **SD 1.5** DreamShaper 8, so it likely had little or no effect |
| **`scifi_style` LoRA** (`scifi_style.safetensors`; metadata "SDXL Science Fiction", probably Civitai model 122837) | Default LoRA of `generate_ship_art_comfy.py` (0.6) and `generate_sprites.py` factions (0.5–0.6) | Civitai "CreativeML Open RAIL++-M Addendum" per listing; sell-images switch not verified ⚠️ | Probably yes, UNVERIFIED | ⚠️ confirm; mapping of file → Civitai page is inferred from metadata |
| **`alien_species` LoRA** (`alien_species.safetensors`; metadata `alien-species`, probably Civitai "Alien Species XL" 638529) | Ascendant Empire faction in `generate_sprites.py` (0.7) | Civitai "CreativeML Open RAIL++-M Addendum" per listing ⚠️ | Probably yes, UNVERIFIED | ⚠️ confirm |
| **Stained-glass LoRA(s)** (`StainedGlass_SDXL` = "ArsMJStylePony – Stained Glass"; also installed: `StainedGlassPortrait_SDXL`, `StainedGlassStyle_SDXL`, `StainedGlassAndMetal_CE` (Z-Image base)) | README/credits say stained-glass LoRAs were used; scripts only mention `StainedGlass_SDXL.safetensors:0.4` as an opt-in example (`generate_creature_art_comfy.py`) | UNVERIFIED for all four (authors/pages not identifiable from the files) ⚠️ | UNKNOWN | 🚩 owner must identify which ones produced shipped art (generation logs) and read each Civitai licence page; "Pony"-named LoRAs may inherit Pony Diffusion terms |

Present in the local Forge `models` folder but **not referenced by any repo script**
(if any shipped asset used them, add them here): `dreamshaperXL_lightningDPMSDE`,
`synthetic_genesis`, `industrial_scifi` (named only in a comment), `space_nebula`,
`scifi_artist`, `scifi_environments` (Flux), `CrystalGlassStyle_SDXL`, pixel-art / lofi /
Ghibli LoRAs, `animatediffMotion_sdxlV10Beta.ckpt`, `SD_PixelArt_SpriteSheet_Generator`.
The ComfyUI node runs on another PC; its model folder was not inspectable, so the
ComfyUI-side names above come from the scripts only.

No negative flag was found (no "no commercial use" / "no selling images" licence)
for the models that could be verified. The Civitai LoRAs are the open point.

**Output status.** Under current US Copyright Office guidance, purely AI-generated
images are not copyrightable without sufficient human authorship, so the owner may not
hold exclusive copyright in the raw art (the curated selection, arrangement and any
hand editing may be protected). OpenRAIL licences do not claim ownership of outputs.
`LICENSE` claims all rights over the art; that is a claim, not a guarantee against copying.

Dev-only tooling (not shipped): the Anthropic API is used by `scripts/qa_ship_art.py`,
`analyze_qa_screenshots.*`, `gameplay_vision_qa.ts` for QA screenshots.

## 2. Music

| Source | Tracks | Licence / terms | Flag |
|---|---|---|---|
| **Suno** (suno.com), made by the author | 13 of 17 shipped tracks: `menu_main`, `menu_ambient`, `skirmish_combat_a/b`, `dogfight_combat`, `boss_dreadnought`, `heg_tactical`, `cors_tactical`, `long_haul`, `asteroid_belt`, `tension_alert`, `victory_common`, `defeat_common` (spec `scripts/music/suno_tracks.json`) | Suno terms: outputs made on the **free tier are for non-commercial use and owned by Suno**; outputs made **while on a paid plan (Pro/Premier)** may be used commercially and are owned by the subscriber. Applies per generation date, not at download. | 🚩 **Owner must verify the plan active on each generation date.** Prompts in `docs/SUNO_PROMPTS.md` also name existing works ("in the exact spirit of StarCraft Terran Theme 1", "Dune Sardaukar…"); stylistic references are not copying, but listen for similarity before release |
| **ACE-Step** v1 3.5B via Harmonia | 4 tracks: `syn_tactical`, `syn_combat`, `asc_tactical`, `asc_combat` (spec `scripts/music/alpha_tracks.json`) | ACE-Step code and weights: Apache-2.0 ✅ (repo `ace-step/ACE-Step`, HF `ACE-Step/ACE-Step-v1-3.5B`) | none; Harmonia is the author's own tool |
| Sound effects | all | Synthesized in real time (Web Audio); no audio files | none |

As with images, purely AI-generated audio may not be copyrightable.

## 3. Fonts

No font files are bundled and no web fonts are downloaded. Text uses the system stack
`"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (menus) and `monospace`
(HUD). Fonts render from the player's own system, so no font licence is needed. Emoji
glyphs (e.g. in Survival powers) also come from the player's system emoji font.

## 4. Libraries

Shipped in the client bundle (all MIT unless noted; full texts in
`public/THIRD_PARTY_NOTICES.txt`, versions from `package-lock.json`):

| Library | Version | Licence |
|---|---|---|
| phaser | 3.90.0 | MIT |
| ↳ Matter.js (bundled in Phaser) | 0.20.0 | MIT |
| ↳ poly-decomp (bundled in Phaser) | 0.3.0 | MIT |
| ↳ earcut (ported in Phaser) | n/a | ISC (Mapbox) |
| eventemitter3 (Phaser dependency) | 5.0.4 | MIT |
| immer | 10.2.0 | MIT |
| seedrandom | 3.0.5 | MIT |

Not in the client bundle: `ws` 8.19.0 (MIT, relay server only, `server/`), `tsx`, and
all devDependencies (Vite, Vitest, Playwright, TypeScript, ESLint, Stryker …; build/test
tooling, not distributed). If the relay server bundle (`build:server`) is ever
redistributed rather than only hosted, add `ws`'s notice.

## 5. Disclaimer

Shattered Stars is an independent work **inspired by** the mechanics of the X-Wing
Miniatures Game. It is not affiliated with, endorsed, sponsored or approved by
Lucasfilm Ltd., The Walt Disney Company, Atomic Mass Games or Fantasy Flight Games.
Star Wars, X-Wing, Wing Commander and related names are trademarks of their respective
owners. The factions, ships and characters are original.

## 6. Player-facing trademark occurrences (audit result)

Searched `src/**`, `server/src/**`, `index.html`, `public/**`, `package.json` for X-Wing,
Star Wars, Lucasfilm, Disney, Wing Commander, Atomic Mass, Fantasy Flight, TIE, Jedi,
Sith, etc. Remaining occurrences outside code comments:

- `src/data/credits.ts`: nominative / disclaimer use only. OK.
- `src/data/survival/powers.ts:390`: a Survival power is **named "Wing Commander"**
  (id `x_wingcmd`), shown to players. Recommend renaming (e.g. "Squadron Marshal").
- `package.json` `description`: "…with X-Wing Miniatures mechanics". Not shown in game;
  recommend neutral wording if the package is ever published.
- README.md and LICENSE carry the non-affiliation disclaimer (README not edited by this audit).

## ACTION ITEMS FOR THE OWNER

1. **Suno plan:** ✅ the owner confirmed (2026-10-20) a paid plan (Pro/Premier) was active
   when each of the 13 shipped tracks was generated. Keep the receipts/generation dates on
   file; free-tier tracks would have to be regenerated or removed before commercial use.
2. **Civitai LoRAs:** open the model pages for `concept_art` (Lined Concept Art, 1711179),
   `scifi_style` (SDXL Science Fiction, 122837), `alien_species` (Alien Species XL, 638529)
   and every stained-glass LoRA you actually used; confirm "Sell generated images" is
   allowed. Replace art made with any LoRA that forbids it.
3. **Identify the stained-glass LoRA(s)** used for shipped art (the repo does not record it)
   and add them (name, author, licence) to this file and, if needed, to credits.
4. **Credits accuracy:** `concept_art` is an SDXL LoRA paired with SD 1.5 DreamShaper 8; if
   it had no effect, drop it from the credits claim. Also confirm what the ComfyUI node
   used (only the script defaults are known).
5. **Rename the "Wing Commander" power** (`src/data/survival/powers.ts`) and neutralise the
   `package.json` description (files outside this audit's ownership).
6. Keep AI disclosure in the store/listing page; copyright in raw AI output is uncertain.
