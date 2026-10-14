#!/usr/bin/env python3
"""generate_creature_art_comfy.py — Regenerate the creature sprites on the remote ComfyUI node.

Two phases, so a human (or agent) can compare candidates before anything is written to the repo:

  python scripts/generate_creature_art_comfy.py sheets [--only ID] [--seeds 6] [--lora NAME:STRENGTH]
      renders N candidates per sprite at 1024 px (SDXL) and writes one contact sheet per sprite
      into %TEMP%/shattered_stars_comfy (raw candidates are kept next to the sheets).
  python scripts/generate_creature_art_comfy.py finalize --pick cinder_wyrm_body=3 --pick ...
      keys the chosen raw render with the same pipeline as generate_creature_art.py (near-black
      backdrop -> alpha, optional left/right mirroring) and writes public/assets/creatures/<id>.png.

Credentials: read at runtime from comfyui.config at the repo root (gitignored; keys COMFYUI_URL,
COMFYUI_USER, COMFYUI_PASS). They are never stored in, or printed by, this script.
"""
import argparse
import io
import sys
import tempfile
import time
import uuid
from pathlib import Path

import requests
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.dont_write_bytecode = True
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import generate_creature_art as base  # noqa: E402  (keying, fitting, mirroring, symmetric flags)
from creature_guides_comfy import GUIDES  # noqa: E402
from creature_prompts_comfy import CREATURE_PROMPTS, NEGATIVE_PROMPT, STYLE_PREFIX  # noqa: E402

CONFIG_PATH = SCRIPT_DIR.parent / "comfyui.config"
WORK_DIR = Path(tempfile.gettempdir()) / "shattered_stars_comfy"

CHECKPOINT = "sd_xl_base_1.0.safetensors"
CONTROLNET = "controlnet-union-promax-sdxl.safetensors"
CONTROL_TYPE = "depth"
CONTROL_STRENGTH = 0.7
CONTROL_END_PERCENT = 0.6
VAE = "sdxl_vae_fp16fix.safetensors"
RENDER_SIZE = 1024
STEPS = 32
CFG = 6.5
SAMPLER = "dpmpp_2m"
SCHEDULER = "karras"
DEFAULT_LORA = ""  # e.g. "StainedGlass_SDXL.safetensors:0.4"; empty = plain SDXL
POLL_SECONDS = 2.0
JOB_TIMEOUT_SECONDS = 600.0
SHEET_CELL_PX = 400
SHEET_COLUMNS = 3
SHEET_BACKDROP = (10, 10, 24)
FOOTPRINT_THRESHOLD = 8  # guide level that counts as "inside the creature"
FOOTPRINT_DILATE_PX = 81  # odd (MaxFilter): creatures may spill ~40 px past the guide
FOOTPRINT_FEATHER_PX = 14
SPILL_FLOOR = 60.0  # luminance below which spill outside the guide is erased
SPILL_RAMP = 40.0  # luminance span over which spill fades back in

# Output size per sprite kind: bodies are shown up to ~510 px, segments/pods well under 150 px.
OUTPUT_SIZE_PX = {"body": 512, "segment": 256, "pod": 256}


def load_config() -> dict:
    """Read the ComfyUI connection settings from comfyui.config.

    :returns: dict with COMFYUI_URL, COMFYUI_USER and COMFYUI_PASS.
    :raises SystemExit: when the file or a key is missing.
    """
    if not CONFIG_PATH.exists():
        raise SystemExit("comfyui.config is missing (ask the repo owner for it; it is gitignored)")
    values = {}
    for line in CONFIG_PATH.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and not key.strip().startswith("#"):
            values[key.strip()] = value.strip().strip('"').strip("'")
    missing = [k for k in ("COMFYUI_URL", "COMFYUI_USER", "COMFYUI_PASS") if not values.get(k)]
    if missing:
        raise SystemExit(f"comfyui.config lacks: {', '.join(missing)}")
    return values


