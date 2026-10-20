#!/usr/bin/env python3
"""generate_portraits_comfy.py — Portrait sheets of named characters on the remote ComfyUI node.

Reuses the creature script's ComfyClient / load_config, so credentials are read at runtime from the
gitignored comfyui.config at the repo root and never stored in, or printed by, this script.

  python scripts/generate_portraits_comfy.py sheets [--only ID] [--seeds 4]
      renders N SDXL candidates per portrait (768x1152) and one contact sheet per portrait into
      %TEMP%/shattered_stars_comfy/portraits (nothing is written to the repo).
  python scripts/generate_portraits_comfy.py finalize --pick kronos=2 --pick vosk=1 ...
      fits the chosen candidate to 512x768 (base frame), renders a "speaking" variant of it
      (img2img, same seed) and writes public/assets/portraits/<faction>/<id>_sheet.png + .json.
      The sheet is the two 512x768 frames stacked (base on top, talk below), which is the layout of
      the portrait sheets already shipped; the JSON atlas names the frames "base" and "talk".
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from generate_creature_art_comfy import ComfyClient, load_config  # noqa: E402

PORTRAITS_DIR = SCRIPT_DIR.parent / "public" / "assets" / "portraits"
WORK_DIR = Path(tempfile.gettempdir()) / "shattered_stars_comfy" / "portraits"

CHECKPOINT = "sd_xl_base_1.0.safetensors"
VAE = "sdxl_vae_fp16fix.safetensors"
RENDER_SIZE = (768, 1152)  # 2:3, resized to the 512x768 frame
FRAME_SIZE = (512, 768)
STEPS = 30
CFG = 6.5
SAMPLER = "dpmpp_2m"
SCHEDULER = "karras"
TALK_DENOISE = 0.42  # low enough to keep the face and costume, high enough to move the mouth
TALK_PROMPT = "mouth slightly open, speaking expression, mid-sentence, expressive animated face, "
STYLE = (
    "character portrait, bust shot, looking at the viewer, digital painting, concept art, "
    "bold rich colors, dramatic rim lighting, detailed face, detailed hair, game portrait, "
)
NEGATIVE = (
    "text, watermark, signature, blurry, low quality, deformed, full body, anime, cartoon, "
    "multiple people, logo, frame, border, extra fingers, helmet covering the face"
)
SHEET_CELL = (256, 384)

# id -> (faction directory, prompt). Lore: docs/lore/universe.md, src/data/campaign/lore/*LoreShared.ts.
PORTRAITS = {
    "kronos": ("free_confederation", (
        "Admiral Kronos, ruthless hardliner admiral of the Rim Command fleet, grey cropped hair, hard "
        "square jaw, scar through one eyebrow, cold stare, high-collared steel blue naval uniform with "
        "gold braid and heavy shoulder plates, severe, authoritarian, bridge of a warship behind him")),
    "ilsandre": ("ascendant_empire", (
        "Prophet Ilsandre, Ascendant oracle, serene and hollow-eyed, shaved head with a luminous violet "
        "sigil on the brow, pale skin, flowing white and gold ceremonial robes with high collar, "
        "otherworldly calm smile, faint violet glow, vast temple of crystal behind")),
    "blackmaw": ("void_corsairs", (
        "Captain Blackmaw, old veteran pirate captain of the Void Corsairs, weathered tan face, grey "
        "streaked black beard, eye patch, tattered long coat with brass buttons and skull brooch, "
        "gold tooth grin, battle scars, dim smoky ship corridor behind, crimson and black palette")),
    "vosk": ("void_corsairs", (
        "Vosk, ambitious corsair usurper, lean sharp-featured man, slicked back dark hair, thin cruel "
        "smile, cybernetic implant over one eye glowing red, black leather armoured coat with crimson "
        "trim and a stolen captain's sash, scheming expression, dark ship corridor behind")),
}


def candidate_path(portrait_id: str, seed: int) -> Path:
    """Where the raw render of a candidate lives."""
    return WORK_DIR / f"{portrait_id}_{seed}.png"


def seeds_for(portrait_id: str, count: int) -> list:
    """Stable candidate seeds per portrait so reruns reproduce the same sheets."""
    start = 7000 + 100 * list(PORTRAITS).index(portrait_id)
    return [start + offset for offset in range(count)]


def base_graph(prompt: str, seed: int, latent: dict, denoise: float) -> dict:
    """SDXL checkpoint -> prompts -> KSampler -> VAE decode -> preview, over a given latent source."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
        "7": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        **latent,
        "6": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0],
            "seed": seed, "steps": STEPS, "cfg": CFG, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
            "denoise": denoise}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["7", 0]}},
        "9": {"class_type": "PreviewImage", "inputs": {"images": ["8", 0]}},
    }


def text_to_image(prompt: str, seed: int) -> dict:
    """Workflow of a fresh portrait render."""
    latent = {"5": {"class_type": "EmptyLatentImage", "inputs": {
        "width": RENDER_SIZE[0], "height": RENDER_SIZE[1], "batch_size": 1}}}
    return base_graph(prompt, seed, latent, 1.0)


