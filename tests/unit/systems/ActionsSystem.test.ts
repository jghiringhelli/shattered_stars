/**
 * Tests for ActionsSystem
 */

import { describe, it, expect } from "vitest";
import { ACTION_DEFINITIONS } from "../../../src/systems/ActionsSystem";
import type { ActionType } from "../../../src/core/types";

describe("ActionsSystem", () => {
  describe("ACTION_DEFINITIONS", () => {
    it("should define all standard actions", () => {
      const actions: ActionType[] = [
        "focus",
        "evade",
        "target_lock",
        "barrel_roll",
        "boost",
        "coordinate",
        "jam",
        "cloak",
        "slam",
        "calculate",
        "reinforce",
        "rotate_arc",
        "reload",
      ];

      for (const action of actions) {
        expect(ACTION_DEFINITIONS[action]).toBeDefined();
        expect(ACTION_DEFINITIONS[action].type).toBe(action);
      }
    });

    it("should mark reload as a red action that causes stress", () => {
      expect(ACTION_DEFINITIONS.reload.causesStress).toBe(true);
      expect(ACTION_DEFINITIONS.reload.isRed).toBe(true);
      expect(ACTION_DEFINITIONS.reload.allowedWhenStressed).toBe(false);
    });

    it("standard actions should not cause stress and be allowed when stressed", () => {
      const standardActions: ActionType[] = [
        "focus",
        "evade",
        "target_lock",
        "barrel_roll",
        "boost",
        "coordinate",
        "jam",
        "cloak",
        "slam",
        "calculate",
        "reinforce",
        "rotate_arc",
      ];
      for (const action of standardActions) {
        const def = ACTION_DEFINITIONS[action];
        expect(def.causesStress).toBe(false);
        expect(def.isRed).toBe(false);
        expect(def.allowedWhenStressed).toBe(true);
      }
    });

    it("all action definitions should have non-empty name and description", () => {
      const actions = Object.values(ACTION_DEFINITIONS);
      for (const def of actions) {
        expect(def.name.length).toBeGreaterThan(0);
        expect(def.description.length).toBeGreaterThan(0);
      }
    });
  });
});
