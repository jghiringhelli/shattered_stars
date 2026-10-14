#!/usr/bin/env python3
"""Resumable batch generator of ship art for every ship of ShipDefinitions on the remote ComfyUI node.

Phase 1 (sprites): per ship, SDXL + union ControlNet driven by a procedural top-down silhouette guide;
keyed, lifted, faction tinted and outlined to a 512x512 RGBA; automatic QC; best seed chosen.
Phase 2 (illustrations): per ship, the CHOSEN sprite warped to a three-quarter view on a starfield is the
img2img init (+ depth guide), then a 1.25x hires pass, so each pair matches in hull and palette.
Failures are re-rolled once with new seeds. Existing renders are skipped, so a rerun resumes.
Credentials come from comfyui.config at runtime via the creature script's ComfyClient (never stored here).

Output (--out): _raw/ (renders), <faction>/candidates/, <faction>/chosen/<id>.png,
<faction>/chosen/encyclopedia/<id>_art.png, state.json (picks + QC).

Usage:
    python scripts/generate_ship_art_comfy.py --out DIR [--phase sprites|illustrations|all] [--only ID,ID]
"""
import argparse
import json
import sys
import zlib
from collections import deque
from pathlib import Path

import requests
from PIL import Image

sys.dont_write_bytecode = True
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from generate_creature_art_comfy import ComfyClient, load_config  # noqa: E402
from ship_guides_comfy import ILLUSTRATION_RENDER_PX, illustration_guide, sprite_guide, three_quarter  # noqa: E402
from ship_post_comfy import key_sprite, qc_illustration, qc_sprite, starfield  # noqa: E402
from ship_prompts_comfy import NEGATIVE, build_prompt  # noqa: E402
from ship_roster_comfy import load_roster  # noqa: E402
from ship_workflows_comfy import build_workflow  # noqa: E402

SEEDS, REPAIR_SEEDS = (201, 202), (301, 302)
WINDOW = 2  # jobs in flight: the node is shared, so never flood its queue
SPRITE_RENDER_PX = (1024, 1024)
SPRITE_CONTROL = (0.8, 0.75)  # strength, end percent
ILLUSTRATION_CONTROL = (0.5, 0.5)
ILLUSTRATION_DENOISE = 0.78
ENCYCLOPEDIA_PX = (768, 512)
DEFAULT_LORA = "scifi_style.safetensors:0.6"
PROGRESS_EVERY = 25
NETWORK_ERRORS = (RuntimeError, requests.RequestException)


def parse_lora(spec: str) -> tuple:
    """Split 'NAME.safetensors:0.6' into (name, strength); empty spec means no LoRA."""
    name, _, strength = spec.partition(":")
    return (name, float(strength or 0.6)) if name else ("", 0.0)


class Batch:
    """Paths, state and the node client of one batch run."""

    def __init__(self, client: ComfyClient, out: Path, denoise: float, hires: bool) -> None:
        self.client, self.out, self.denoise, self.hires = client, out, denoise, hires
        self.state_path = out / "state.json"
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {}
        (out / "_raw").mkdir(parents=True, exist_ok=True)

    def raw(self, ship, kind: str, seed: int) -> Path:
        return self.out / "_raw" / f"{ship.ship_id}_{kind}_{seed}.jpg"

    def candidate(self, ship, kind: str, seed: int) -> Path:
        folder = self.out / ship.faction / "candidates"
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{ship.ship_id}_{kind}_{seed}.png"

    def chosen(self, ship, kind: str) -> Path:
        folder = self.out / ship.faction / "chosen" / ("" if kind == "sprite" else "encyclopedia")
        folder.mkdir(parents=True, exist_ok=True)
        return folder / (f"{ship.ship_id}.png" if kind == "sprite" else f"{ship.ship_id}_art.png")

    def save_state(self) -> None:
        self.state_path.write_text(json.dumps(self.state, indent=1))

    def record(self, ship, kind: str, seed: int, ok: bool, reason: str) -> None:
        self.state.setdefault(ship.ship_id, {})[kind] = {"seed": seed, "ok": ok, "reason": reason}


