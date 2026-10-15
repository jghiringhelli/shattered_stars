import { describe, expect, it, vi } from "vitest";
import {
  LazySceneRegistry,
  type SceneManagerLike,
} from "../../../../src/scenes/lazy/LazySceneRegistry";

/** A scene manager fake: scenes by key, a queue, and a recorded log of executed operations. */
function createManager() {
  const scenes = new Map<string, unknown>([["MainMenuScene", {}]]);
  const log: string[] = [];
  const manager: SceneManagerLike = {
    add: (key, scene) => {
      scenes.set(key, scene);
      log.push(`add ${key}`);
    },
    getScene: (key) => scenes.get(key) ?? null,
    start: (key) => log.push(`start ${key}`),
    run: (key) => log.push(`run ${key}`),
    switch: (from, to) => log.push(`switch ${from}>${to}`),
    queueOp(op, keyA, keyB, data) {
      this._queue.push({ op, keyA, keyB, data });
    },
    _queue: [],
  };
  /** Phaser's per-frame queue processing. */
  const processQueue = (): void => {
    for (const entry of manager._queue.splice(0)) {
      if (entry.op === "stop") log.push(`stop ${String(entry.keyA)}`);
      else if (entry.op === "switch") manager.switch(entry.keyA as string, entry.keyB as string);
      else if (entry.op === "run") manager.run(entry.keyA as string);
      else manager.start(entry.keyA as string);
    }
  };
  return { manager, scenes, log, processQueue };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup(loader = () => Promise.resolve(class CampaignScene {})) {
  const harness = createManager();
  const hooks = { onLoadStart: vi.fn(), onSceneAdded: vi.fn(), onLoadEnd: vi.fn(), onError: vi.fn() };
  const registry = new LazySceneRegistry(harness.manager, { CampaignScene: loader }, hooks);
  registry.install();
  return { ...harness, registry, hooks };
}

describe("LazySceneRegistry", () => {
  it("registers_a_lazy_scene_before_a_direct_start_runs", async () => {
    const { manager, log } = setup();
    manager.start("CampaignScene", {});
    expect(log).toEqual([]);
    await flush();
    expect(log).toEqual(["add CampaignScene", "start CampaignScene"]);
  });

  it("starts_a_registered_scene_synchronously", () => {
    const { manager, log } = setup();
    manager.start("MainMenuScene");
    expect(log).toEqual(["start MainMenuScene"]);
  });

  it("keeps_the_calling_scene_running_until_the_chunk_has_loaded", async () => {
    const { manager, log, processQueue } = setup();
    manager.queueOp("stop", "MainMenuScene");
    manager.queueOp("start", "CampaignScene");
    processQueue();
    expect(log).toEqual([]);
    await flush();
    processQueue();
    expect(log).toEqual(["add CampaignScene", "stop MainMenuScene", "start CampaignScene"]);
  });

  it("does_not_hold_back_the_stop_of_the_target_itself", async () => {
    const { manager, log, processQueue } = setup();
    manager.queueOp("stop", "CampaignScene");
    manager.queueOp("start", "CampaignScene");
    processQueue();
    expect(log).toEqual(["stop CampaignScene"]);
    await flush();
    processQueue();
    expect(log).toContain("start CampaignScene");
  });

  it("defers_launch_run_and_switch_of_an_unloaded_scene", async () => {
    const { manager, log, processQueue } = setup();
    manager.queueOp("run", "CampaignScene");
    manager.queueOp("switch", "MainMenuScene", "CampaignScene");
    processQueue();
    await flush();
    processQueue();
    expect(log).toEqual(["add CampaignScene", "run CampaignScene", "switch MainMenuScene>CampaignScene"]);
  });

  it("imports_a_chunk_only_once_for_concurrent_starts", async () => {
    const loader = vi.fn(() => Promise.resolve(class CampaignScene {}));
    const { manager, log } = setup(loader);
    manager.start("CampaignScene");
    manager.start("CampaignScene");
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(log.filter((entry) => entry === "start CampaignScene")).toHaveLength(2);
    expect(log.filter((entry) => entry === "add CampaignScene")).toHaveLength(1);
  });

  it("reports_a_failed_chunk_and_never_starts_the_scene", async () => {
    const failure = new Error("chunk 404");
    const { manager, log, hooks, registry } = setup(() => Promise.reject(failure));
    manager.start("CampaignScene");
    await flush();
    expect(hooks.onError).toHaveBeenCalledWith("CampaignScene", failure);
    expect(log).toEqual([]);
    expect(registry.isLoading("CampaignScene")).toBe(false);
  });

  it("retries_the_import_after_a_failure", async () => {
    let attempts = 0;
    const { manager, log } = setup(() =>
      ++attempts === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(class CampaignScene {}),
    );
    manager.start("CampaignScene");
    await flush();
    manager.start("CampaignScene");
    await flush();
    expect(log).toEqual(["add CampaignScene", "start CampaignScene"]);
  });

  it("calls_the_hooks_in_order", async () => {
    const { manager, hooks } = setup();
    manager.start("CampaignScene");
    await flush();
    expect(hooks.onLoadStart).toHaveBeenCalledWith("CampaignScene");
    expect(hooks.onSceneAdded).toHaveBeenCalledWith("CampaignScene");
    expect(hooks.onLoadEnd).toHaveBeenCalledWith("CampaignScene");
  });

  it("ensureScene_resolves_for_eager_and_loaded_scenes_without_importing", async () => {
    const loader = vi.fn(() => Promise.resolve(class CampaignScene {}));
    const { registry } = setup(loader);
    await registry.ensureScene("MainMenuScene");
    await registry.ensureScene("CampaignScene");
    await registry.ensureScene("CampaignScene");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("ensureAll_registers_every_lazy_scene", async () => {
    const { registry, scenes } = setup();
    await registry.ensureAll();
    expect(scenes.has("CampaignScene")).toBe(true);
  });

  it("ignores_prototype_property_names_as_scene_keys", () => {
    const { registry } = setup();
    expect(registry.needsLoad("constructor")).toBe(false);
    expect(registry.needsLoad("CampaignScene")).toBe(true);
  });
});
