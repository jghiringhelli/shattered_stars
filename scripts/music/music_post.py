"""Post-processing for generated music: QA analysis, seamless looping, retuning,
loudness normalisation and web encoding.

All heavy lifting is numpy (analysis/loop) + ffmpeg (retune, loudnorm, encode).
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 44100
ANALYSIS_WINDOW_SECONDS = 0.1
SILENCE_FLOOR_DBFS = -50.0
"""Windows quieter than this count as silence."""
MIN_OVERALL_RMS_DBFS = -45.0
"""A track whose overall RMS is below this is treated as a failed (silent) render."""
CLIP_LEVEL = 0.999
MAX_CLIP_FRACTION = 0.001
"""More than 0.1 % of samples at full scale means audible baked-in clipping."""
MAX_SILENT_RUN_SECONDS = 8.0
MAX_SILENT_RUN_SPARSE_SECONDS = 14.0
"""Ascendant music uses deliberate silence, so it gets a longer allowance."""
LEAD_IN_FLOOR_DBFS = -40.0
FADE_OUT_DROP_DB = 12.0
"""Tail windows this far below the median level are treated as a fade-out and cut."""
MIN_DURATION_RATIO = 0.9
TARGET_LUFS = -16.0
TARGET_TRUE_PEAK_DB = -1.5
TARGET_LRA = 11.0
OGG_QUALITY = "1"
MP3_BITRATE = "96k"
REFERENCE_TUNING_HZ = 440.0


@dataclass(frozen=True)
class AudioReport:
    """QA metrics for one rendered file."""
    duration_seconds: float
    rms_dbfs: float
    peak: float
    clip_fraction: float
    silent_fraction: float
    longest_silent_run_seconds: float
    problems: tuple[str, ...]


def _window_levels_db(mono: np.ndarray) -> np.ndarray:
    """Per-window RMS level in dBFS."""
    window = int(SAMPLE_RATE * ANALYSIS_WINDOW_SECONDS)
    count = len(mono) // window
    if count == 0:
        return np.array([-120.0])
    frames = mono[: count * window].reshape(count, window)
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    return 20 * np.log10(np.maximum(rms, 1e-6))


def _longest_run(mask: np.ndarray) -> int:
    best = run = 0
    for flag in mask:
        run = run + 1 if flag else 0
        best = max(best, run)
    return best


def analyse(path: Path, expected_seconds: float, sparse: bool) -> AudioReport:
    """Measure a WAV and list any reasons it should be regenerated.

    @param path: WAV file to inspect.
    @param expected_seconds: Minimum useful length requested from the generator.
    @param sparse: True for factions that use deliberate silence (Ascendant).
    @returns: AudioReport with metrics and a (possibly empty) problem list.
    """
    data, rate = sf.read(str(path), always_2d=True)
    mono = data.mean(axis=1)
    levels = _window_levels_db(mono)
    silent = levels < SILENCE_FLOOR_DBFS
    duration = len(mono) / rate
    rms_db = float(20 * np.log10(max(float(np.sqrt(np.mean(mono ** 2))), 1e-6)))
    clip_fraction = float(np.mean(np.abs(data) >= CLIP_LEVEL))
    longest_silence = _longest_run(silent) * ANALYSIS_WINDOW_SECONDS
    max_silence = MAX_SILENT_RUN_SPARSE_SECONDS if sparse else MAX_SILENT_RUN_SECONDS
    problems: list[str] = []
    if duration < expected_seconds * MIN_DURATION_RATIO:
        problems.append(f"too short ({duration:.1f}s < {expected_seconds}s)")
    if rms_db < MIN_OVERALL_RMS_DBFS:
        problems.append(f"near-silent render (RMS {rms_db:.1f} dBFS)")
    if clip_fraction > MAX_CLIP_FRACTION:
        problems.append(f"clipping ({clip_fraction:.4%} of samples at full scale)")
    if longest_silence > max_silence:
        problems.append(f"silent gap of {longest_silence:.1f}s")
    return AudioReport(
        duration_seconds=round(duration, 2), rms_dbfs=round(rms_db, 2),
        peak=round(float(np.max(np.abs(data))), 4), clip_fraction=clip_fraction,
        silent_fraction=round(float(np.mean(silent)), 4),
        longest_silent_run_seconds=round(longest_silence, 2), problems=tuple(problems),
    )


SEAM_SEARCH_SECONDS = 6.0
"""The loop end is searched within ± this of the requested length."""
FEATURE_DECIMATION = 2
FEATURE_FRAME = 1024
FEATURE_HOP = 512
FEATURE_BANDS = 48
FEATURE_BATCH_FRAMES = 2048
"""Frames per FFT batch, bounding memory on long (5 min+) sources."""
START_STEP_FRAMES = 2
"""Loop-start candidates are tried every 2 frames (~46 ms)."""


def _band_features(mono: np.ndarray) -> np.ndarray:
    """Unit-norm log band-energy spectrogram (frames × bands) for comparing passages.

    Frame k covers samples [k * hop, k * hop + window) of the original signal,
    with hop = FEATURE_HOP * FEATURE_DECIMATION.
    """
    signal = mono[: len(mono) // FEATURE_DECIMATION * FEATURE_DECIMATION]
    signal = signal.reshape(-1, FEATURE_DECIMATION).mean(axis=1)
    count = max(0, (len(signal) - FEATURE_FRAME) // FEATURE_HOP + 1)
    edges = np.unique(np.geomspace(2, FEATURE_FRAME // 2, FEATURE_BANDS + 1).astype(int))
    window = np.hanning(FEATURE_FRAME)
    chunks = []
    for first in range(0, count, FEATURE_BATCH_FRAMES):
        frames = np.arange(first, min(count, first + FEATURE_BATCH_FRAMES))
        index = np.arange(FEATURE_FRAME)[None, :] + FEATURE_HOP * frames[:, None]
        spectrum = np.abs(np.fft.rfft(signal[index] * window, axis=1))
        chunks.append(np.log1p(np.add.reduceat(spectrum ** 2, edges[:-1], axis=1)))
    features = np.concatenate(chunks) if chunks else np.zeros((0, len(edges) - 1))
    return features / (np.linalg.norm(features, axis=1, keepdims=True) + 1e-9)


def _seam_scores(features: np.ndarray, head_frame: int, fade_frames: int,
                 lowest: int, highest: int) -> np.ndarray:
    """Similarity of the head window to every tail window ending in [lowest, highest)."""
    head = features[head_frame:head_frame + fade_frames]
    region = features[lowest - fade_frames:highest]
    offsets = len(region) - fade_frames + 1
    if len(head) < fade_frames or offsets <= 0:
        return np.zeros(0)
    similarity = head @ region.T
    diagonal = np.arange(fade_frames)[:, None] + np.arange(offsets)[None, :]
    return similarity[np.arange(fade_frames)[:, None], diagonal].mean(axis=0)


def _best_loop_points(mono: np.ndarray, rate: int, bounds: tuple[int, int],
                      loop_samples: int, fade: int,
                      start_search_seconds: float) -> tuple[int, int, float]:
    """Pick loop start/end so the tail that crossfades into the head sounds alike.

    The seam blends ``x[end-fade:end]`` into ``x[start:start+fade]``; the pair
    with the most similar spectra, frame by frame (so beat phase counts too),
    wins. The start is searched within ``start_search_seconds`` of the first
    playable sample, the end within ± SEAM_SEARCH_SECONDS of the target length.

    @returns: (start sample, end sample, mean cosine similarity of the seam).
    """
    first, usable_end = bounds
    hop = FEATURE_HOP * FEATURE_DECIMATION
    features = _band_features(mono)
    fade_frames = max(1, fade // hop)
    search = int(rate * SEAM_SEARCH_SECONDS) // hop
    best = (-1.0, first, min(usable_end, first + loop_samples + fade))
    last_start = first + int(rate * start_search_seconds)
    for head_frame in range(first // hop, last_start // hop + 1, START_STEP_FRAMES):
        target = head_frame + (loop_samples + fade) // hop
        lowest = max(head_frame + 2 * fade_frames, target - search)
        highest = min(usable_end // hop, target + search)
        scores = _seam_scores(features, head_frame, fade_frames, lowest, highest)
        if len(scores) and float(scores.max()) > best[0]:
            pick = int(np.argmax(scores))
            best = (float(scores[pick]), head_frame * hop, (lowest + pick) * hop)
    return best[1], best[2], max(best[0], 0.0)


def _playable_bounds(data: np.ndarray, rate: int,
                     segment: tuple[float, float] | None) -> tuple[int, int]:
    """Start after lead-in silence, end before any fade-out, inside ``segment``."""
    levels = _window_levels_db(data.mean(axis=1))
    window = int(rate * ANALYSIS_WINDOW_SECONDS)
    loud = np.nonzero(levels >= LEAD_IN_FLOOR_DBFS)[0]
    start = int(loud[0]) * window if len(loud) else 0
    sustained = np.nonzero(levels >= np.median(levels) - FADE_OUT_DROP_DB)[0]
    end = (int(sustained[-1]) + 1) * window if len(sustained) else len(data)
    if segment:
        start = max(start, int(segment[0] * rate))
        end = min(end, int(segment[1] * rate))
    return start, end


def make_seamless_loop(source: Path, target: Path, loop_seconds: float,
                       crossfade_seconds: float,
                       segment: tuple[float, float] | None = None,
                       start_search_seconds: float = 0.0) -> tuple[float, float]:
    """Trim lead-in silence and fade-out, then fold the tail into the head.

    Loop start (within ``start_search_seconds`` of the first playable sample)
    and end (near ``loop_seconds``) are chosen where the tail best matches the
    head; the final ``crossfade_seconds`` are an equal-power blend of that tail
    and the head, so wrapping from the last sample to the first is continuous.

    @param source: Input WAV.
    @param target: Output WAV.
    @param loop_seconds: Desired loop length (± SEAM_SEARCH_SECONDS).
    @param crossfade_seconds: Overlap used to hide the loop seam.
    @param segment: Optional (start, end) seconds of the source to stay within.
    @param start_search_seconds: How far past the first playable sample the loop may start.
    @returns: (loop length in seconds, seam similarity 0..1).
    """
    data, rate = sf.read(str(source), always_2d=True)
    bounds = _playable_bounds(data, rate, segment)
    fade = int(rate * crossfade_seconds)
    start, end, similarity = _best_loop_points(data.mean(axis=1), rate, bounds,
                                               int(rate * loop_seconds), fade,
                                               start_search_seconds)
    body = data[start:end]
    phase = np.linspace(0.0, np.pi / 2, fade)[:, None]
    seam = body[-fade:] * np.cos(phase) + body[:fade] * np.sin(phase)
    loop = np.concatenate([body[fade:-fade], seam])
    sf.write(str(target), loop, rate, subtype="PCM_24")
    return len(loop) / rate, round(similarity, 3)


def make_one_shot(source: Path, target: Path, seconds: float, fade_out_seconds: float,
                  segment: tuple[float, float] | None = None) -> float:
    """Cut a non-looping stinger: lead-in trimmed, ``seconds`` long, faded out.

    @param source: Input WAV.
    @param target: Output WAV.
    @param seconds: Stinger length.
    @param fade_out_seconds: Cosine fade at the end.
    @param segment: Optional (start, end) seconds of the source to stay within.
    @returns: Actual length in seconds.
    """
    data, rate = sf.read(str(source), always_2d=True)
    start, usable_end = _playable_bounds(data, rate, segment)
    body = data[start:min(usable_end, start + int(rate * seconds))].copy()
    fade = min(len(body), int(rate * fade_out_seconds))
    body[-fade:] *= np.cos(np.linspace(0.0, np.pi / 2, fade))[:, None]
    sf.write(str(target), body, rate, subtype="PCM_24")
    return len(body) / rate


def _ffmpeg(args: list[str]) -> str:
    result = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-y", *args],
                            capture_output=True, text=True, encoding="utf-8",
                            errors="replace")
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {' '.join(args)}\n{result.stderr[-2000:]}")
    return result.stderr


def decode_to_wav(source: Path, target: Path) -> None:
    """Decode any source (wav/mp3) to 44.1 kHz stereo 24-bit WAV.

    @param source: Input audio file (read only).
    @param target: Output WAV.
    """
    _ffmpeg(["-i", str(source), "-ac", "2", "-ar", str(SAMPLE_RATE),
             "-c:a", "pcm_s24le", str(target)])


def retune(source: Path, target: Path, tuning_hz: float) -> None:
    """Shift pitch from A=440 to ``tuning_hz`` while preserving duration.

    @param source: Input WAV at A=440.
    @param target: Output WAV at the requested reference.
    @param tuning_hz: Target A4 reference, e.g. 432.
    """
    ratio = tuning_hz / REFERENCE_TUNING_HZ
    filters = (f"asetrate={SAMPLE_RATE}*{ratio:.6f},aresample={SAMPLE_RATE},"
               f"atempo={1 / ratio:.6f}")
    _ffmpeg(["-i", str(source), "-af", filters, "-c:a", "pcm_s24le", str(target)])


def _loudnorm_filter(extra: str = "") -> str:
    return (f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TRUE_PEAK_DB}:LRA={TARGET_LRA}"
            f"{extra}:print_format=json")


def _last_json(text: str) -> dict[str, str]:
    return json.loads(re.findall(r"\{[^{}]*\}", text, re.S)[-1])


LIMITER_CEILING_DBFS = -2.0
"""Sample-peak ceiling; leaves headroom for codec overshoot so encoded true peak stays ≤ -1 dBTP."""


def normalise_loudness(source: Path, target: Path) -> dict[str, str]:
    """Static-gain EBU R128 normalisation to TARGET_LUFS.

    A single gain value keeps the loop seam level-continuous (loudnorm's
    dynamic mode rides the gain over time, so the end and start of a loop
    would sit at different levels). When the gain would push true peak past
    TARGET_TRUE_PEAK_DB, a transparent look-ahead limiter catches the peaks.

    @param source: Input WAV.
    @param target: Normalised WAV.
    @returns: {'normalization_type', 'gain_db', 'input_i', 'input_tp'}.
    """
    measured = _last_json(_ffmpeg(["-i", str(source), "-af", _loudnorm_filter(), "-f", "null", "-"]))
    gain_db = TARGET_LUFS - float(measured["input_i"])
    needs_limiter = float(measured["input_tp"]) + gain_db > TARGET_TRUE_PEAK_DB
    filters = f"volume={gain_db:.2f}dB"
    if needs_limiter:
        ceiling = 10 ** (LIMITER_CEILING_DBFS / 20)
        filters += f",alimiter=limit={ceiling:.4f}:attack=5:release=80:level=false"
    _ffmpeg(["-i", str(source), "-af", filters, "-ar", str(SAMPLE_RATE),
             "-c:a", "pcm_s24le", str(target)])
    return {"normalization_type": "gain+limiter" if needs_limiter else "gain",
            "gain_db": f"{gain_db:.2f}", "input_i": measured["input_i"],
            "input_tp": measured["input_tp"]}


def encode_web(source: Path, out_dir: Path, track_id: str) -> dict[str, int]:
    """Encode the normalised loop as .ogg (Vorbis) and .mp3.

    @param source: Normalised WAV.
    @param out_dir: Game music directory.
    @param track_id: File stem.
    @returns: Byte size per extension.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    ogg, mp3 = out_dir / f"{track_id}.ogg", out_dir / f"{track_id}.mp3"
    _ffmpeg(["-i", str(source), "-map_metadata", "-1", "-c:a", "libvorbis",
             "-q:a", OGG_QUALITY, str(ogg)])
    _ffmpeg(["-i", str(source), "-map_metadata", "-1", "-c:a", "libmp3lame",
             "-b:a", MP3_BITRATE, str(mp3)])
    return {"ogg": ogg.stat().st_size, "mp3": mp3.stat().st_size}


def measure_encoded(path: Path) -> dict[str, float]:
    """Integrated loudness, true peak and duration of an encoded file.

    @param path: Encoded audio file.
    @returns: {'lufs', 'true_peak_db', 'duration_seconds'}.
    """
    log = _ffmpeg(["-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    summary = log[log.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=nw=1:nk=1", str(path)],
                           capture_output=True, text=True)
    return {"lufs": lufs, "true_peak_db": peak,
            "duration_seconds": round(float(probe.stdout.strip()), 2)}


def report_dict(report: AudioReport) -> dict[str, object]:
    """Serialisable form of an AudioReport."""
    return asdict(report)
