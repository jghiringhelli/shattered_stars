/**
 * Maneuver Templates Tests
 *
 * Tests for the X-Wing style maneuver geometry calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  getManeuverTemplate,
  applyManeuver,
  generateManeuverPath,
  getManeuverBounds,
  getTemplateVisual,
  type TemplateVisual,
} from '../../../src/systems/ManeuverTemplates';
import type { ManeuverDirection, ManeuverTemplate } from '../../../src/core/types';

describe('ManeuverTemplates', () => {
  describe('getManeuverTemplate', () => {
    describe('straight maneuver', () => {
      it('should move forward with no rotation', () => {
        const template = getManeuverTemplate('straight', 2);

        expect(template.deltaX).toBe(0);
        expect(template.deltaY).toBeLessThan(0); // Forward is negative Y
        expect(template.deltaAngle).toBe(0);
      });

      it('should scale distance with speed', () => {
        const speed1 = getManeuverTemplate('straight', 1);
        const speed3 = getManeuverTemplate('straight', 3);

        expect(Math.abs(speed3.deltaY)).toBe(Math.abs(speed1.deltaY) * 3);
      });
    });

    describe('bank maneuvers', () => {
      it('should turn 45 degrees left for bank_left', () => {
        const template = getManeuverTemplate('bank_left', 2);

        expect(template.deltaX).toBeLessThan(0); // Moves left
        expect(template.deltaY).toBeLessThan(0); // Moves forward
        expect(template.deltaAngle).toBe(-45);
      });

      it('should turn 45 degrees right for bank_right', () => {
        const template = getManeuverTemplate('bank_right', 2);

        expect(template.deltaX).toBeGreaterThan(0); // Moves right
        expect(template.deltaY).toBeLessThan(0); // Moves forward
        expect(template.deltaAngle).toBe(45);
      });

      it('should have symmetric bank templates', () => {
        const left = getManeuverTemplate('bank_left', 2);
        const right = getManeuverTemplate('bank_right', 2);

        expect(left.deltaX).toBe(-right.deltaX);
        expect(left.deltaY).toBe(right.deltaY);
        expect(left.deltaAngle).toBe(-right.deltaAngle);
      });
    });

    describe('turn maneuvers', () => {
      it('should turn 90 degrees left for turn_left', () => {
        const template = getManeuverTemplate('turn_left', 2);

        expect(template.deltaX).toBeLessThan(0);
        expect(template.deltaY).toBeLessThan(0);
        expect(template.deltaAngle).toBe(-90);
      });

      it('should turn 90 degrees right for turn_right', () => {
        const template = getManeuverTemplate('turn_right', 2);

        expect(template.deltaX).toBeGreaterThan(0);
        expect(template.deltaY).toBeLessThan(0);
        expect(template.deltaAngle).toBe(90);
      });
    });

    describe('special maneuvers', () => {
      it('should flip 180 degrees for kturn', () => {
        const template = getManeuverTemplate('kturn', 2);

        expect(template.deltaX).toBe(0);
        expect(template.deltaY).toBeLessThan(0);
        expect(template.deltaAngle).toBe(180);
      });

      it('should combine bank and flip for segnor_left', () => {
        const template = getManeuverTemplate('segnor_left', 2);

        expect(template.deltaX).toBeLessThan(0);
        expect(template.deltaAngle).toBe(-45 + 180);
      });

      it('should combine bank and flip for segnor_right', () => {
        const template = getManeuverTemplate('segnor_right', 2);

        expect(template.deltaX).toBeGreaterThan(0);
        expect(template.deltaAngle).toBe(45 + 180);
      });

      it('should combine turn and flip for tallon_left', () => {
        const template = getManeuverTemplate('tallon_left', 2);

        expect(template.deltaX).toBeLessThan(0);
        expect(template.deltaAngle).toBe(-90 + 180);
      });

      it('should combine turn and flip for tallon_right', () => {
        const template = getManeuverTemplate('tallon_right', 2);

        expect(template.deltaX).toBeGreaterThan(0);
        expect(template.deltaAngle).toBe(90 + 180);
      });
    });

    describe('fallback behavior', () => {
      it('should return straight template for unknown direction', () => {
        // @ts-expect-error Testing fallback for unknown direction
        const template = getManeuverTemplate('unknown', 2);

        expect(template.deltaX).toBe(0);
        expect(template.deltaAngle).toBe(0);
      });
    });
  });

  describe('applyManeuver', () => {
    it('should apply straight maneuver facing up', () => {
      const template: ManeuverTemplate = { deltaX: 0, deltaY: -100, deltaAngle: 0 };
      const result = applyManeuver(100, 200, 0, template);

      expect(result.x).toBeCloseTo(100);
      expect(result.y).toBeCloseTo(100);
      expect(result.angle).toBe(0);
    });

    it('should rotate movement based on ship facing', () => {
      const template: ManeuverTemplate = { deltaX: 0, deltaY: -100, deltaAngle: 0 };

      // Ship facing right (90 degrees)
      const result = applyManeuver(100, 100, 90, template);

      expect(result.x).toBeCloseTo(200); // Moves right
      expect(result.y).toBeCloseTo(100); // No vertical change
      expect(result.angle).toBe(90);
    });

    it('should apply angle delta', () => {
      const template: ManeuverTemplate = { deltaX: 0, deltaY: -100, deltaAngle: 45 };
      const result = applyManeuver(100, 100, 0, template);

      expect(result.angle).toBe(45);
    });

    it('should normalize angle to 0-360', () => {
      const template: ManeuverTemplate = { deltaX: 0, deltaY: -100, deltaAngle: 180 };
      const result = applyManeuver(100, 100, 270, template);

      // 270 + 180 = 450 -> normalized to 90
      expect(result.angle).toBe(90);
    });

    it('should handle negative angle normalization', () => {
      const template: ManeuverTemplate = { deltaX: 0, deltaY: -100, deltaAngle: -90 };
      const result = applyManeuver(100, 100, 45, template);

      // 45 - 90 = -45 -> normalized to 315
      expect(result.angle).toBe(315);
    });
  });

  describe('generateManeuverPath', () => {
    it('should generate correct number of segments', () => {
      const path = generateManeuverPath(0, 0, 0, 'straight', 2, 5);

      expect(path).toHaveLength(6); // segments + 1
    });

    it('should start at the initial position', () => {
      const path = generateManeuverPath(100, 200, 45, 'straight', 2, 10);

      expect(path[0]!.x).toBeCloseTo(100);
      expect(path[0]!.y).toBeCloseTo(200);
      expect(path[0]!.angle).toBeCloseTo(45);
    });

    it('should end at the final position', () => {
      const template = getManeuverTemplate('straight', 2);
      const finalPos = applyManeuver(100, 200, 0, template);
      const path = generateManeuverPath(100, 200, 0, 'straight', 2, 10);

      const lastPoint = path[path.length - 1]!;
      expect(lastPoint.x).toBeCloseTo(finalPos.x);
      expect(lastPoint.y).toBeCloseTo(finalPos.y);
      expect(lastPoint.angle).toBeCloseTo(finalPos.angle);
    });

    it('should interpolate smoothly', () => {
      const path = generateManeuverPath(0, 0, 0, 'straight', 2, 4);

      // Check that positions progress smoothly
      for (let i = 1; i < path.length; i++) {
        expect(path[i]!.y).toBeLessThan(path[i - 1]!.y); // Moving forward (negative Y)
      }
    });

    it('should default to 10 segments', () => {
      const path = generateManeuverPath(0, 0, 0, 'straight', 2);

      expect(path).toHaveLength(11); // 10 segments + 1
    });
  });

  describe('getManeuverBounds', () => {
    it('should calculate bounding box including ship radius', () => {
      const bounds = getManeuverBounds(100, 100, 0, 'straight', 2, 20);

      expect(bounds.minX).toBeLessThan(100);
      expect(bounds.maxX).toBeGreaterThan(100);
      expect(bounds.minY).toBeLessThan(100);
      expect(bounds.maxY).toBeLessThan(200); // Forward is negative Y
    });

    it('should account for ship radius', () => {
      const smallRadius = getManeuverBounds(100, 100, 0, 'straight', 2, 10);
      const largeRadius = getManeuverBounds(100, 100, 0, 'straight', 2, 30);

      expect(largeRadius.minX).toBeLessThan(smallRadius.minX);
      expect(largeRadius.maxX).toBeGreaterThan(smallRadius.maxX);
    });

    it('should use default radius of 20', () => {
      const defaultBounds = getManeuverBounds(100, 100, 0, 'straight', 2);
      const explicitBounds = getManeuverBounds(100, 100, 0, 'straight', 2, 20);

      expect(defaultBounds).toEqual(explicitBounds);
    });

    it('should expand for curved maneuvers', () => {
      const straightBounds = getManeuverBounds(100, 100, 0, 'straight', 2, 20);
      const turnBounds = getManeuverBounds(100, 100, 0, 'turn_left', 2, 20);

      // Turn should have wider horizontal bounds
      const straightWidth = straightBounds.maxX - straightBounds.minX;
      const turnWidth = turnBounds.maxX - turnBounds.minX;

      expect(turnWidth).toBeGreaterThan(straightWidth);
    });
  });

  describe('getTemplateVisual', () => {
    it('should return straight type for straight maneuvers', () => {
      const visual = getTemplateVisual('straight', 2, 'white');

      expect(visual.type).toBe('straight');
      expect(visual.arcAngle).toBeUndefined();
    });

    it('should return arc type for bank maneuvers', () => {
      const visual = getTemplateVisual('bank_left', 2, 'white');

      expect(visual.type).toBe('arc');
      expect(visual.arcAngle).toBe(-45);
    });

    it('should return arc type for turn maneuvers', () => {
      const visual = getTemplateVisual('turn_right', 2, 'white');

      expect(visual.type).toBe('arc');
      expect(visual.arcAngle).toBe(90);
    });

    it('should return arc type for tallon maneuvers', () => {
      const visual = getTemplateVisual('tallon_left', 2, 'white');

      expect(visual.type).toBe('arc');
      expect(visual.arcAngle).toBe(90); // -90 + 180
    });

    it('should set correct color for difficulty', () => {
      const green = getTemplateVisual('straight', 2, 'green');
      const white = getTemplateVisual('straight', 2, 'white');
      const red = getTemplateVisual('straight', 2, 'red');

      expect(green.color).toBe(0x00ff00);
      expect(white.color).toBe(0xffffff);
      expect(red.color).toBe(0xff0000);
    });

    it('should set correct start and end coordinates', () => {
      const template = getManeuverTemplate('bank_left', 2);
      const visual = getTemplateVisual('bank_left', 2, 'white');

      expect(visual.startX).toBe(0);
      expect(visual.startY).toBe(0);
      expect(visual.endX).toBe(template.deltaX);
      expect(visual.endY).toBe(template.deltaY);
    });
  });

  describe('All maneuver directions', () => {
    const directions: ManeuverDirection[] = [
      'straight',
      'bank_left',
      'bank_right',
      'turn_left',
      'turn_right',
      'kturn',
      'segnor_left',
      'segnor_right',
      'tallon_left',
      'tallon_right',
    ];

    for (const direction of directions) {
      it(`should generate valid template for ${direction}`, () => {
        const template = getManeuverTemplate(direction, 2);

        expect(typeof template.deltaX).toBe('number');
        expect(typeof template.deltaY).toBe('number');
        expect(typeof template.deltaAngle).toBe('number');
        expect(isFinite(template.deltaX)).toBe(true);
        expect(isFinite(template.deltaY)).toBe(true);
        expect(isFinite(template.deltaAngle)).toBe(true);
      });

      it(`should generate valid path for ${direction}`, () => {
        const path = generateManeuverPath(100, 100, 0, direction, 2);

        expect(path.length).toBeGreaterThan(0);
        for (const point of path) {
          expect(isFinite(point.x)).toBe(true);
          expect(isFinite(point.y)).toBe(true);
          expect(isFinite(point.angle)).toBe(true);
        }
      });

      it(`should generate valid visual for ${direction}`, () => {
        const visual = getTemplateVisual(direction, 2, 'white');

        expect(['straight', 'arc']).toContain(visual.type);
        expect(typeof visual.color).toBe('number');
      });
    }
  });
});