class ComfyClient:
    """Minimal ComfyUI HTTP client (queue a workflow, wait for it, download the image)."""

    def __init__(self, config: dict) -> None:
        self._url = config["COMFYUI_URL"].rstrip("/")
        self._session = requests.Session()
        self._session.auth = (config["COMFYUI_USER"], config["COMFYUI_PASS"])
        self._client_id = uuid.uuid4().hex

    def check(self) -> None:
        """Verify the node answers and the credentials are accepted.

        :raises RuntimeError: when /system_stats does not return 200.
        """
        response = self._session.get(f"{self._url}/system_stats", timeout=20)
        if response.status_code != 200:
            raise RuntimeError(f"ComfyUI answered HTTP {response.status_code} on /system_stats")

    def upload_guide(self, name: str, image: Image.Image) -> None:
        """Upload a guide image to the node's input folder (overwrites).

        :param name: file name on the node.
        :param image: guide image.
        """
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        response = self._session.post(
            f"{self._url}/upload/image", files={"image": (name, buffer.getvalue(), "image/png")},
            data={"overwrite": "true", "type": "input"}, timeout=60)
        response.raise_for_status()

    def queue(self, workflow: dict) -> str:
        """Queue a workflow in API format.

        :param workflow: node graph.
        :returns: the prompt id.
        """
        response = self._session.post(
            f"{self._url}/prompt", json={"prompt": workflow, "client_id": self._client_id}, timeout=30)
        if response.status_code != 200:
            raise RuntimeError(f"ComfyUI rejected the workflow: {response.text[:400]}")
        return response.json()["prompt_id"]

    def fetch_image(self, prompt_id: str) -> Image.Image:
        """Wait for a queued workflow and download its first output image.

        :param prompt_id: id returned by queue().
        :returns: the decoded RGB image.
        :raises RuntimeError: on node errors or timeout.
        """
        deadline = time.time() + JOB_TIMEOUT_SECONDS
        while time.time() < deadline:
            history = self._session.get(f"{self._url}/history/{prompt_id}", timeout=30).json()
            entry = history.get(prompt_id)
            if entry and entry.get("status", {}).get("status_str") == "error":
                raise RuntimeError(f"workflow {prompt_id} failed: {str(entry['status'])[:400]}")
            if entry and entry.get("outputs"):
                image = next(iter(entry["outputs"].values()))["images"][0]
                data = self._session.get(f"{self._url}/view", params={
                    "filename": image["filename"], "subfolder": image["subfolder"], "type": image["type"],
                }, timeout=60)
                return Image.open(io.BytesIO(data.content)).convert("RGB")
            time.sleep(POLL_SECONDS)
        raise RuntimeError(f"workflow {prompt_id} timed out")


def parse_lora(spec: str) -> tuple:
    """Split 'NAME.safetensors:0.4' into (name, strength); empty spec means no LoRA."""
    if not spec:
        return ("", 0.0)
    name, _, strength = spec.partition(":")
    return (name, float(strength or 0.5))


def guide_name(sprite_id: str) -> str:
    """File name of the uploaded silhouette guide of a sprite."""
    return f"ss_creature_guide_{sprite_id}.png"


