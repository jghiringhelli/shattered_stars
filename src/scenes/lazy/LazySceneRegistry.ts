/**
 * Lazy scene registration: rarely used scenes live in their own chunks and are
 * registered with Phaser the first time something starts them.
 *
 * Phaser has no notion of a not-yet-registered scene (`start("X")` just warns),
 * so this wraps the scene manager: a `start` / `run` / `switch` of an unloaded
 * scene key first imports the chunk, registers the class, and only THEN
 * performs the operation. Scenes using `this.scene.start(...)` queue a `stop`
 * of themselves in front of the `start`; that pair is held back together, so
 * the current scene keeps running (no black frames) while the chunk downloads.
 * Everything else (`getScene`, `isActive`, `launch` from a scene, ...) keeps
 * the stock behaviour, so a loaded lazy scene is indistinguishable from an
 * eagerly registered one.
 */
import type Phaser from "phaser";

/** What `SceneManager.add` accepts: a Scene class, instance or config. */
export type SceneDefinition = Phaser.Types.Scenes.SceneType;

/** Imports the chunk of one scene and resolves its class. */
export type SceneLoader = () => Promise<SceneDefinition>;

/** Scene key to loader. */
export type LazySceneManifest = Readonly<Record<string, SceneLoader>>;

/** Observers of the lazy loading lifecycle (all optional). */
export interface LazySceneHooks {
  /** A chunk download starts. */
  readonly onLoadStart?: (key: string) => void;
  /** The scene is registered with Phaser (before its first start). */
  readonly onSceneAdded?: (key: string) => void;
  /** The download ended, successfully or not. */
  readonly onLoadEnd?: (key: string) => void;
  /** The chunk failed to load; the previous scene keeps running. */
  readonly onError?: (key: string, error: unknown) => void;
}

/** One entry of Phaser's private scene operation queue. */
interface QueuedOperation {
  readonly op: string;
  readonly keyA: unknown;
  readonly keyB: unknown;
  readonly data: unknown;
}

/** The part of `Phaser.Scenes.SceneManager` this module relies on. */
export interface SceneManagerLike {
  add(key: string, scene: SceneDefinition, autoStart?: boolean): unknown;
  getScene(key: string): unknown;
  start(key: string, data?: object): unknown;
  run(key: string, data?: object): unknown;
  switch(from: string, to: string, data?: object): unknown;
  queueOp(op: string, keyA?: unknown, keyB?: unknown, data?: unknown): unknown;
  /** Phaser's private queue (processed once per frame). */
  _queue: QueuedOperation[];
}

/** Operations that bring a scene up and therefore need it registered. */
const STARTING_OPERATIONS: ReadonlySet<string> = new Set(["start", "run", "switch"]);

/** Registers scenes on demand and patches a scene manager to do so transparently. */
export class LazySceneRegistry {
  private readonly loading = new Map<string, Promise<void>>();

  /**
   * @param manager - The game's scene manager.
   * @param manifest - Loaders of the lazily registered scenes.
   * @param hooks - Optional lifecycle observers.
   */
  constructor(
    private readonly manager: SceneManagerLike,
    private readonly manifest: LazySceneManifest,
    private readonly hooks: LazySceneHooks = {},
  ) {}

  /**
   * @param key - A scene key.
   * @returns Whether the key is lazy and its scene is not registered yet.
   */
  needsLoad(key: unknown): key is string {
    return (
      typeof key === "string" &&
      Object.prototype.hasOwnProperty.call(this.manifest, key) &&
      !this.isRegistered(key)
    );
  }

  /**
   * @param key - A scene key.
   * @returns Whether a chunk download for the key is in flight.
   */
  isLoading(key: string): boolean {
    return this.loading.has(key);
  }

  /**
   * Loads and registers a lazy scene. Resolves immediately for eager scenes
   * and for scenes that are already registered.
   *
   * @param key - A scene key.
   * @returns Resolves once the scene can be started; rejects when the chunk fails.
   */
  ensureScene(key: string): Promise<void> {
    if (!this.needsLoad(key)) return Promise.resolve();
    const inFlight = this.loading.get(key);
    if (inFlight) return inFlight;
    const loader = this.manifest[key]!;
    this.hooks.onLoadStart?.(key);
    const promise = loader()
      .then((definition) => {
        if (this.isRegistered(key)) return;
        this.manager.add(key, definition, false);
        this.hooks.onSceneAdded?.(key);
      })
      .finally(() => {
        this.loading.delete(key);
        this.hooks.onLoadEnd?.(key);
      });
    this.loading.set(key, promise);
    return promise;
  }

  /**
   * Loads every lazy scene (tests and tooling that inspect scene instances before starting them).
   *
   * @returns Resolves when all scenes are registered.
   */
  async ensureAll(): Promise<void> {
    await Promise.all(Object.keys(this.manifest).map((key) => this.ensureScene(key)));
  }

  /** Patches `queueOp`, `start`, `run` and `switch` of the manager (call once, before any scene starts). */
  install(): void {
    const manager = this.manager;
    const queueOp = manager.queueOp.bind(manager);
    const start = manager.start.bind(manager);
    const run = manager.run.bind(manager);
    const switchScene = manager.switch.bind(manager);

    manager.queueOp = (op, keyA, keyB, data) => {
      const target = op === "switch" ? keyB : keyA;
      if (!STARTING_OPERATIONS.has(op) || !this.needsLoad(target)) {
        return queueOp(op, keyA, keyB, data);
      }
      const heldBack = this.takeLeadingStop(op, keyA);
      this.afterLoad(target, () => {
        for (const held of heldBack) queueOp(held.op, held.keyA, held.keyB, held.data);
        queueOp(op, keyA, keyB, data);
      });
      return manager;
    };
    manager.start = (key, data) => this.deferOrRun(key, () => start(key, data));
    manager.run = (key, data) => this.deferOrRun(key, () => run(key, data));
    manager.switch = (from, to, data) => this.deferOrRun(to, () => switchScene(from, to, data));
  }

  private isRegistered(key: string): boolean {
    return Boolean(this.manager.getScene(key));
  }

  private deferOrRun(key: string, run: () => unknown): SceneManagerLike {
    if (this.needsLoad(key)) this.afterLoad(key, run);
    else run();
    return this.manager;
  }

  private afterLoad(key: string, action: () => void): void {
    this.ensureScene(key).then(action, (error: unknown) => this.hooks.onError?.(key, error));
  }

  /** The `stop` that `ScenePlugin.start` queues right before its `start` (held back with it). */
  private takeLeadingStop(op: string, startedKey: unknown): QueuedOperation[] {
    if (op !== "start") return [];
    const queue = this.manager._queue;
    const last = queue[queue.length - 1];
    if (!last || last.op !== "stop" || last.keyA === startedKey) return [];
    queue.pop();
    return [last];
  }
}
