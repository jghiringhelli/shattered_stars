/**
 * floatingText — short-lived world/screen text: damage and heal numbers,
 * status labels ("ENGINES DISABLED!") and kill notifications.
 * Fire-and-forget: every object destroys itself.
 */

import Phaser from "phaser";

/** Draw depth of damage / heal numbers. */
const NUMBER_DEPTH = 30;
/** Draw depth of status labels. */
const STATUS_DEPTH = 50;
/** Draw depth of kill notifications (screen space). */
const KILL_NOTICE_DEPTH = 100;
/** How long a kill notification stays fully visible (ms). */
const KILL_NOTICE_HOLD_MS = 2000;

/**
 * Float a damage number up from a point.
 *
 * @param scene - Scene to draw in.
 * @param at - Where the hit landed.
 * @param damage - Damage dealt.
 * @param isCritical - Larger red "CRIT!" text.
 */
export function floatDamageNumber(
  scene: Phaser.Scene,
  at: { readonly x: number; readonly y: number },
  damage: number,
  isCritical: boolean,
): void {
  const text = scene.add.text(at.x, at.y, `-${damage}`, {
    font: isCritical ? "bold 24px monospace" : "bold 18px monospace",
    color: isCritical ? "#ff0000" : "#ff6644",
    stroke: "#000000",
    strokeThickness: 3,
  });
  text.setOrigin(0.5, 0.5);
  text.setDepth(NUMBER_DEPTH);
  if (isCritical) text.setText(`CRIT! -${damage}`);
  scene.tweens.add({
    targets: text,
    y: at.y - 40,
    alpha: 0,
    scale: isCritical ? 1.3 : 1,
    duration: 800,
    ease: "Quad.out",
    onComplete: () => text.destroy(),
  });
}

/**
 * Float a status label up from a point.
 *
 * @param scene - Scene to draw in.
 * @param at - Where to show it.
 * @param text - Label text.
 * @param color - CSS colour.
 */
export function floatStatusText(
  scene: Phaser.Scene,
  at: { readonly x: number; readonly y: number },
  text: string,
  color: string,
): void {
  const label = scene.add.text(at.x, at.y, text, {
    font: "bold 18px Arial",
    color,
    stroke: "#000000",
    strokeThickness: 3,
  });
  label.setOrigin(0.5, 0.5);
  label.setDepth(STATUS_DEPTH);
  scene.tweens.add({
    targets: label,
    y: at.y - 60,
    alpha: 0,
    duration: 900,
    ease: "Power2",
    onComplete: () => label.destroy(),
  });
}

/**
 * Float a heal / shield-restore number up from a point.
 *
 * @param scene - Scene to draw in.
 * @param at - Where it was restored.
 * @param amount - Amount restored.
 * @param isShield - Blue for shields, green for hull.
 */
export function floatHealNumber(
  scene: Phaser.Scene,
  at: { readonly x: number; readonly y: number },
  amount: number,
  isShield: boolean,
): void {
  const text = scene.add.text(at.x, at.y, `+${amount}`, {
    font: "bold 16px monospace",
    color: isShield ? "#00aaff" : "#44ff44",
    stroke: "#000000",
    strokeThickness: 2,
  });
  text.setOrigin(0.5, 0.5);
  text.setDepth(NUMBER_DEPTH);
  scene.tweens.add({
    targets: text,
    y: at.y - 30,
    alpha: 0,
    duration: 600,
    ease: "Quad.out",
    onComplete: () => text.destroy(),
  });
}

/**
 * Pop a "<killer> destroyed <victim>" banner in screen space.
 *
 * @param scene - Scene to draw in.
 * @param message - Banner text.
 * @param at - Screen position.
 */
export function showKillNotice(
  scene: Phaser.Scene,
  message: string,
  at: { readonly x: number; readonly y: number },
): void {
  const container = scene.add.container(at.x, at.y);
  container.setDepth(KILL_NOTICE_DEPTH);
  container.setScrollFactor(0);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.7);
  bg.fillRoundedRect(-150, -15, 300, 30, 5);
  container.add(bg);
  const text = scene.add.text(0, 0, message, {
    font: "bold 14px monospace",
    color: "#ff8844",
  });
  text.setOrigin(0.5, 0.5);
  container.add(text);
  container.setAlpha(0);
  container.setScale(0.8);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: 200,
    ease: "Back.out",
    onComplete: () => {
      scene.time.delayedCall(KILL_NOTICE_HOLD_MS, () => {
        scene.tweens.add({
          targets: container,
          alpha: 0,
          y: at.y - 30,
          duration: 300,
          onComplete: () => container.destroy(),
        });
      });
    },
  });
}