def build_workflow(prompt: str, seed: int, lora: tuple, guide: str) -> dict:
    """Build the workflow: checkpoint [+ LoRA] -> union ControlNet (silhouette guide) -> KSampler -> VAE.

    :param prompt: positive prompt.
    :param seed: sampler seed.
    :param guide: file name of the guide image on the node.
    :param lora: (name, strength); an empty name skips the LoRA node.
    :returns: ComfyUI API-format graph.
    """
    model_source = ["1", 0]
    clip_source = ["1", 1]
    graph = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}}}
    if lora[0]:
        graph["2"] = {"class_type": "LoraLoader", "inputs": {
            "model": ["1", 0], "clip": ["1", 1], "lora_name": lora[0],
            "strength_model": lora[1], "strength_clip": lora[1]}}
        model_source, clip_source = ["2", 0], ["2", 1]
    graph.update({
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": clip_source}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE_PROMPT, "clip": clip_source}},
        "10": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": CONTROLNET}},
        "11": {"class_type": "SetUnionControlNetType",
               "inputs": {"control_net": ["10", 0], "type": CONTROL_TYPE}},
        "12": {"class_type": "LoadImage", "inputs": {"image": guide}},
        "13": {"class_type": "ControlNetApplyAdvanced", "inputs": {
            "positive": ["3", 0], "negative": ["4", 0], "control_net": ["11", 0], "image": ["12", 0],
            "strength": CONTROL_STRENGTH, "start_percent": 0.0, "end_percent": CONTROL_END_PERCENT,
            "vae": ["7", 0]}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": RENDER_SIZE, "height": RENDER_SIZE, "batch_size": 1}},
        "6": {"class_type": "KSampler", "inputs": {
            "model": model_source, "positive": ["13", 0], "negative": ["13", 1], "latent_image": ["5", 0],
            "seed": seed, "steps": STEPS, "cfg": CFG, "sampler_name": SAMPLER, "scheduler": SCHEDULER,
            "denoise": 1.0}},
        "7": {"class_type": "VAELoader", "inputs": {"vae_name": VAE}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["7", 0]}},
        "9": {"class_type": "PreviewImage", "inputs": {"images": ["8", 0]}},
    })
    return graph


def seeds_for(sprite_id: str, count: int) -> list:
    """Stable candidate seeds per sprite so reruns reproduce the same sheets."""
    start = 1000 * (list(CREATURE_PROMPTS).index(sprite_id) + 1)
    return [start + offset for offset in range(count)]


def raw_path(sprite_id: str, seed: int) -> Path:
    """Where the raw 1024 px render of a candidate lives."""
    return WORK_DIR / f"{sprite_id}_{seed}.png"


def render_candidates(client: ComfyClient, sprite_id: str, seeds: list, lora: tuple) -> list:
    """Queue every missing candidate of a sprite at once and save the raw renders.

    :returns: the raw image paths in seed order.
    """
    prompt = STYLE_PREFIX + CREATURE_PROMPTS[sprite_id]
    client.upload_guide(guide_name(sprite_id), GUIDES[sprite_id]())
    pending = {seed: client.queue(build_workflow(prompt, seed, lora, guide_name(sprite_id)))
               for seed in seeds if not raw_path(sprite_id, seed).exists()}
    for seed, prompt_id in pending.items():
        client.fetch_image(prompt_id).save(raw_path(sprite_id, seed))
    return [raw_path(sprite_id, seed) for seed in seeds]


def key_candidate(sprite_id: str, seed: int) -> Image.Image:
    """Load a raw render, black out everything outside the guide footprint (stray glow halos), key to alpha."""
    raw = Image.open(raw_path(sprite_id, seed)).convert("RGB")
    guide = GUIDES[sprite_id]().convert("L").point(lambda v: 255 if v > FOOTPRINT_THRESHOLD else 0)
    ImageDraw.floodfill(guide, (0, 0), 128)  # outside = 128, so holes (a maw) stay inside the footprint
    guide = guide.point(lambda v: 0 if v == 128 else 255)
    inside = np.array(guide.filter(ImageFilter.GaussianBlur(FOOTPRINT_FEATHER_PX)), dtype=float) / 255.0
    reach = np.array(guide.filter(ImageFilter.MaxFilter(FOOTPRINT_DILATE_PX)).filter(
        ImageFilter.GaussianBlur(FOOTPRINT_FEATHER_PX)), dtype=float) / 255.0
    pixels = np.array(raw, dtype=float)
    luminance = pixels.mean(axis=2)
    # Past the guide only bright detail survives: dim glow halos fall below the keyer's threshold.
    spill_gate = np.clip((luminance - SPILL_FLOOR) / SPILL_RAMP, 0.0, 1.0)
    keep = inside + (reach - inside).clip(0.0, 1.0) * spill_gate
    shaped = Image.fromarray((pixels * keep[:, :, None]).astype(np.uint8))
    return base.key_to_rgba(shaped)


