# Stable Diffusion Setup for Claude Code Automation
## A1111 WebUI + API + Stained Glass LoRAs | RTX A2000 8GB | Windows

*This document is split into two parts. Part 1 is for you (JC) to do manually. Part 2 is a prompt you paste into Claude Code so it can generate art through the API.*

---

## PART 1: Manual Setup (You Do This)

### Step 1: Install A1111 WebUI

If you already have A1111 installed from the Elemental War setup, skip to Step 2. Otherwise:

```cmd
cd C:\
mkdir StableDiffusion
cd StableDiffusion
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
```

### Step 2: Edit Launch Configuration

Open `webui-user.bat` in a text editor. Replace its contents with:

```batch
@echo off

set PYTHON=
set GIT=
set VENV_DIR=
set COMMANDLINE_ARGS=--medvram --xformers --api --listen --enable-insecure-extension-access --no-half-vae

call webui.bat
```

**What each flag does:**
- `--medvram` — Keeps VRAM usage within 8GB
- `--xformers` — Faster generation, lower memory
- `--api` — **Critical.** Exposes the REST API at `/sdapi/v1/` so Claude Code can call it
- `--listen` — Binds to `0.0.0.0` so it's reachable from other processes (not just localhost browser)
- `--no-half-vae` — Prevents black image artifacts on some SDXL models

### Step 3: Download Base Model

Download **DreamShaper XL** — best stylized/fantasy model that fits in 8GB VRAM:

1. Go to: https://civitai.com/models/112902/dreamshaper-xl
2. Download the latest safetensors file (usually ~6.5GB)
3. Place it in: `stable-diffusion-webui/models/Stable-diffusion/`

**Alternative if DreamShaper XL is too large:** Use **Juggernaut XL** or the base **SDXL 1.0** model from https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0

### Step 4: Download VAE

1. Download `sdxl_vae.safetensors` from: https://huggingface.co/stabilityai/sdxl-vae/tree/main
2. Place it in: `stable-diffusion-webui/models/VAE/`

### Step 5: Download Stained Glass LoRAs

Download **both** of these. They serve different purposes:

**LoRA 1 — "Stained Glass" by ArsMagicaVII (primary)**
- URL: https://civitai.com/models/553811/stained-glass-sd15-sdxl-pony-flux
- Download the **SDXL** version
- Trigger words: `ArsMJStyle, Stained Glass`
- Recommended weight: `0.8`
- Place in: `stable-diffusion-webui/models/Lora/`
- **Rename to:** `stained_glass_ars.safetensors`

**LoRA 2 — "Stained Glass Style" by ostris (backup/mixing)**
- URL: https://civitai.com/models/122283/stained-glass-style-sdxl
- Download `v1_SDXL`
- Trigger word: `artstained glass`
- Recommended weight: `0.5-1.5` (start at `1.0`)
- Place in: `stable-diffusion-webui/models/Lora/`
- **Rename to:** `stained_glass_ostris.safetensors`

**Optional LoRA 3 — "Stained Glass and Metal" (for brass/metal integration)**
- URL: https://civitai.com/models/572156/stained-glass-and-metal-ce-sdxl-and-flux
- Good for portraits that need both glass AND metallic frame elements
- Place in: `stable-diffusion-webui/models/Lora/`
- **Rename to:** `stained_glass_metal.safetensors`

### Step 6: Launch and Verify

1. Run `webui-user.bat`
2. Wait for startup to complete (first run downloads dependencies, ~10-30 min)
3. Verify the WebUI loads at: http://127.0.0.1:7860
4. Verify the API docs load at: http://127.0.0.1:7860/docs
5. In the WebUI, go to **Settings > Stable Diffusion > SD VAE** and select `sdxl_vae.safetensors`
6. Click **Apply settings** then **Reload UI**

### Step 7: Quick Manual Test

In the WebUI, try this prompt to confirm the LoRA works:

**Prompt:**
```
stained glass portrait, weathered seafaring captain, bold black leading lines, 
flat colored glass panels, luminous backlight glow, gothic arch frame, 
compass and anchor motifs, medieval saint style, rich blue and gold tones
<lora:stained_glass_ars:0.8>
```

**Negative prompt:**
```
blurry, realistic photo, 3d render, gradient fills, soft edges, watermark, 
signature, text, jpeg artifacts, low quality
```

**Settings:**
- Model: DreamShaper XL
- Sampler: DPM++ 2M Karras
- Steps: 25
- CFG Scale: 8
- Size: 512x512
- Batch size: 1

If you get a luminous stained glass portrait with bold leading lines, you're good to go.

### Step 8: Verify API Access

Open a new terminal and run:

