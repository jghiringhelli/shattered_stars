/**
 * TutorialOverlay — first-launch HTML/CSS overlay (not a Phaser scene) shown
 * once over the game background, giving a quick "how to fly" cheat-sheet.
 * Tracked via localStorage so it never shows again after being dismissed.
 * The full reference (every intent, every device) lives in ControlsScene,
 * reachable anytime from the main menu — this is just the first taste.
 */

import { keyboardLabelFor } from "./ControlsReference";
import type { ActionIntent } from "../input/InputTypes";

const SEEN_KEY = "ss_tutorial_seen_v1";

const QUICK_TIPS: ReadonlyArray<{
  label: string;
  intents: readonly ActionIntent[];
}> = [
  { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
  { label: "Throttle Up / Down", intents: ["THRUST_UP", "THRUST_DOWN"] },
  { label: "Primary Weapon", intents: [] },
  { label: "Boost Dash", intents: ["BOOST"] },
  { label: "Pause", intents: ["PAUSE"] },
];

/** Shows the first-launch overlay unless the player already dismissed it. */
export function initTutorialOverlay(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  // Automated test contexts (Playwright sets navigator.webdriver) always start
  // with empty localStorage — never show a blocking overlay there, it would
  // intercept every menu click in every e2e spec.
  if (typeof navigator !== "undefined" && navigator.webdriver === true) return;
  if (localStorage.getItem(SEEN_KEY) === "1") return;

  const overlay = document.getElementById("tutorial-overlay");
  const tipsList = document.getElementById("tutorial-tips");
  const dismissBtn = document.getElementById("tutorial-dismiss");
  if (!overlay || !tipsList || !dismissBtn) return;

  for (const tip of QUICK_TIPS) {
    const li = document.createElement("li");
    const labelSpan = document.createElement("span");
    labelSpan.textContent = tip.label;
    const keySpan = document.createElement("span");
    keySpan.className = "key";
    keySpan.textContent = keyboardLabelFor(tip.intents);
    li.append(labelSpan, keySpan);
    tipsList.appendChild(li);
  }

  const dismiss = (): void => {
    localStorage.setItem(SEEN_KEY, "1");
    overlay.classList.add("hidden");
    window.removeEventListener("keydown", onKeydown);
  };
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" || e.key === "Enter") dismiss();
  };

  dismissBtn.addEventListener("click", dismiss);
  window.addEventListener("keydown", onKeydown);
  overlay.classList.remove("hidden");
}
