/**
 * SimManeuvers — the abstract maneuver geometry of the turn-based balance
 * simulator (BattleSimulator): one template per turn at a flat 60 px per
 * speed, no base size, inside a 1000 px bounded board.
 *
 * Simulator-only. The game itself flies the tabletop cycle engine
 * (MovementSystem / ArcadeControls / CycleFlight); the balance acceptance
 * thresholds in tests/balance are calibrated against this geometry.
 */

import type { ManeuverDirection, ManeuverTemplate } from "../core/types";

// Base movement unit (pixels) - adjust for visual scale
const BASE_UNIT = 60;

/**
 * Calculate maneuver template for given direction and speed.
 * Returns the delta X, Y, and angle from the ship's perspective.
 *
 * Coordinate system:
 * - Ship starts at (0,0) facing "up" (angle 0)
 * - Positive X is right, positive Y is down (Phaser convention)
 * - Angle 0 = up, 90 = right, 180 = down, 270 = left
 */
export function getManeuverTemplate(
  direction: ManeuverDirection,
  speed: number,
): ManeuverTemplate {
  const distance = speed * BASE_UNIT;

  switch (direction) {
    case "straight":
      // Move forward, no rotation
      return {
        deltaX: 0,
        deltaY: -distance, // Negative Y = forward/up
        deltaAngle: 0,
      };

    case "bank_left":
      // Gentle curve left - 45 degree turn
      // Ship ends up forward-left, facing 45 degrees left
      return {
        deltaX: -distance * 0.38, // Arc to the left
        deltaY: -distance * 0.92, // Forward
        deltaAngle: -45,
      };

    case "bank_right":
      // Gentle curve right - 45 degree turn
      return {
        deltaX: distance * 0.38,
        deltaY: -distance * 0.92,
        deltaAngle: 45,
      };

    case "turn_left":
      // Hard turn left - 90 degree turn
      // Ship ends up roughly at the left, facing left
      return {
        deltaX: -distance * 0.7,
        deltaY: -distance * 0.7,
        deltaAngle: -90,
      };

    case "turn_right":
      // Hard turn right - 90 degree turn
      return {
        deltaX: distance * 0.7,
        deltaY: -distance * 0.7,
        deltaAngle: 90,
      };

    case "kturn":
      // Snap turn - move forward then flip 180
      return {
        deltaX: 0,
        deltaY: -distance,
        deltaAngle: 180,
      };

    case "segnor_left":
      // Hook Loop left - bank then flip
      return {
        deltaX: -distance * 0.38,
        deltaY: -distance * 0.92,
        deltaAngle: -45 + 180, // Bank angle + 180 flip
      };

    case "segnor_right":
      // Hook Loop right
      return {
        deltaX: distance * 0.38,
        deltaY: -distance * 0.92,
        deltaAngle: 45 + 180,
      };

    case "tallon_left":
      // Knife Roll left - turn then flip
      return {
        deltaX: -distance * 0.7,
        deltaY: -distance * 0.7,
        deltaAngle: -90 + 180, // Turn angle + 180 flip
      };

    case "tallon_right":
      // Knife Roll right
      return {
        deltaX: distance * 0.7,
        deltaY: -distance * 0.7,
        deltaAngle: 90 + 180,
      };

    default:
      // Fallback to straight
      return {
        deltaX: 0,
        deltaY: -distance,
        deltaAngle: 0,
      };
  }
}

/**
 * Apply a maneuver template to a ship's current position.
 * Takes into account the ship's current facing angle.
 */
export function applyManeuver(
  startX: number,
  startY: number,
  startAngle: number,
  template: ManeuverTemplate,
): { x: number; y: number; angle: number } {
  // Convert ship's facing angle to radians
  const angleRad = startAngle * (Math.PI / 180);

  // Rotate the template deltas by the ship's current facing
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Rotate the delta position
  const rotatedDeltaX = template.deltaX * cos - template.deltaY * sin;
  const rotatedDeltaY = template.deltaX * sin + template.deltaY * cos;

  // Calculate final position
  const finalX = startX + rotatedDeltaX;
  const finalY = startY + rotatedDeltaY;

  // Calculate final angle (add delta, normalize to 0-360)
  let finalAngle = (startAngle + template.deltaAngle) % 360;
  if (finalAngle < 0) finalAngle += 360;

  return {
    x: finalX,
    y: finalY,
    angle: finalAngle,
  };
}