def run_jobs(client: ComfyClient, jobs: list, retry: bool = True) -> tuple:
    """Run jobs with at most WINDOW in flight; failed jobs are retried once.

    :returns: (completed count, jobs that still failed).
    """
    pending, flight, failed, done = deque(jobs), deque(), [], 0
    while pending or flight:
        while pending and len(flight) < WINDOW:
            job = pending.popleft()
            try:
                flight.append((job, client.queue(build_workflow(job, NEGATIVE))))
            except NETWORK_ERRORS:
                failed.append(job)
        if not flight:
            break
        job, prompt_id = flight.popleft()
        try:
            client.fetch_image(prompt_id).convert("RGB").save(job["path"], quality=95)
            done += 1
            if done % PROGRESS_EVERY == 0:
                print(f"  {done}/{len(jobs)} renders", flush=True)
        except NETWORK_ERRORS:
            failed.append(job)
    if failed and retry:
        more, failed = run_jobs(client, failed, retry=False)
        done += more
    return done, failed


def best(results: list) -> tuple:
    """Pick the best (seed, ok, score, reason): passing first, then the highest score."""
    return max(results, key=lambda r: (r[1], r[2]))


def sprite_phase(batch: Batch, ships: list, lora: tuple, seeds: tuple) -> None:
    """Render, key, QC and choose the sprite of every ship (one repair round for failures)."""
    guides = {s.ship_id: sprite_guide(s.ship_id, s.faction, s.role) for s in ships}
    for stage, stage_seeds in enumerate((seeds, REPAIR_SEEDS)):
        targets = ships if stage == 0 else [s for s in ships if not batch.state.get(s.ship_id, {}).get("sprite", {}).get("ok")]
        jobs = []
        for ship in targets:
            for seed in stage_seeds:
                if not batch.raw(ship, "sprite", seed).exists():
                    name = f"ss_ship_{ship.ship_id}_sprite.png"
                    batch.client.upload_guide(name, guides[ship.ship_id])
                    jobs.append({"prompt": build_prompt("sprite", ship, lora[0]), "seed": seed, "size": SPRITE_RENDER_PX,
                                 "lora": lora, "guide": name, "control": SPRITE_CONTROL, "init": "",
                                 "denoise": 1.0, "hires": False, "path": batch.raw(ship, "sprite", seed)})
        print(f"sprites stage {stage}: {len(jobs)} renders", flush=True)
        done, failed = run_jobs(batch.client, jobs)
        print(f"  done {done}, failed {len(failed)}", flush=True)
        for ship in targets:
            pick_sprite(batch, ship, guides[ship.ship_id], seeds + (REPAIR_SEEDS if stage else ()))
        batch.save_state()


def pick_sprite(batch: Batch, ship, guide: Image.Image, seeds: tuple) -> None:
    """Key every rendered seed of a ship, run QC and copy the best to chosen/."""
    results = []
    for seed in seeds:
        if not batch.raw(ship, "sprite", seed).exists():
            continue
        sprite = key_sprite(Image.open(batch.raw(ship, "sprite", seed)), guide, ship.faction)
        sprite.save(batch.candidate(ship, "sprite", seed))
        ok, score, reason = qc_sprite(sprite)
        results.append((seed, ok, score, reason))
    if results:
        seed, ok, _, reason = best(results)
        Image.open(batch.candidate(ship, "sprite", seed)).save(batch.chosen(ship, "sprite"))
        batch.record(ship, "sprite", seed, ok, reason)


def illustration_inputs(batch: Batch, ship) -> tuple:
    """Upload the init image and depth guide built from the ship's chosen sprite; return their names."""
    warped = three_quarter(Image.open(batch.chosen(ship, "sprite")))
    init = starfield(ILLUSTRATION_RENDER_PX, zlib.crc32(ship.ship_id.encode()) % 1000).convert("RGBA")
    init.alpha_composite(warped)
    init_name, guide_name = f"ss_ship_{ship.ship_id}_init.png", f"ss_ship_{ship.ship_id}_illus.png"
    batch.client.upload_guide(init_name, init.convert("RGB"))
    batch.client.upload_guide(guide_name, illustration_guide(warped))
    return init_name, guide_name