```cmd
curl http://127.0.0.1:7860/sdapi/v1/sd-models
```

You should get a JSON response listing your installed models. If this works, Claude Code can reach the API.

### Step 9: Create Output Directories

```cmd
mkdir C:\StableDiffusion\tides-of-fortune-assets
mkdir C:\StableDiffusion\tides-of-fortune-assets\portraits
mkdir C:\StableDiffusion\tides-of-fortune-assets\vignettes
mkdir C:\StableDiffusion\tides-of-fortune-assets\events
mkdir C:\StableDiffusion\tides-of-fortune-assets\textures
mkdir C:\StableDiffusion\tides-of-fortune-assets\style-anchors
```

---

## PART 2: Claude Code Prompt

Copy everything below this line and paste it into Claude Code when you're ready to generate art.

---

```
You have access to a local Stable Diffusion A1111 WebUI running at http://127.0.0.1:7860 with the API enabled. You will use this to generate art assets for Tides of Fortune in a stained glass aesthetic.

## API Access

The A1111 API is at http://127.0.0.1:7860/sdapi/v1/. No authentication required. Key endpoints:

- POST /sdapi/v1/txt2img — Generate images from text
- POST /sdapi/v1/img2img — Generate variations from an existing image
- POST /sdapi/v1/extra-single-image — Upscale an image
- GET /sdapi/v1/sd-models — List available models
- GET /sdapi/v1/loras — List available LoRAs
- GET /sdapi/v1/progress — Check generation progress

## Python Generation Script

Create this utility script first at the project root as `sd_generate.py`, then call its functions for each asset batch:

###SCRIPT START###
import requests
import base64
import json
import os
import time

SD_URL = "http://127.0.0.1:7860"
OUTPUT_BASE = r"C:\StableDiffusion\tides-of-fortune-assets"

NEGATIVE_PROMPT = (
    "blurry, realistic photo, 3d render, gradient fills, soft edges, "
    "watermark, signature, text, jpeg artifacts, low quality, deformed, "
    "bad anatomy, disfigured, poorly drawn face, mutated, extra limbs, "
    "ugly, out of frame, duplicate, morbid"
)

BASE_PARAMS = {
    "negative_prompt": NEGATIVE_PROMPT,
    "sampler_name": "DPM++ 2M Karras",
    "steps": 25,
    "cfg_scale": 8,
    "width": 512,
    "height": 512,
    "batch_size": 1,
    "n_iter": 1,
    "save_images": True,
    "send_images": True,
}

def generate(prompt, output_path, seed=-1, width=512, height=512, 
             steps=25, cfg_scale=8.0, lora_weight=0.8,
             use_metal_lora=False, tiling=False, skip_lora=False):
    """Generate a single image and save it. Returns the output filepath."""
    
    if skip_lora:
        full_prompt = prompt
    else:
        full_prompt = f"{prompt} <lora:stained_glass_ars:{lora_weight}>"
        if use_metal_lora:
            full_prompt += " <lora:stained_glass_metal:0.5>"
    
    payload = {
        **BASE_PARAMS,
        "prompt": full_prompt,
        "seed": seed,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "tiling": tiling,
    }
    
    response = requests.post(f"{SD_URL}/sdapi/v1/txt2img", json=payload)
    r = response.json()
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(base64.b64decode(r['images'][0]))
    
    info = json.loads(r['info'])
    info_path = output_path.replace('.png', '_info.json')
    with open(info_path, 'w') as f:
        json.dump({
            "prompt": full_prompt,
            "negative_prompt": NEGATIVE_PROMPT,
            "seed": info['seed'],
            "steps": steps,
            "cfg_scale": cfg_scale,
            "width": width,
            "height": height,
        }, f, indent=2)
    
    print(f"Saved: {output_path} (seed: {info['seed']})")
    return output_path


def generate_batch(prompt, output_dir, prefix, count=5, **kwargs):
    """Generate multiple variations for selection."""
    paths = []
    for i in range(count):
        path = os.path.join(output_dir, f"{prefix}_{i+1:02d}.png")
        generate(prompt, path, **kwargs)
        paths.append(path)
        time.sleep(1)
    return paths


def img2img_variant(input_path, prompt, output_path,
                    denoising_strength=0.4, lora_weight=0.8):
    """Create a variant of an existing image."""
    
    with open(input_path, 'rb') as f:
        input_b64 = base64.b64encode(f.read()).decode()
    
    full_prompt = f"{prompt} <lora:stained_glass_ars:{lora_weight}>"
    
    payload = {
        **BASE_PARAMS,
        "prompt": full_prompt,
        "init_images": [input_b64],
        "denoising_strength": denoising_strength,
    }
    
    response = requests.post(f"{SD_URL}/sdapi/v1/img2img", json=payload)
    r = response.json()
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(base64.b64decode(r['images'][0]))
    
    print(f"Saved variant: {output_path}")
    return output_path


def upscale(input_path, output_path, scale=2):
    """Upscale an image 2x."""
    
    with open(input_path, 'rb') as f:
        input_b64 = base64.b64encode(f.read()).decode()
    
    payload = {
        "image": input_b64,
        "resize_mode": 0,
        "upscaling_resize": scale,
        "upscaler_1": "R-ESRGAN 4x+",
    }
    
    response = requests.post(f"{SD_URL}/sdapi/v1/extra-single-image", json=payload)
    r = response.json()
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(base64.b64decode(r['image']))
    
    print(f"Upscaled: {output_path}")
    return output_path


def verify_api():
    """Call first to confirm A1111 is running and LoRAs are loaded."""
    try:
        models = requests.get(f"{SD_URL}/sdapi/v1/sd-models").json()
        loras = requests.get(f"{SD_URL}/sdapi/v1/loras").json()
        options = requests.get(f"{SD_URL}/sdapi/v1/options").json()
        
        print("=== SD API Status ===")
        print(f"Current model: {options.get('sd_model_checkpoint', 'unknown')}")
        print(f"Available models: {[m['title'] for m in models]}")
        print(f"Available LoRAs: {[l['name'] for l in loras]}")
        print(f"API is reachable: YES")
        
        lora_names = [l['name'] for l in loras]
        if 'stained_glass_ars' not in lora_names:
            print("WARNING: stained_glass_ars LoRA not found! Check filename.")
        else:
            print("stained_glass_ars LoRA: FOUND")
            
        return True
    except requests.ConnectionError:
        print("ERROR: Cannot reach A1111 API at http://127.0.0.1:7860")
        print("Make sure webui-user.bat is running with --api flag")
        return False
###SCRIPT END###


## Asset Generation Specifications

Before generating any batch, always call verify_api() first.

### Generation Order

Phase 0: API verification — call verify_api(). Stop if it fails.

Phase 1: Style anchor (DO THIS FIRST) — generate 10 Navigator portrait variations. 
Present them to the user. User picks the best one. Save that seed.

Phase 2: Officer portraits — using the style anchor's prompt structure, generate all officers.

Phase 3: Port vignettes — circular rose window compositions.

Phase 4: Event illustrations — small stained glass vignettes.

Phase 5: Tiling textures — realistic materials, NO LoRA, tiling=True.

### Prompt Templates

OFFICER PORTRAITS (512x512, steps: 28, cfg: 8.5, lora: 0.8)

Base pattern:
stained glass portrait, [CHARACTER DESCRIPTION], bold black leading lines, 
flat colored glass panels, luminous backlight glow, gothic arch frame, 
[ROLE ICONOGRAPHY], medieval saint style, ornate border, rich saturated colors, 
game asset, clean design, ArsMJStyle, Stained Glass

Officer roster:

Navigator: weathered seafaring woman with determined eyes, compass star halo | blue and gold | star and wave motifs
First Mate: scarred grizzled man with commanding presence, crossed cutlasses behind shoulders | red and dark brown | rope and anchor motifs
Bosun: stout weathered sailor with calloused hands, coiled rope over shoulder | teal and bronze | knot and mast motifs
Quartermaster: shrewd merchant with calculating eyes and slight smile, ledger book | green and gold | coin and key motifs
Engineer: soot-marked woman with clever eyes, wrench and gear | copper and steel grey | gear and hull motifs
Gunner: one-eyed veteran with scarred face, cannonball resting on palm | crimson and black | cannon and powder motifs
Surgeon: calm elderly man with steady hands, medical instruments | white and deep blue | serpent and herb motifs
Lookout: young keen-eyed boy perched high, spyglass raised | sky blue and silver | eye and horizon motifs
Cook: heavyset jolly person with ladle, steam rising | warm amber and cream | pot and flame motifs
Chaplain: hooded figure with serene expression, sacred text | purple and gold | book and light motifs

Generate 8 variations per officer. User picks best. Then use img2img at denoising 0.35 on the selected one for 2-3 expression/state variants (injured = dimmer palette, disloyal = cooler tones).


PORT VIGNETTES (512x512, steps: 25, cfg: 8, lora: 0.8)

Base pattern:
circular stained glass window, [PORT DESCRIPTION], harbor scene, 
bold black leading lines, flat colored glass panels, rose window radial composition, 
medieval cathedral glass, rich [COLOR PALETTE] tones, game asset,
ArsMJStyle, Stained Glass

Port types:
Tropical trading hub: palm trees, merchant ships, exotic marketplace, warm sunlight | amber, coral, turquoise
Temperate port city: stone harbor walls, tall ships, church spire, grey skies | slate, brown, forest green
Arctic outpost: ice floes, fur-laden ships, northern lights in sky | ice blue, silver, aurora green
Pirate haven: dark rocky harbor, black-sailed ships, skull motifs, broken glass edges | deep red, black, bone white
Wealthy capital: grand harbor with lighthouse, gold-trimmed buildings, naval fleet | gold, royal blue, white marble
Volcanic island: smoking peak behind harbor, obsidian docks, red-lit water | deep red, obsidian black, ember orange
Fishing village: small wooden docks, fishing boats, seagulls, simple charm | warm grey, ocean blue, sandy tan
Smuggler's cove: hidden inlet, overhanging cliffs, single lantern, secretive | dark green, midnight blue, dim amber

Generate 5 variations per port.


EVENT ILLUSTRATIONS (512x512, steps: 25, cfg: 8, lora: 0.75)

Base pattern:
stained glass vignette, [EVENT DESCRIPTION], bold black leading lines, 
flat colored glass panels, dramatic composition, medieval manuscript illustration style, 
rich saturated colors, game art, ArsMJStyle, Stained Glass

Events:
Storm: ship tossed on towering dark waves, lightning splitting sky, sailors bracing
Sea monster: massive tentacles rising from deep blue water, ship in peril
Discovery: sunlit new island on horizon, ship's bow pointing forward, golden light
Mutiny: angry crew surrounding captain on deck, crossed weapons, red tension
Treasure: open chest of gold on sandy shore, palm trees, sunbeams through clouds
Plague: sickly green mist on deck, surgeon tending fallen sailors
Pirate attack: two ships exchanging cannon fire, smoke and flame, torn sails
Calm seas: serene blue water, golden sunset, dolphins alongside ship
Port festival: harbor decorated with banners, fireworks, celebrating crowd
Shipwreck: broken hull on rocks, stormy sky, scattered cargo

Generate 5 variations per event.


TILING TEXTURES (512x512, steps: 20, cfg: 7, NO LORA, tiling=True, skip_lora=True)

Walnut grain: seamless tileable dark walnut wood grain texture, oiled finish, warm brown, subtle grain pattern, photorealistic, high detail
Mahogany grain: seamless tileable mahogany wood grain texture, rich red-brown, polished, visible grain lines, photorealistic
Aged vellum: seamless tileable aged parchment paper texture, yellowed, subtle foxing marks, old manuscript paper, slightly wrinkled
Worn leather: seamless tileable worn brown leather texture, subtle stitching marks, soft grain, aged patina
Brass patina: seamless tileable tarnished brass metal texture, golden with green patina spots, polished areas, aged metal surface
Iron surface: seamless tileable dark iron metal texture, slight rust, matte finish, aged
Glass noise: seamless tileable frosted glass texture, subtle bubbles and imperfections, translucent, hand-blown glass surface, very subtle

Generate 3 variations per texture.


## Output Directory

C:\StableDiffusion\tides-of-fortune-assets\
  style-anchors\          Phase 1 navigator variants
  portraits\
    navigator\            8 variants + selected + expression variants
    first-mate\
    bosun\
    quartermaster\
    engineer\
    gunner\
    surgeon\
    lookout\
    cook\
    chaplain\
  vignettes\
    tropical-trading\
    temperate-port\
    arctic-outpost\
    pirate-haven\
    wealthy-capital\
    volcanic-island\
    fishing-village\
    smugglers-cove\
  events\
    storm\
    sea-monster\
    discovery\
    mutiny\
    treasure\
    plague\
    pirate-attack\
    calm-seas\
    port-festival\
    shipwreck\
  textures\

Always save _info.json alongside every image so seeds can be reproduced.

## Rules

1. Always verify_api() first. If A1111 is not running, tell the user.
2. Phase 1 (style anchor) must complete and user must select before generating other officers.
3. Save every variation. Never overwrite. User picks the winners.
4. Save seed info. Every image gets _info.json with seed, prompt, settings.
5. 1-second delay between API calls to avoid GPU overload.
6. Textures do NOT use stained glass LoRA. Use base model + tiling=True + skip_lora=True.
7. Portrait img2img variants use denoising 0.3-0.4. Higher values lose character identity.
8. If generation returns a black image, reduce to 448x448 or add override_settings: {"sd_vae": "None"} and retry.
9. LoRA must be named stained_glass_ars.safetensors in the Lora folder exactly. If verify_api() cannot find it, tell the user to check the filename.
```
