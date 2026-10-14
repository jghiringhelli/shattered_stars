"""ComfyUI API graph of one ship render: SDXL [+ LoRA] + union ControlNet (depth), optional img2img + hires pass."""

SDXL = "sd_xl_base_1.0.safetensors"
SDXL_VAE = "sdxl_vae_fp16fix.safetensors"
CONTROLNET = "controlnet-union-promax-sdxl.safetensors"
CONTROL_TYPE = "depth"
STEPS, CFG = 30, 6.5
HIRES_SCALE, HIRES_DENOISE, HIRES_STEPS = 1.25, 0.35, 20
SAMPLER, SCHEDULER = "dpmpp_2m", "karras"


def _sampler(model: list, positive: list, negative: list, latent: list, seed: int, steps: int, denoise: float) -> dict:
    return {"class_type": "KSampler", "inputs": {
        "model": model, "positive": positive, "negative": negative, "latent_image": latent, "seed": seed,
        "steps": steps, "cfg": CFG, "sampler_name": SAMPLER, "scheduler": SCHEDULER, "denoise": denoise}}


def build_workflow(job: dict, negative_text: str) -> dict:
    """Build the API graph of a job.

    :param job: prompt, seed, size (w, h), lora (name, weight), guide (uploaded depth guide),
        control (strength, end percent), init (uploaded init image or ""), denoise, hires (bool).
    :param negative_text: negative prompt.
    :returns: API-format graph ending in a PreviewImage node.
    """
    model, clip = ["1", 0], ["1", 1]
    graph = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": SDXL}},
             "7": {"class_type": "VAELoader", "inputs": {"vae_name": SDXL_VAE}}}
    if job["lora"][0]:
        graph["2"] = {"class_type": "LoraLoader", "inputs": {
            "model": model, "clip": clip, "lora_name": job["lora"][0],
            "strength_model": job["lora"][1], "strength_clip": job["lora"][1]}}
        model, clip = ["2", 0], ["2", 1]
    graph["3"] = {"class_type": "CLIPTextEncode", "inputs": {"text": job["prompt"], "clip": clip}}
    graph["4"] = {"class_type": "CLIPTextEncode", "inputs": {"text": negative_text, "clip": clip}}
    graph.update({
        "10": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": CONTROLNET}},
        "11": {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["10", 0], "type": CONTROL_TYPE}},
        "12": {"class_type": "LoadImage", "inputs": {"image": job["guide"]}},
        "13": {"class_type": "ControlNetApplyAdvanced", "inputs": {
            "positive": ["3", 0], "negative": ["4", 0], "control_net": ["11", 0], "image": ["12", 0],
            "strength": job["control"][0], "start_percent": 0.0, "end_percent": job["control"][1], "vae": ["7", 0]}}})
    if job["init"]:
        graph["30"] = {"class_type": "LoadImage", "inputs": {"image": job["init"]}}
        graph["31"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["30", 0], "vae": ["7", 0]}}
        latent = ["31", 0]
    else:
        graph["5"] = {"class_type": "EmptyLatentImage",
                      "inputs": {"width": job["size"][0], "height": job["size"][1], "batch_size": 1}}
        latent = ["5", 0]
    graph["6"] = _sampler(model, ["13", 0], ["13", 1], latent, job["seed"], STEPS, job["denoise"])
    final = ["6", 0]
    if job["hires"]:
        graph["40"] = {"class_type": "LatentUpscaleBy", "inputs": {
            "samples": ["6", 0], "upscale_method": "bislerp", "scale_by": HIRES_SCALE}}
        graph["41"] = _sampler(model, ["3", 0], ["4", 0], ["40", 0], job["seed"], HIRES_STEPS, HIRES_DENOISE)
        final = ["41", 0]
    graph["8"] = {"class_type": "VAEDecode", "inputs": {"samples": final, "vae": ["7", 0]}}
    graph["9"] = {"class_type": "PreviewImage", "inputs": {"images": ["8", 0]}}
    return graph