def image_to_image(prompt: str, seed: int, init_name: str) -> dict:
    """Workflow that re-renders an uploaded portrait lightly (the speaking frame)."""
    latent = {
        "10": {"class_type": "LoadImage", "inputs": {"image": init_name}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["7", 0]}},
    }
    return base_graph(prompt, seed, latent, TALK_DENOISE)


def fit_frame(image: Image.Image) -> Image.Image:
    """Resize a render to the 512x768 portrait frame."""
    return image.convert("RGB").resize(FRAME_SIZE, Image.LANCZOS)


def render_candidates(client: ComfyClient, portrait_id: str, seeds: list) -> list:
    """Queue every missing candidate of a portrait at once and save the raw renders."""
    prompt = STYLE + PORTRAITS[portrait_id][1]
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    pending = {seed: client.queue(text_to_image(prompt, seed))
               for seed in seeds if not candidate_path(portrait_id, seed).exists()}
    for seed, prompt_id in pending.items():
        client.fetch_image(prompt_id).save(candidate_path(portrait_id, seed))
    return [candidate_path(portrait_id, seed) for seed in seeds]


def contact_sheet(portrait_id: str, paths: list) -> Path:
    """Numbered contact sheet of a portrait's candidates."""
    sheet = Image.new("RGB", (SHEET_CELL[0] * len(paths), SHEET_CELL[1]), (10, 10, 24))
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        sheet.paste(Image.open(path).convert("RGB").resize(SHEET_CELL, Image.LANCZOS), (index * SHEET_CELL[0], 0))
        draw.text((index * SHEET_CELL[0] + 8, 8), path.stem.rsplit("_", 1)[1], fill=(255, 255, 255))
    out = WORK_DIR / f"{portrait_id}_contact.png"
    sheet.save(out)
    return out


def talk_frame(client: ComfyClient, portrait_id: str, base: Image.Image, seed: int) -> Image.Image:
    """The speaking variant of the chosen base frame (img2img, same seed)."""
    init_name = f"ss_portrait_init_{portrait_id}.png"
    client.upload_guide(init_name, base)
    prompt = TALK_PROMPT + STYLE + PORTRAITS[portrait_id][1]
    return fit_frame(client.fetch_image(client.queue(image_to_image(prompt, seed, init_name))))


def atlas_json(portrait_id: str) -> dict:
    """Phaser atlas of a stacked base/talk sheet (frame names the dialogue view looks up)."""
    def frame(y: int) -> dict:
        w, h = FRAME_SIZE
        return {"frame": {"x": 0, "y": y, "w": w, "h": h}, "rotated": False, "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}}
    return {"frames": {"base": frame(0), "talk": frame(FRAME_SIZE[1])},
            "meta": {"app": "shattered-stars", "version": "1.0", "image": f"{portrait_id}_sheet.png",
                     "format": "RGBA8888", "size": {"w": FRAME_SIZE[0], "h": FRAME_SIZE[1] * 2}, "scale": "1"}}


def finalize(client: ComfyClient, picks: dict) -> None:
    """Write the sheet and atlas of every picked portrait into public/assets/portraits/<faction>/."""
    for portrait_id, seed in picks.items():
        faction = PORTRAITS[portrait_id][0]
        base = fit_frame(Image.open(candidate_path(portrait_id, seed)))
        talk = talk_frame(client, portrait_id, base, seed)
        sheet = Image.new("RGBA", (FRAME_SIZE[0], FRAME_SIZE[1] * 2))
        sheet.paste(base, (0, 0))
        sheet.paste(talk, (0, FRAME_SIZE[1]))
        target = PORTRAITS_DIR / faction
        target.mkdir(parents=True, exist_ok=True)
        sheet.save(target / f"{portrait_id}_sheet.png", optimize=True)
        (target / f"{portrait_id}_sheet.json").write_text(
            json.dumps(atlas_json(portrait_id), indent=2) + "\n", encoding="utf-8")
        print(f"wrote {faction}/{portrait_id}_sheet.png (seed {seed})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sheets = sub.add_parser("sheets")
    sheets.add_argument("--only", default="")
    sheets.add_argument("--seeds", type=int, default=4)
    final = sub.add_parser("finalize")
    final.add_argument("--pick", action="append", default=[], help="id=seed")
    args = parser.parse_args()
    client = ComfyClient(load_config())
    client.check()
    if args.command == "sheets":
        for portrait_id in ([args.only] if args.only else list(PORTRAITS)):
            paths = render_candidates(client, portrait_id, seeds_for(portrait_id, args.seeds))
            print(f"{portrait_id}: {contact_sheet(portrait_id, paths)}")
        return
    finalize(client, {pick.split("=")[0]: int(pick.split("=")[1]) for pick in args.pick})


if __name__ == "__main__":
    main()