def illustration_phase(batch: Batch, ships: list, lora: tuple, seeds: tuple) -> None:
    """Render matching illustrations from the chosen sprites, QC, choose (one repair round)."""
    ships = [s for s in ships if batch.chosen(s, "sprite").exists()]
    for stage, stage_seeds in enumerate((seeds, REPAIR_SEEDS)):
        targets = ships if stage == 0 else [s for s in ships if not batch.state[s.ship_id].get("illus", {}).get("ok")]
        jobs = []
        for ship in targets:
            missing = [x for x in stage_seeds if not batch.raw(ship, "illus", x).exists()]
            if not missing:
                continue
            init_name, guide_name = illustration_inputs(batch, ship)
            jobs += [{"prompt": build_prompt("illustration", ship, lora[0]), "seed": seed,
                      "size": ILLUSTRATION_RENDER_PX, "lora": lora, "guide": guide_name,
                      "control": ILLUSTRATION_CONTROL, "init": init_name, "denoise": batch.denoise,
                      "hires": batch.hires, "path": batch.raw(ship, "illus", seed)} for seed in missing]
        print(f"illustrations stage {stage}: {len(jobs)} renders", flush=True)
        done, failed = run_jobs(batch.client, jobs)
        print(f"  done {done}, failed {len(failed)}", flush=True)
        for ship in targets:
            pick_illustration(batch, ship, seeds + (REPAIR_SEEDS if stage else ()))
        batch.save_state()


def pick_illustration(batch: Batch, ship, seeds: tuple) -> None:
    """Downscale every rendered seed to the encyclopedia size, run QC, copy the best to chosen/."""
    results = []
    for seed in seeds:
        if not batch.raw(ship, "illus", seed).exists():
            continue
        image = Image.open(batch.raw(ship, "illus", seed)).convert("RGB").resize(ENCYCLOPEDIA_PX, Image.LANCZOS)
        image.save(batch.candidate(ship, "illus", seed))
        ok, score, reason = qc_illustration(image)
        results.append((seed, ok, score, reason))
    if results:
        seed, ok, _, reason = best(results)
        Image.open(batch.candidate(ship, "illus", seed)).save(batch.chosen(ship, "illus"))
        batch.record(ship, "illus", seed, ok, reason)


def requalify(batch: Batch, ships: list) -> None:
    """Re-run the automatic QC on the chosen files and update state.json (no node, no re-picking)."""
    checks = (("sprite", qc_sprite, batch.chosen), ("illus", qc_illustration, batch.chosen))
    for ship in ships:
        for kind, check, path_of in checks:
            path = path_of(ship, kind)
            if path.exists() and kind in batch.state.get(ship.ship_id, {}):
                ok, _, reason = check(Image.open(path))
                batch.state[ship.ship_id][kind].update({"ok": ok, "reason": reason})
    batch.save_state()


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--phase", choices=("sprites", "illustrations", "all"), default="all")
    parser.add_argument("--only", default="")
    parser.add_argument("--seeds", type=int, default=len(SEEDS))
    parser.add_argument("--lora", default=DEFAULT_LORA)
    parser.add_argument("--requalify", action="store_true", help="only re-run QC on the chosen files")
    parser.add_argument("--denoise", type=float, default=ILLUSTRATION_DENOISE)
    parser.add_argument("--hires", action="store_true", help="latent hires pass (adds rainbow artefacts: off)")
    args = parser.parse_args()
    only = set(filter(None, args.only.split(",")))
    ships = [s for s in load_roster() if not only or s.ship_id in only]
    client = ComfyClient(load_config())
    client.check()
    batch, lora = Batch(client, Path(args.out), args.denoise, args.hires), parse_lora(args.lora)
    if args.requalify:
        requalify(batch, ships)
        return 0
    seeds = SEEDS[:args.seeds] if args.seeds <= len(SEEDS) else SEEDS
    if args.phase in ("sprites", "all"):
        sprite_phase(batch, ships, lora, seeds)
    if args.phase in ("illustrations", "all"):
        illustration_phase(batch, ships, lora, seeds)
    return 0


if __name__ == "__main__":
    sys.exit(main())




