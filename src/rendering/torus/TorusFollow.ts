/**
 * TorusFollow — camera follow that crosses the arena seam the short way.
 *
 * Phaser's startFollow chases a target's raw coordinates, so when a ship
 * wraps from one edge to the other the camera sweeps across the whole map.
 * This follows the shortest torus path instead and keeps the view centre in
 * [0, size), which is what TorusViewRig expects.
 */

import Phaser from "phaser";
import {
  stepTorusFollow,
  type TorusCenter,
  wrapIntoArena,
} from "./torusFollowMath";

/** Anything with a world position (a ship container). */
export interface FollowTarget {
  readonly x: number;
  readonly y: number;
}

export class TorusFollow {
  private target: FollowTarget | null = null;
  private lerp = 1;
  private readonly center: TorusCenter = { x: 0, y: 0 };

  /**
   * @param scene - Scene whose main camera to drive (after its update, before render).
   * @param worldSize - Arena edge length.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldSize: number,
  ) {
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.step, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /**
   * Start following `target`.
   *
   * @param target - Object to follow.
   * @param lerp - Fraction of the gap closed per frame (0..1).
   */
  follow(target: FollowTarget, lerp: number): void {
    const camera = this.scene.cameras.main;
    this.center.x = wrapIntoArena(camera.scrollX + camera.width / 2, this.worldSize);
    this.center.y = wrapIntoArena(camera.scrollY + camera.height / 2, this.worldSize);
    this.target = target;
    this.lerp = lerp;
  }

  private step(): void {
    if (!this.target) return;
    stepTorusFollow(this.center, this.target.x, this.target.y, this.lerp, this.worldSize);
    this.scene.cameras.main.centerOn(this.center.x, this.center.y);
  }

  /** Stop following and unhook (also runs on scene shutdown). */
  destroy(): void {
    this.target = null;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.step, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }
}