def write_sheet(sprite_id: str, seeds: list) -> Path:
    """Compose the candidates of a sprite into a labelled contact sheet (keyed over a dark blue field)."""
    rows = -(-len(seeds) // SHEET_COLUMNS)
    sheet = Image.new("RGB", (SHEET_COLUMNS * SHEET_CELL_PX, rows * SHEET_CELL_PX), SHEET_BACKDROP)
    draw = ImageDraw.Draw(sheet)
    for index, seed in enumerate(seeds):
        shown = key_candidate(sprite_id, seed).resize((SHEET_CELL_PX, SHEET_CELL_PX), Image.LANCZOS)
        left, top = (index % SHEET_COLUMNS) * SHEET_CELL_PX, (index // SHEET_COLUMNS) * SHEET_CELL_PX
        sheet.paste(shown, (left, top), shown)
        draw.text((left + 8, top + 6), str(seed), fill=(255, 255, 0))
    path = WORK_DIR / f"sheet_{sprite_id}.png"
    sheet.save(path)
    return path


def sprite_kind(sprite_id: str) -> str:
    """Return 'body', 'segment' or 'pod' from a sprite id."""
    return sprite_id.rsplit("_", 1)[-1]


def finalize(sprite_id: str, seed: int) -> Path:
    """Key, fit and (when flagged symmetric) mirror a chosen raw render into public/assets/creatures.

    :returns: the written PNG path.
    """
    full_id = f"creature_{sprite_id}"
    base.SIZE = OUTPUT_SIZE_PX[sprite_kind(sprite_id)]
    sprite = base.fit_to_frame(key_candidate(sprite_id, seed))
    if base.CREATURES[full_id].symmetric:
        sprite = base.mirror_left_half(sprite)
    base.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = base.OUTPUT_DIR / f"{full_id}.png"
    sprite.save(target, optimize=True)
    return target


def run_sheets(args: argparse.Namespace) -> None:
    """Phase 1: render candidates and contact sheets."""
    client = ComfyClient(load_config())
    client.check()
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    lora = parse_lora(args.lora)
    ids = [args.only] if args.only else list(CREATURE_PROMPTS)
    for sprite_id in ids:
        seeds = seeds_for(sprite_id, args.seeds)
        render_candidates(client, sprite_id, seeds, lora)
        print(f"{sprite_id}: {write_sheet(sprite_id, seeds)}", flush=True)


def run_finalize(args: argparse.Namespace) -> None:
    """Phase 2: write the picked candidates into the repo."""
    for pick in args.pick:
        sprite_id, _, seed = pick.partition("=")
        target = finalize(sprite_id, int(seed))
        print(f"{target.name}: {target.stat().st_size // 1024} KB (seed {seed})")


def main() -> int:
    parser = argparse.ArgumentParser(description="Creature sprites via the remote ComfyUI node.")
    sub = parser.add_subparsers(dest="phase", required=True)
    sheets = sub.add_parser("sheets", help="render candidates + contact sheets into %TEMP%")
    sheets.add_argument("--only", choices=list(CREATURE_PROMPTS), help="one sprite id (without creature_)")
    sheets.add_argument("--seeds", type=int, default=6, help="candidates per sprite")
    sheets.add_argument("--lora", default=DEFAULT_LORA, help="NAME.safetensors:STRENGTH (optional)")
    pick = sub.add_parser("finalize", help="write chosen candidates to public/assets/creatures")
    pick.add_argument("--pick", action="append", required=True, metavar="ID=SEED")
    args = parser.parse_args()
    run_sheets(args) if args.phase == "sheets" else run_finalize(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
