# Shattered Stars — Stable Diffusion Art Pipeline
## Faction-Specific LoRA Toolkit | RTX A2000 8GB | StarCraft 2 Cinematic Style

*Version 1.0 | March 3, 2026*

---

## Visual Target

**StarCraft 2 cinematics** — but with clearer colors, higher contrast, and punchier effects. Think Blizzard's pre-rendered cutscenes translated to a slightly more stylized, painterly concept-art register. Not photorealistic, not cartoon. Cinematic digital painting with bold, readable faction silhouettes and vivid weapon/engine VFX.

Key differentiators from generic sci-fi:
- **Faction readability at a glance** — each faction has an instantly recognizable shape language and color identity
- **High contrast effects** — weapons fire, shields, engines should POP against dark space
- **Clean design over gritty realism** — these are game assets, not film VFX. Clarity wins.

---

## Faction Visual Identities

### TERRAN HEGEMONY — *"Order Through Unity"*
**Colors:** Imperial Blue (#1E40AF), Silver (#C0C0C0), White (#F8FAFC)
**Shape Language:** Angular, symmetrical, blocky. Star Destroyers meet Battlecruisers. Sharp edges, visible armor plating, ordered structure. Turrets in neat rows. Bridge towers. Formation-oriented.
**Materials:** Polished steel, blue-lit panels, white ceramic armor plating, disciplined LED strips
**VFX Signature:** Blue-white railgun tracers, broad shield domes (hex grid pattern), coordinated volley fire
**Reference Feel:** Imperial Star Destroyer + SC2 Battlecruiser + Mass Effect Alliance

### FREE CONFEDERATION — *"Liberty or Death"*
**Colors:** Rebel Orange (#EA580C), Forest Green (#166534), Gold (#CA8A04)
**Shape Language:** Diverse, asymmetric, kitbashed. Converted freighters, retrofitted civilian ships, visible repairs. Each ship looks unique but shares warmth and practicality.
**Materials:** Worn painted hulls, exposed wiring, welded patches, custom nose art, mismatched panels
**VFX Signature:** Orange-gold missile contrails, flickering green shield bubbles, improvised weapon flashes
**Reference Feel:** Rebel Alliance + Firefly + SC2 Terran (rugged side)

### SYNTHETIC COLLECTIVE — *"Logic. Efficiency. Perfection."*
**Colors:** Gunmetal Gray (#374151), Electric Blue (#3B82F6), Chrome (#E5E7EB)
**Shape Language:** Geometric, modular, fractal. Ships that look assembled from standardized components. No wasted space. Tessellating hull segments. Drone swarm aesthetics.
**Materials:** Brushed metal, holographic projections, fiber-optic webs, seamless joints, no visible rivets
**VFX Signature:** Electric blue calculation grids, precise laser lines, networked beam linking, data-stream particle trails
**Reference Feel:** SC2 Protoss (mechanical side) + Tron + Mass Effect Geth

### VOID CORSAIRS — *"Fortune Favors the Bold"*
**Colors:** Deep Purple (#581C87), Crimson Red (#991B1B), Brass (#B8860B)
**Shape Language:** Aggressive, baroque, predatory. Spiked prows, swept-back wings, exposed engines. Intimidation as design philosophy. Trophy racks, skull motifs, exotic alien bolted-on parts.
**Materials:** Dark painted metal, brass fittings, trophy bones, alien tech grafts, neon accent strips, scarred hulls
**VFX Signature:** Crimson plasma bolts, purple cloaking shimmer, brass-colored tractor beams, chaotic missile swarms
**Reference Feel:** 40K Dark Eldar + Borderlands + Cowboy Bebop bounty hunters

### ASCENDANT EMPIRE — *"Evolution Through Supremacy"*
**Colors:** Emerald Green (#059669), Dark Gold (#92400E), Obsidian Black (#0A0A0A)
**Shape Language:** Organic, flowing, biomechanical. Ships that look grown, not built. Curved carapace hulls, membrane wings, bioluminescent veins. Chitinous armor with golden circuitry underneath.
**Materials:** Chitin, living membrane, crystalline nodes, bio-luminescent veins, golden neural pathways, obsidian bone
**VFX Signature:** Green psionic waves, gold-veined energy tendrils, organic torpedo pods that bloom open, regeneration aura glow
**Reference Feel:** SC2 Zerg/Protoss hybrid + Tyranids + Wraith (Stargate)

---

## LoRA Toolkit

Unlike Tides of Fortune (one style LoRA for everything), Shattered Stars needs a modular set mixed per faction and asset type. All LoRAs use the same base model: **DreamShaper XL** (already installed from TofF setup).

### Core LoRAs (Used Across All Factions)

**LoRA 1 — "Sci-Fi Artist XL" (primary style driver)**
- URL: https://civitai.com/models/950583/sci-fi-artist-xl-lora
- Purpose: Establishes the overall cinematic sci-fi concept art look
- Weight: 0.6-0.8
- Rename to: `scifi_artist.safetensors`

**LoRA 2 — "SDXL Science Fiction Style" (broad sci-fi vocabulary)**
- URL: https://civitai.com/models/122837/sdxl-science-fiction-style
- Purpose: Trained on 1531 sci-fi renders — ships, aliens, planets, robots. Broadens the model's sci-fi vocabulary.
- Weight: 0.4-0.6 (use as supplement, not primary)
- Rename to: `scifi_style.safetensors`

**LoRA 3 — "Lined Concept Art" (clean design sheets)**
- URL: https://civitai.com/models/1711179/lined-concept-art
- Purpose: When you need clean concept art turnarounds (ship reference sheets, character designs). Gives that professional concept art line quality.
- Weight: 0.7-1.0
- Rename to: `concept_art.safetensors`

### Faction-Specific LoRAs

**LoRA 4 — "Industrial Sci-Fi SDXL" (Terran Hegemony + Free Confederation)**
- URL: https://civitai.com/models/417289/industrial-sci-fi-sdxl
- Purpose: Industrial, technical, hard-surface detailing. Perfect for human faction ships with visible plating, turrets, hangar bays.
- Weight: 0.5-0.7
- Rename to: `industrial_scifi.safetensors`

**LoRA 5 — "Synthetic Genesis" (Synthetic Collective)**
- URL: https://civitai.com/models/413748/synthetic-genesis-lora-sdxl
- Purpose: Biomechanical/android aesthetics. Sleek machine intelligence, chrome surfaces, geometric precision.
- Weight: 0.5-0.7
- Rename to: `synthetic_genesis.safetensors`

**LoRA 6 — "Alien Species XL" (Ascendant Empire portraits)**
- URL: https://civitai.com/models/638529/alien-species-xl
- Purpose: Alien heads, portraits, full body. For generating Ascendant Empire characters with exotic alien anatomy.
- Trigger: `alien species`
- Weight: 0.7-1.0
- Rename to: `alien_species.safetensors`

### Environment LoRAs

**LoRA 7 — "Sci-Fi Environments" (all factions — space scenes)**
- URL: https://civitai.com/models/105945/sci-fi-environments
- Purpose: Cinematic sci-fi environments. Battles in space, orbital stations, nebula backdrops.
- Weight: 0.5-0.7 (SDXL version)
- Rename to: `scifi_environments.safetensors`

**LoRA 8 — "Space Nebula" (skyboxes and battle backdrops)**
- URL: https://civitai.com/models/295144/space-nebula-flux-sdxl-and-pony
- Purpose: Gorgeous nebula backgrounds. Use for skybox textures and dramatic battle backdrops.
- Trigger: `mad-nbla`
- Weight: 0.8-1.0 (SDXL version)
- Rename to: `space_nebula.safetensors`

### Summary Table

| LoRA | File | Used For | Weight |
|------|------|----------|--------|
| Sci-Fi Artist XL | scifi_artist.safetensors | All factions — primary style | 0.6-0.8 |
| SDXL Sci-Fi Style | scifi_style.safetensors | All factions — vocabulary boost | 0.4-0.6 |
| Lined Concept Art | concept_art.safetensors | Ship turnarounds, design sheets | 0.7-1.0 |
| Industrial Sci-Fi | industrial_scifi.safetensors | Terran + Confed ships | 0.5-0.7 |
| Synthetic Genesis | synthetic_genesis.safetensors | Synthetic Collective ships/units | 0.5-0.7 |
| Alien Species XL | alien_species.safetensors | Ascendant Empire characters | 0.7-1.0 |
| Sci-Fi Environments | scifi_environments.safetensors | Space battles, stations | 0.5-0.7 |
| Space Nebula | space_nebula.safetensors | Skyboxes, backdrops | 0.8-1.0 |

Place all in: `stable-diffusion-webui/models/Lora/`

---

## LoRA Mixing Recipes Per Faction

The key to distinct faction identities: **different LoRA combinations produce different visual languages** even with similar prompts.

### Terran Hegemony
```
<lora:scifi_artist:0.7> <lora:industrial_scifi:0.6>
```
The industrial LoRA provides the hard-surface military detailing. The sci-fi artist LoRA keeps it painterly rather than photorealistic.

### Free Confederation
```
<lora:scifi_artist:0.7> <lora:industrial_scifi:0.4>
```
Lower industrial weight = less polished, more improvised. Prompt does the rest (worn paint, patches, kitbash).

### Synthetic Collective
```
<lora:scifi_artist:0.6> <lora:synthetic_genesis:0.6>
```
The synthetic genesis LoRA pushes toward geometric machine aesthetics. Combined with prompts for chrome and electric blue accents.

### Void Corsairs
```
<lora:scifi_artist:0.8>
```
Corsairs use primarily the artist LoRA at higher weight for more stylized/baroque results. Their uniqueness comes from aggressive prompt language (spiked, predatory, trophy-adorned) rather than a specific faction LoRA.

### Ascendant Empire
```
<lora:scifi_artist:0.6> <lora:alien_species:0.5>
```
For ships: just scifi_artist (organic shapes come from prompts: chitinous, membrane, bioluminescent).
For character portraits: add alien_species to get exotic anatomy.

### Space Backgrounds (any faction)
```
<lora:scifi_environments:0.6> <lora:space_nebula:0.7>
```

---

## Asset Categories and Prompt Templates

### Shared Negative Prompt (All Shattered Stars Assets)
```
blurry, low quality, watermark, signature, text, jpeg artifacts, 
photorealistic photograph, cartoon, anime, chibi, pixel art, 
low contrast, washed out colors, muddy palette, grey, dull
```

Note the "low contrast, washed out, muddy, grey, dull" negatives — these specifically enforce the "clearer colors, more contrast" requirement.

### 1. Ship Concept Art (Per Faction)

512x512 or 768x512 landscape. Steps: 28. CFG: 8.5.

**Base pattern:**
```
cinematic sci-fi concept art, [SHIP DESCRIPTION], [FACTION MATERIALS], 
dramatic lighting, deep space background, high contrast, vivid colors, 
sharp details, digital painting, game asset, [FACTION COLORS]
```

**Terran Hegemony ships:**
```
cinematic sci-fi concept art, massive angular battlecruiser, 
polished steel hull with blue LED panel strips, symmetric turret rows, 
command bridge tower, white ceramic armor plating, imperial blue accents, 
disciplined military design, formation-oriented warship, 
dramatic lighting, deep space background, high contrast, vivid colors,
digital painting, game asset
<lora:scifi_artist:0.7> <lora:industrial_scifi:0.6>
```

**Free Confederation ships:**
```
cinematic sci-fi concept art, asymmetric retrofitted freighter warship,
worn orange-painted hull with welded repair patches, exposed wiring,
mismatched armor panels, custom nose art, improvised weapon mounts,
forest green accent markings, gold trim on bridge, rugged practical design,
dramatic lighting, deep space background, high contrast, vivid colors,
digital painting, game asset
<lora:scifi_artist:0.7> <lora:industrial_scifi:0.4>
```

**Synthetic Collective ships:**
```
cinematic sci-fi concept art, geometric modular drone carrier,
tessellating chrome hull segments, no visible rivets or seams, 
holographic projection nodes, electric blue fiber-optic web patterns,
fractal antenna arrays, seamless gunmetal grey construction,
calculated precision design, dramatic lighting, deep space background, 
high contrast, vivid electric blue glow, digital painting, game asset
<lora:scifi_artist:0.6> <lora:synthetic_genesis:0.6>
```

**Void Corsair ships:**
```
cinematic sci-fi concept art, aggressive predatory raider ship,
spiked prow, swept-back blade wings, exposed oversized engines,
deep purple hull with crimson accent stripes, brass trophy fittings,
skull motifs, alien tech grafted onto hull, scarred battle-worn armor,
intimidating baroque design, dramatic lighting, deep space background,
high contrast, vivid crimson and purple glow, digital painting, game asset
<lora:scifi_artist:0.8>
```

**Ascendant Empire ships:**
```
cinematic sci-fi concept art, organic biomechanical capital ship,
curved chitinous carapace hull, membrane solar wings, 
bioluminescent emerald green veins pulsing across surface,
golden neural circuit patterns beneath obsidian bone armor,
crystalline psionic nodes along spine, grown not built,
living alien warship, dramatic lighting, deep space background,
high contrast, vivid green bioluminescence, digital painting, game asset
<lora:scifi_artist:0.6>
```

### 2. Pilot/Commander Portraits

512x512. Steps: 28. CFG: 8.

**Terran Hegemony officer:**
```
cinematic portrait, stern military commander in imperial blue uniform,
silver rank insignia, white collar, short disciplined hair, 
hard lighting from bridge displays, steel-grey eyes, 
digital painting, high contrast, sci-fi military, sharp details
<lora:scifi_artist:0.7>
```

**Free Confederation pilot:**
```
cinematic portrait, rugged rebel pilot in worn flight jacket,
orange flight suit with green patches, aviator goggles on forehead,
confident grin, scars and stubble, warm cockpit lighting,
digital painting, high contrast, sci-fi rebel, sharp details
<lora:scifi_artist:0.7>
```

**Synthetic Collective unit:**
```
cinematic portrait, sleek chrome android face, 
electric blue optic sensors for eyes, minimal facial features,
geometric panel lines on skull plate, holographic data overlay,
cold blue-white lighting, digital painting, high contrast, 
machine intelligence, sharp details
<lora:scifi_artist:0.6> <lora:synthetic_genesis:0.6>
```

**Void Corsair captain:**
```
cinematic portrait, scarred pirate captain with cybernetic eye,
deep purple cloak with crimson lining, brass mechanical arm,
alien bone trophy necklace, cruel confident expression,
dramatic side-lighting, dark background, digital painting, 
high contrast, sci-fi pirate, sharp details
<lora:scifi_artist:0.8>
```

**Ascendant Empire commander:**
```
cinematic portrait, alien hybrid with elongated skull,
emerald bioluminescent veins on dark obsidian skin,
golden eyes with no pupils, organic crown-like cranial crest,
psionic energy aura, ethereal lighting, alien species,
digital painting, high contrast, evolved alien, sharp details
<lora:scifi_artist:0.6> <lora:alien_species:0.7>
```

### 3. Skybox / Space Backgrounds

1024x512 (wide for skybox unwrap). Steps: 25. CFG: 7.

```
deep space panorama, vibrant colorful nebula clouds, 
distant star clusters, cosmic dust, [BATTLE ZONE DESCRIPTION],
dramatic rim lighting, high contrast, saturated vivid colors,
cinematic space vista, digital painting, mad-nbla
<lora:scifi_environments:0.5> <lora:space_nebula:0.8>
```

Variants per battle zone:
- **Contested space:** warm orange-red nebula, debris field, distant explosions
- **Hegemony territory:** cool blue nebula, ordered star formations, distant fleet silhouettes
- **Corsair hunting grounds:** dark purple void with crimson nebula wisps, asteroid field
- **Convergence rift zone:** reality-tearing dimensional cracks, impossible colors, spatial distortion
- **Ascendant homeworld:** emerald-green bioluminescent nebula, organic space structures

### 4. UI Elements / Faction Emblems

512x512. Steps: 25. CFG: 9. Use concept_art LoRA for clean line work.

```
faction emblem design, [FACTION DESCRIPTION], clean vector-style,
metallic material, [FACTION COLORS], symmetrical composition,
game UI element, sharp edges, high contrast, dark background,
concept art, graphic design
<lora:concept_art:0.8>
```

### 5. VFX Reference Frames

512x512. Steps: 20. CFG: 7.

For generating reference art that Unity VFX artists/shaders can match:

```
sci-fi weapon effect, [EFFECT DESCRIPTION], black background,
high contrast, vivid [COLOR], energy glow, particle trail,
game VFX reference, clean design, sharp details
<lora:scifi_artist:0.5>
```

Examples:
- Terran: `blue-white railgun beam, linear tracer with hexagonal shield impact ripple`
- Confed: `orange-gold missile contrail, scattered warhead separation, fiery exhaust`
- Synthetic: `precise thin electric blue laser beam, geometric calculation grid overlay`
- Corsair: `crimson plasma bolt, chaotic energy tendrils, unstable glow`
- Ascendant: `emerald green psionic wave, organic tendril energy, golden vein lightning`

---

## Generation Budget Estimate

| Category | Count | Per Faction | Total |
|----------|-------|-------------|-------|
| Ship concepts (4-6 types per faction) | 5-8 variants each | ~40 per faction | ~200 |
| Pilot/commander portraits | 8 variants each | ~25 per faction | ~125 |
| Faction emblems + insignia | 5-10 variants | ~8 per faction | ~40 |
| Skybox backgrounds | 5 variants each | shared + per-zone | ~40 |
| VFX reference frames | 3-5 per effect | ~15 per faction | ~75 |
| UI frames / HUD elements | 5 variants each | ~10 per faction | ~50 |
| **TOTAL** | | | **~530** |

At ~15-20 seconds per image on RTX A2000: roughly 2.5-3 hours of generation time.

---

## Output Directory

```
C:\StableDiffusion\shattered-stars-assets\
├── terran-hegemony\
│   ├── ships\
│   ├── portraits\
│   ├── emblems\
│   ├── vfx-ref\
│   └── ui\
├── free-confederation\
│   ├── ships\
│   ├── portraits\
│   ├── emblems\
│   ├── vfx-ref\
│   └── ui\
├── synthetic-collective\
│   ├── ships\
│   ├── portraits\
│   ├── emblems\
│   ├── vfx-ref\
│   └── ui\
├── void-corsairs\
│   ├── ships\
│   ├── portraits\
│   ├── emblems\
│   ├── vfx-ref\
│   └── ui\
├── ascendant-empire\
│   ├── ships\
│   ├── portraits\
│   ├── emblems\
│   ├── vfx-ref\
│   └── ui\
├── shared\
│   ├── skyboxes\
│   ├── star-fields\
│   └── convergence-rifts\
└── style-anchors\
    ├── terran-anchor.png
    ├── confed-anchor.png
    ├── synthetic-anchor.png
    ├── corsair-anchor.png
    └── ascendant-anchor.png
```

---

## Generation Workflow

### Phase 0: Verify Setup
Same DreamShaper XL base model from Tides of Fortune. Just add the new LoRAs to the Lora folder.

### Phase 1: Style Anchors (ONE ship per faction)
Generate 10 variations of each faction's signature ship. You pick the best one per faction. These five anchors define the entire visual identity of the game.

**Order matters:**
1. Terran Hegemony battlecruiser (establishes the "normal" human baseline)
2. Free Confederation flagship (establishes the "scrappy" contrast)
3. Synthetic Collective carrier (establishes the machine aesthetic)
4. Void Corsair raider (establishes the aggressive baroque)
5. Ascendant Empire bioship (establishes the organic alien)

### Phase 2: Full Ship Roster
Using each faction's anchor as img2img reference (denoising 0.5-0.6), generate the full ship roster per faction: fighter, bomber, corvette, frigate, capital ship, special unit.

### Phase 3: Portraits
One style anchor portrait per faction, then batch generate the rest.

### Phase 4: Skyboxes + Environments
Wide-format space backgrounds for each battle zone type.

### Phase 5: UI + Emblems + VFX Reference
Clean graphic design assets. Use concept_art LoRA at higher weight for sharper line work.

---

## Notes for Claude Code Integration

The same `sd_generate.py` script from the Tides of Fortune setup works here. The only change is swapping LoRA tags in the prompts. You can add a faction-aware wrapper:

```python
FACTION_LORAS = {
    "terran":     "<lora:scifi_artist:0.7> <lora:industrial_scifi:0.6>",
    "confed":     "<lora:scifi_artist:0.7> <lora:industrial_scifi:0.4>",
    "synthetic":  "<lora:scifi_artist:0.6> <lora:synthetic_genesis:0.6>",
    "corsair":    "<lora:scifi_artist:0.8>",
    "ascendant":  "<lora:scifi_artist:0.6>",
    "ascendant_portrait": "<lora:scifi_artist:0.6> <lora:alien_species:0.7>",
    "environment": "<lora:scifi_environments:0.6> <lora:space_nebula:0.7>",
    "emblem":     "<lora:concept_art:0.8>",
}

def generate_faction(prompt, faction, output_path, **kwargs):
    lora_tags = FACTION_LORAS[faction]
    full_prompt = f"{prompt} {lora_tags}"
    return generate(full_prompt, output_path, skip_lora=True, **kwargs)
```

This lets Claude Code call `generate_faction(prompt, "terran", path)` and the right LoRA recipe is applied automatically.