/**
 * Return the local-frame displacement at t (0..1) along the maneuver.
 * Curved maneuvers use a true circular arc; straight/snap turn use linear lerp.
 * Arc radius is derived from the template endpoint for exact path fidelity.
 */
function arcInterpolateLocal(
  direction: ManeuverDirection,
  template: ManeuverTemplate,
  t: number,
): ManeuverTemplate {
  const arcRadius = (sweepAngle: number): number =>
    Math.abs(template.deltaY) / Math.sin(sweepAngle);

  switch (direction) {
    case "bank_left":
    case "segnor_left": {
      const R = arcRadius(Math.PI / 4);
      const a = (Math.PI / 4) * t;
      return {
        deltaX: -R * (1 - Math.cos(a)),
        deltaY: -R * Math.sin(a),
        deltaAngle: template.deltaAngle * t,
      };
    }
    case "bank_right":
    case "segnor_right": {
      const R = arcRadius(Math.PI / 4);
      const a = (Math.PI / 4) * t;
      return {
        deltaX: R * (1 - Math.cos(a)),
        deltaY: -R * Math.sin(a),
        deltaAngle: template.deltaAngle * t,
      };
    }
    case "turn_left":
    case "tallon_left": {
      const R = arcRadius(Math.PI / 2);
      const a = (Math.PI / 2) * t;
      return {
        deltaX: -R * (1 - Math.cos(a)),
        deltaY: -R * Math.sin(a),
        deltaAngle: template.deltaAngle * t,
      };
    }
    case "turn_right":
    case "tallon_right": {
      const R = arcRadius(Math.PI / 2);
      const a = (Math.PI / 2) * t;
      return {
        deltaX: R * (1 - Math.cos(a)),
        deltaY: -R * Math.sin(a),
        deltaAngle: template.deltaAngle * t,
      };
    }
    default:
      return {
        deltaX: template.deltaX * t,
        deltaY: template.deltaY * t,
        deltaAngle: template.deltaAngle * t,
      };
  }
}

/**
 * Generate waypoints for animating a maneuver.
 * Curved maneuvers (bank, turn, hook, knife) follow true circular arcs;
 * straight and snap turns follow linear paths.
 */
export function generateManeuverPath(
  startX: number,
  startY: number,
  startAngle: number,
  direction: ManeuverDirection,
  speed: number,
  segments: number = 10,
): Array<{ x: number; y: number; angle: number }> {
  const template = getManeuverTemplate(direction, speed);
  const path: Array<{ x: number; y: number; angle: number }> = [];

  for (let i = 0; i <= segments; i++) {
    const partial = arcInterpolateLocal(direction, template, i / segments);
    path.push(applyManeuver(startX, startY, startAngle, partial));
  }

  return path;
}

/**
 * Calculate the "bump zone" - where a ship would collide during maneuver.
 * Used for collision detection during activation phase.
 */
export function getManeuverBounds(
  startX: number,
  startY: number,
  startAngle: number,
  direction: ManeuverDirection,
  speed: number,
  shipRadius: number = 20,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const path = generateManeuverPath(
    startX,
    startY,
    startAngle,
    direction,
    speed,
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of path) {
    minX = Math.min(minX, pos.x - shipRadius);
    minY = Math.min(minY, pos.y - shipRadius);
    maxX = Math.max(maxX, pos.x + shipRadius);
    maxY = Math.max(maxY, pos.y + shipRadius);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Visual representation data for drawing templates on screen
 */
export interface TemplateVisual {
  type: "straight" | "arc";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  arcAngle?: number; // For curved templates
  color: number; // Based on difficulty
}

export function getTemplateVisual(
  direction: ManeuverDirection,
  speed: number,
  difficulty: "green" | "white" | "red",
): TemplateVisual {
  const template = getManeuverTemplate(direction, speed);

  const color =
    difficulty === "green"
      ? 0x00ff00
      : difficulty === "red"
        ? 0xff0000
        : 0xffffff;

  const isCurved =
    direction.includes("bank") ||
    direction.includes("turn") ||
    direction.includes("tallon");

  const visual: TemplateVisual = {
    type: isCurved ? "arc" : "straight",
    startX: 0,
    startY: 0,
    endX: template.deltaX,
    endY: template.deltaY,
    color,
  };

  if (isCurved) {
    visual.arcAngle = template.deltaAngle;
  }

  return visual;
}
