/**
 * Ship Renderer
 *
 * Generates procedural ship graphics with:
 * - Faction-specific silhouettes and color schemes
 * - Ship role variations (fighter, interceptor, bomber, etc.)
 * - Damage states with visual degradation
 * - Engine glow effects
 */

import Phaser from 'phaser';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';

export type ShipRole = 'light_fighter' | 'heavy_fighter' | 'interceptor' | 'bomber' | 'gunship' | 'support';
export type DamageState = 'healthy' | 'damaged' | 'critical';

interface ShipDesign {
  // Body shape points (normalized 0-1, centered at 0.5, 0.5)
  bodyPoints: { x: number; y: number }[];
  // Wing points (optional)
  wingPoints?: { x: number; y: number }[];
  // Cockpit position and size
  cockpit: { x: number; y: number; width: number; height: number };
  // Engine positions (for glow effects)
  engines: { x: number; y: number; size: number }[];
  // Weapon hardpoints (for muzzle flash)
  weapons: { x: number; y: number }[];
}

// Faction-specific ship designs
const FACTION_DESIGNS: Record<FactionId, Record<ShipRole, ShipDesign>> = {
  terran_hegemony: {
    light_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 }, // Nose
        { x: 0.7, y: 0.3 },
        { x: 0.8, y: 0.7 },
        { x: 0.6, y: 1 },
        { x: 0.4, y: 1 },
        { x: 0.2, y: 0.7 },
        { x: 0.3, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.25, width: 0.2, height: 0.15 },
      engines: [{ x: 0.5, y: 0.95, size: 0.12 }],
      weapons: [{ x: 0.3, y: 0.2 }, { x: 0.7, y: 0.2 }],
    },
    heavy_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.75, y: 0.25 },
        { x: 0.85, y: 0.6 },
        { x: 0.75, y: 0.9 },
        { x: 0.25, y: 0.9 },
        { x: 0.15, y: 0.6 },
        { x: 0.25, y: 0.25 },
      ],
      wingPoints: [
        { x: 0.85, y: 0.4 }, { x: 1, y: 0.5 }, { x: 0.9, y: 0.8 }, { x: 0.75, y: 0.7 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.25, height: 0.2 },
      engines: [{ x: 0.35, y: 0.92, size: 0.1 }, { x: 0.65, y: 0.92, size: 0.1 }],
      weapons: [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.3 }],
    },
    interceptor: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.6, y: 0.2 },
        { x: 0.65, y: 0.8 },
        { x: 0.5, y: 1 },
        { x: 0.35, y: 0.8 },
        { x: 0.4, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.3, width: 0.15, height: 0.12 },
      engines: [{ x: 0.5, y: 0.95, size: 0.15 }],
      weapons: [{ x: 0.5, y: 0.1 }],
    },
    bomber: {
      bodyPoints: [
        { x: 0.5, y: 0.1 },
        { x: 0.8, y: 0.3 },
        { x: 0.85, y: 0.7 },
        { x: 0.7, y: 0.95 },
        { x: 0.3, y: 0.95 },
        { x: 0.15, y: 0.7 },
        { x: 0.2, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.25, width: 0.3, height: 0.2 },
      engines: [{ x: 0.35, y: 0.9, size: 0.12 }, { x: 0.65, y: 0.9, size: 0.12 }],
      weapons: [{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, { x: 0.5, y: 0.6 }],
    },
    gunship: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.8, y: 0.2 },
        { x: 0.9, y: 0.5 },
        { x: 0.85, y: 0.85 },
        { x: 0.15, y: 0.85 },
        { x: 0.1, y: 0.5 },
        { x: 0.2, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.3, height: 0.15 },
      engines: [{ x: 0.3, y: 0.88, size: 0.1 }, { x: 0.5, y: 0.88, size: 0.1 }, { x: 0.7, y: 0.88, size: 0.1 }],
      weapons: [{ x: 0.15, y: 0.4 }, { x: 0.85, y: 0.4 }, { x: 0.5, y: 0.15 }],
    },
    support: {
      bodyPoints: [
        { x: 0.5, y: 0.1 },
        { x: 0.7, y: 0.25 },
        { x: 0.75, y: 0.75 },
        { x: 0.5, y: 0.9 },
        { x: 0.25, y: 0.75 },
        { x: 0.3, y: 0.25 },
      ],
      cockpit: { x: 0.5, y: 0.3, width: 0.25, height: 0.2 },
      engines: [{ x: 0.5, y: 0.85, size: 0.1 }],
      weapons: [{ x: 0.5, y: 0.15 }],
    },
  },
  free_confederation: {
    light_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.65, y: 0.15 },
        { x: 0.7, y: 0.5 },
        { x: 0.6, y: 0.85 },
        { x: 0.4, y: 0.85 },
        { x: 0.3, y: 0.5 },
        { x: 0.35, y: 0.15 },
      ],
      wingPoints: [
        { x: 0.7, y: 0.3 }, { x: 0.95, y: 0.4 }, { x: 0.85, y: 0.7 }, { x: 0.65, y: 0.6 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.18, height: 0.15 },
      engines: [{ x: 0.5, y: 0.9, size: 0.12 }],
      weapons: [{ x: 0.4, y: 0.1 }, { x: 0.6, y: 0.1 }],
    },
    heavy_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.7, y: 0.2 },
        { x: 0.75, y: 0.6 },
        { x: 0.65, y: 0.9 },
        { x: 0.35, y: 0.9 },
        { x: 0.25, y: 0.6 },
        { x: 0.3, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.25, width: 0.22, height: 0.18 },
      engines: [{ x: 0.4, y: 0.92, size: 0.1 }, { x: 0.6, y: 0.92, size: 0.1 }],
      weapons: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }],
    },
    interceptor: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.55, y: 0.1 },
        { x: 0.6, y: 0.7 },
        { x: 0.5, y: 0.95 },
        { x: 0.4, y: 0.7 },
        { x: 0.45, y: 0.1 },
      ],
      wingPoints: [
        { x: 0.6, y: 0.4 }, { x: 1, y: 0.5 }, { x: 0.8, y: 0.75 }, { x: 0.55, y: 0.6 },
      ],
      cockpit: { x: 0.5, y: 0.25, width: 0.12, height: 0.1 },
      engines: [{ x: 0.5, y: 0.9, size: 0.18 }],
      weapons: [{ x: 0.5, y: 0.05 }],
    },
    bomber: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.75, y: 0.2 },
        { x: 0.8, y: 0.6 },
        { x: 0.65, y: 0.95 },
        { x: 0.35, y: 0.95 },
        { x: 0.2, y: 0.6 },
        { x: 0.25, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.28, height: 0.18 },
      engines: [{ x: 0.4, y: 0.92, size: 0.1 }, { x: 0.6, y: 0.92, size: 0.1 }],
      weapons: [{ x: 0.35, y: 0.45 }, { x: 0.65, y: 0.45 }],
    },
    gunship: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.75, y: 0.15 },
        { x: 0.85, y: 0.45 },
        { x: 0.8, y: 0.85 },
        { x: 0.2, y: 0.85 },
        { x: 0.15, y: 0.45 },
        { x: 0.25, y: 0.15 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.25, height: 0.15 },
      engines: [{ x: 0.35, y: 0.88, size: 0.1 }, { x: 0.65, y: 0.88, size: 0.1 }],
      weapons: [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.1 }],
    },
    support: {
      bodyPoints: [
        { x: 0.5, y: 0.1 },
        { x: 0.65, y: 0.2 },
        { x: 0.7, y: 0.7 },
        { x: 0.5, y: 0.9 },
        { x: 0.3, y: 0.7 },
        { x: 0.35, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.3, width: 0.2, height: 0.18 },
      engines: [{ x: 0.5, y: 0.85, size: 0.12 }],
      weapons: [{ x: 0.5, y: 0.15 }],
    },
  },
  synthetic_collective: {
    light_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.7, y: 0.3 },
        { x: 0.7, y: 0.7 },
        { x: 0.5, y: 0.95 },
        { x: 0.3, y: 0.7 },
        { x: 0.3, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.4, width: 0.2, height: 0.2 },
      engines: [{ x: 0.5, y: 0.9, size: 0.1 }],
      weapons: [{ x: 0.35, y: 0.2 }, { x: 0.65, y: 0.2 }],
    },
    heavy_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.8, y: 0.25 },
        { x: 0.8, y: 0.75 },
        { x: 0.5, y: 1 },
        { x: 0.2, y: 0.75 },
        { x: 0.2, y: 0.25 },
      ],
      cockpit: { x: 0.5, y: 0.35, width: 0.25, height: 0.25 },
      engines: [{ x: 0.35, y: 0.92, size: 0.1 }, { x: 0.65, y: 0.92, size: 0.1 }],
      weapons: [{ x: 0.25, y: 0.15 }, { x: 0.75, y: 0.15 }],
    },
    interceptor: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.6, y: 0.2 },
        { x: 0.6, y: 0.8 },
        { x: 0.5, y: 1 },
        { x: 0.4, y: 0.8 },
        { x: 0.4, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.35, width: 0.12, height: 0.15 },
      engines: [{ x: 0.5, y: 0.95, size: 0.15 }],
      weapons: [{ x: 0.5, y: 0.1 }],
    },
    bomber: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.85, y: 0.3 },
        { x: 0.85, y: 0.7 },
        { x: 0.5, y: 0.95 },
        { x: 0.15, y: 0.7 },
        { x: 0.15, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.35, width: 0.3, height: 0.25 },
      engines: [{ x: 0.3, y: 0.85, size: 0.1 }, { x: 0.5, y: 0.9, size: 0.1 }, { x: 0.7, y: 0.85, size: 0.1 }],
      weapons: [{ x: 0.3, y: 0.25 }, { x: 0.7, y: 0.25 }, { x: 0.5, y: 0.5 }],
    },
    gunship: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.9, y: 0.35 },
        { x: 0.9, y: 0.65 },
        { x: 0.5, y: 0.95 },
        { x: 0.1, y: 0.65 },
        { x: 0.1, y: 0.35 },
      ],
      cockpit: { x: 0.5, y: 0.4, width: 0.35, height: 0.2 },
      engines: [{ x: 0.3, y: 0.85, size: 0.12 }, { x: 0.5, y: 0.9, size: 0.12 }, { x: 0.7, y: 0.85, size: 0.12 }],
      weapons: [{ x: 0.15, y: 0.4 }, { x: 0.85, y: 0.4 }, { x: 0.5, y: 0.15 }],
    },
    support: {
      bodyPoints: [
        { x: 0.5, y: 0.1 },
        { x: 0.75, y: 0.35 },
        { x: 0.75, y: 0.65 },
        { x: 0.5, y: 0.9 },
        { x: 0.25, y: 0.65 },
        { x: 0.25, y: 0.35 },
      ],
      cockpit: { x: 0.5, y: 0.4, width: 0.25, height: 0.2 },
      engines: [{ x: 0.5, y: 0.85, size: 0.1 }],
      weapons: [{ x: 0.5, y: 0.2 }],
    },
  },
  void_corsairs: {
    light_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.75, y: 0.2 },
        { x: 0.7, y: 0.6 },
        { x: 0.55, y: 0.95 },
        { x: 0.45, y: 0.95 },
        { x: 0.3, y: 0.6 },
        { x: 0.25, y: 0.2 },
      ],
      wingPoints: [
        { x: 0.75, y: 0.25 }, { x: 1, y: 0.15 }, { x: 0.9, y: 0.5 }, { x: 0.7, y: 0.45 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.2, height: 0.12 },
      engines: [{ x: 0.5, y: 0.9, size: 0.12 }],
      weapons: [{ x: 0.3, y: 0.15 }, { x: 0.7, y: 0.15 }],
    },
    heavy_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.8, y: 0.15 },
        { x: 0.75, y: 0.55 },
        { x: 0.6, y: 0.9 },
        { x: 0.4, y: 0.9 },
        { x: 0.25, y: 0.55 },
        { x: 0.2, y: 0.15 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.22, height: 0.15 },
      engines: [{ x: 0.4, y: 0.88, size: 0.12 }, { x: 0.6, y: 0.88, size: 0.12 }],
      weapons: [{ x: 0.25, y: 0.2 }, { x: 0.75, y: 0.2 }],
    },
    interceptor: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.6, y: 0.15 },
        { x: 0.55, y: 0.8 },
        { x: 0.5, y: 0.95 },
        { x: 0.45, y: 0.8 },
        { x: 0.4, y: 0.15 },
      ],
      wingPoints: [
        { x: 0.6, y: 0.3 }, { x: 0.95, y: 0.1 }, { x: 0.85, y: 0.5 }, { x: 0.55, y: 0.5 },
      ],
      cockpit: { x: 0.5, y: 0.25, width: 0.1, height: 0.1 },
      engines: [{ x: 0.5, y: 0.9, size: 0.18 }],
      weapons: [{ x: 0.5, y: 0.08 }],
    },
    bomber: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.85, y: 0.25 },
        { x: 0.8, y: 0.65 },
        { x: 0.6, y: 0.95 },
        { x: 0.4, y: 0.95 },
        { x: 0.2, y: 0.65 },
        { x: 0.15, y: 0.25 },
      ],
      cockpit: { x: 0.5, y: 0.25, width: 0.3, height: 0.18 },
      engines: [{ x: 0.45, y: 0.9, size: 0.12 }, { x: 0.55, y: 0.9, size: 0.12 }],
      weapons: [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }, { x: 0.5, y: 0.55 }],
    },
    gunship: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.85, y: 0.2 },
        { x: 0.9, y: 0.5 },
        { x: 0.75, y: 0.85 },
        { x: 0.25, y: 0.85 },
        { x: 0.1, y: 0.5 },
        { x: 0.15, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.2, width: 0.28, height: 0.15 },
      engines: [{ x: 0.35, y: 0.85, size: 0.12 }, { x: 0.65, y: 0.85, size: 0.12 }],
      weapons: [{ x: 0.15, y: 0.35 }, { x: 0.85, y: 0.35 }, { x: 0.5, y: 0.1 }],
    },
    support: {
      bodyPoints: [
        { x: 0.5, y: 0.1 },
        { x: 0.7, y: 0.2 },
        { x: 0.7, y: 0.7 },
        { x: 0.5, y: 0.9 },
        { x: 0.3, y: 0.7 },
        { x: 0.3, y: 0.2 },
      ],
      cockpit: { x: 0.5, y: 0.3, width: 0.2, height: 0.18 },
      engines: [{ x: 0.5, y: 0.85, size: 0.12 }],
      weapons: [{ x: 0.5, y: 0.15 }],
    },
  },
  ascendant_empire: {
    light_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.7, y: 0.35 },
        { x: 0.65, y: 0.7 },
        { x: 0.5, y: 0.85 },
        { x: 0.35, y: 0.7 },
        { x: 0.3, y: 0.35 },
      ],
      cockpit: { x: 0.5, y: 0.35, width: 0.2, height: 0.18 },
      engines: [{ x: 0.5, y: 0.82, size: 0.12 }],
      weapons: [{ x: 0.35, y: 0.15 }, { x: 0.65, y: 0.15 }],
    },
    heavy_fighter: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.75, y: 0.3 },
        { x: 0.7, y: 0.7 },
        { x: 0.5, y: 0.9 },
        { x: 0.3, y: 0.7 },
        { x: 0.25, y: 0.3 },
      ],
      wingPoints: [
        { x: 0.75, y: 0.35 }, { x: 1, y: 0.4 }, { x: 0.9, y: 0.65 }, { x: 0.7, y: 0.55 },
      ],
      cockpit: { x: 0.5, y: 0.3, width: 0.25, height: 0.2 },
      engines: [{ x: 0.4, y: 0.85, size: 0.1 }, { x: 0.6, y: 0.85, size: 0.1 }],
      weapons: [{ x: 0.3, y: 0.2 }, { x: 0.7, y: 0.2 }],
    },
    interceptor: {
      bodyPoints: [
        { x: 0.5, y: 0 },
        { x: 0.6, y: 0.3 },
        { x: 0.55, y: 0.75 },
        { x: 0.5, y: 0.9 },
        { x: 0.45, y: 0.75 },
        { x: 0.4, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.35, width: 0.12, height: 0.12 },
      engines: [{ x: 0.5, y: 0.85, size: 0.15 }],
      weapons: [{ x: 0.5, y: 0.1 }],
    },
    bomber: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.8, y: 0.25 },
        { x: 0.75, y: 0.65 },
        { x: 0.5, y: 0.9 },
        { x: 0.25, y: 0.65 },
        { x: 0.2, y: 0.25 },
      ],
      cockpit: { x: 0.5, y: 0.3, width: 0.3, height: 0.2 },
      engines: [{ x: 0.35, y: 0.85, size: 0.1 }, { x: 0.65, y: 0.85, size: 0.1 }],
      weapons: [{ x: 0.35, y: 0.4 }, { x: 0.65, y: 0.4 }],
    },
    gunship: {
      bodyPoints: [
        { x: 0.5, y: 0.05 },
        { x: 0.85, y: 0.3 },
        { x: 0.8, y: 0.7 },
        { x: 0.5, y: 0.9 },
        { x: 0.2, y: 0.7 },
        { x: 0.15, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.35, width: 0.3, height: 0.2 },
      engines: [{ x: 0.35, y: 0.85, size: 0.1 }, { x: 0.5, y: 0.88, size: 0.12 }, { x: 0.65, y: 0.85, size: 0.1 }],
      weapons: [{ x: 0.2, y: 0.35 }, { x: 0.8, y: 0.35 }, { x: 0.5, y: 0.15 }],
    },
    support: {
      bodyPoints: [
        { x: 0.5, y: 0.1 },
        { x: 0.7, y: 0.3 },
        { x: 0.65, y: 0.7 },
        { x: 0.5, y: 0.85 },
        { x: 0.35, y: 0.7 },
        { x: 0.3, y: 0.3 },
      ],
      cockpit: { x: 0.5, y: 0.4, width: 0.2, height: 0.18 },
      engines: [{ x: 0.5, y: 0.8, size: 0.12 }],
      weapons: [{ x: 0.5, y: 0.18 }],
    },
  },
};

// Faction-specific accent colors for cockpits and details
const FACTION_ACCENTS: Record<FactionId, number> = {
  terran_hegemony: 0x88ccff,
  free_confederation: 0x44ffaa,
  synthetic_collective: 0xff4444,
  void_corsairs: 0xffaa00,
  ascendant_empire: 0xaa44ff,
};

// Faction-specific engine colors
const FACTION_ENGINE_COLORS: Record<FactionId, number> = {
  terran_hegemony: 0x00aaff,
  free_confederation: 0x44ff88,
  synthetic_collective: 0xff2200,
  void_corsairs: 0xff8800,
  ascendant_empire: 0x8844ff,
};

export class ShipRenderer {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Generate all ship textures for a faction
   */
  generateFactionTextures(faction: FactionId, size: number = 40): void {
    const roles: ShipRole[] = ['light_fighter', 'heavy_fighter', 'interceptor', 'bomber', 'gunship', 'support'];
    const states: DamageState[] = ['healthy', 'damaged', 'critical'];

    for (const role of roles) {
      for (const state of states) {
        const key = this.getTextureKey(faction, role, state);
        this.generateShipTexture(faction, role, state, size, key);
      }
    }
  }

  /**
   * Get texture key for a ship configuration
   */
  getTextureKey(faction: FactionId, role: ShipRole, state: DamageState = 'healthy'): string {
    return `ship_${faction}_${role}_${state}`;
  }

  /**
   * Generate a single ship texture
   */
  generateShipTexture(
    faction: FactionId,
    role: ShipRole,
    damageState: DamageState,
    size: number,
    key: string
  ): void {
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });
    const design = FACTION_DESIGNS[faction][role];
    const baseColor = FACTION_COLORS[faction];
    const accentColor = FACTION_ACCENTS[faction];
    const engineColor = FACTION_ENGINE_COLORS[faction];

    // Apply damage color modifications
    const colorMod = this.getDamageColorMod(damageState);
    const bodyColor = this.modifyColor(baseColor, colorMod);

    // Draw the ship
    this.drawShipBody(graphics, design, bodyColor, size);

    if (design.wingPoints) {
      this.drawWings(graphics, design.wingPoints, bodyColor, size);
    }

    this.drawCockpit(graphics, design.cockpit, accentColor, size);
    this.drawEngines(graphics, design.engines, engineColor, size);

    // Add damage effects
    if (damageState !== 'healthy') {
      this.drawDamageEffects(graphics, design, damageState, size);
    }

    // Add outline
    this.drawOutline(graphics, design, size);

    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private drawShipBody(
    graphics: Phaser.GameObjects.Graphics,
    design: ShipDesign,
    color: number,
    size: number
  ): void {
    graphics.fillStyle(color, 1);
    graphics.beginPath();

    const points = design.bodyPoints;
    graphics.moveTo(points[0]!.x * size, points[0]!.y * size);

    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i]!.x * size, points[i]!.y * size);
    }

    graphics.closePath();
    graphics.fillPath();

    // Add shading
    graphics.fillStyle(0xffffff, 0.15);
    graphics.beginPath();
    graphics.moveTo(points[0]!.x * size, points[0]!.y * size);

    for (let i = 1; i < Math.ceil(points.length / 2); i++) {
      graphics.lineTo(points[i]!.x * size, points[i]!.y * size);
    }
    graphics.lineTo(0.5 * size, 0.5 * size);
    graphics.closePath();
    graphics.fillPath();
  }

  private drawWings(
    graphics: Phaser.GameObjects.Graphics,
    wingPoints: { x: number; y: number }[],
    color: number,
    size: number
  ): void {
    // Draw right wing
    graphics.fillStyle(this.darkenColor(color, 0.2), 1);
    graphics.beginPath();
    graphics.moveTo(wingPoints[0]!.x * size, wingPoints[0]!.y * size);
    for (let i = 1; i < wingPoints.length; i++) {
      graphics.lineTo(wingPoints[i]!.x * size, wingPoints[i]!.y * size);
    }
    graphics.closePath();
    graphics.fillPath();

    // Draw left wing (mirrored)
    graphics.beginPath();
    graphics.moveTo((1 - wingPoints[0]!.x) * size, wingPoints[0]!.y * size);
    for (let i = 1; i < wingPoints.length; i++) {
      graphics.lineTo((1 - wingPoints[i]!.x) * size, wingPoints[i]!.y * size);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  private drawCockpit(
    graphics: Phaser.GameObjects.Graphics,
    cockpit: { x: number; y: number; width: number; height: number },
    color: number,
    size: number
  ): void {
    const x = (cockpit.x - cockpit.width / 2) * size;
    const y = (cockpit.y - cockpit.height / 2) * size;
    const w = cockpit.width * size;
    const h = cockpit.height * size;

    // Cockpit glow
    graphics.fillStyle(color, 0.3);
    graphics.fillEllipse(cockpit.x * size, cockpit.y * size, w * 1.3, h * 1.3);

    // Cockpit
    graphics.fillStyle(color, 0.8);
    graphics.fillEllipse(cockpit.x * size, cockpit.y * size, w, h);

    // Cockpit highlight
    graphics.fillStyle(0xffffff, 0.4);
    graphics.fillEllipse(cockpit.x * size, (cockpit.y - cockpit.height * 0.15) * size, w * 0.5, h * 0.3);
  }

  private drawEngines(
    graphics: Phaser.GameObjects.Graphics,
    engines: { x: number; y: number; size: number }[],
    color: number,
    shipSize: number
  ): void {
    for (const engine of engines) {
      const x = engine.x * shipSize;
      const y = engine.y * shipSize;
      const r = engine.size * shipSize;

      // Outer glow
      graphics.fillStyle(color, 0.2);
      graphics.fillCircle(x, y, r * 1.8);

      // Middle glow
      graphics.fillStyle(color, 0.5);
      graphics.fillCircle(x, y, r * 1.2);

      // Core
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillCircle(x, y, r * 0.6);
    }
  }

  private drawOutline(
    graphics: Phaser.GameObjects.Graphics,
    design: ShipDesign,
    size: number
  ): void {
    graphics.lineStyle(1, 0xffffff, 0.3);
    graphics.beginPath();

    const points = design.bodyPoints;
    graphics.moveTo(points[0]!.x * size, points[0]!.y * size);

    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i]!.x * size, points[i]!.y * size);
    }

    graphics.closePath();
    graphics.strokePath();
  }

  private drawDamageEffects(
    graphics: Phaser.GameObjects.Graphics,
    design: ShipDesign,
    state: DamageState,
    size: number
  ): void {
    const numScars = state === 'critical' ? 4 : 2;

    for (let i = 0; i < numScars; i++) {
      // Random position on ship body
      const x = (0.25 + Math.random() * 0.5) * size;
      const y = (0.2 + Math.random() * 0.6) * size;

      // Damage scar
      graphics.fillStyle(0x222222, 0.8);
      graphics.fillCircle(x, y, 2 + Math.random() * 3);

      // Smoke/fire for critical
      if (state === 'critical') {
        graphics.fillStyle(0xff4400, 0.6);
        graphics.fillCircle(x, y - 2, 2);
        graphics.fillStyle(0xffaa00, 0.4);
        graphics.fillCircle(x, y - 4, 1.5);
      }
    }

    // Sparking effect for critical
    if (state === 'critical') {
      graphics.fillStyle(0xffff00, 0.8);
      for (let i = 0; i < 3; i++) {
        const x = (0.3 + Math.random() * 0.4) * size;
        const y = (0.3 + Math.random() * 0.4) * size;
        graphics.fillCircle(x, y, 1);
      }
    }
  }

  private getDamageColorMod(state: DamageState): number {
    switch (state) {
      case 'healthy':
        return 1.0;
      case 'damaged':
        return 0.7;
      case 'critical':
        return 0.5;
    }
  }

  private modifyColor(color: number, mod: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * mod);
    const g = Math.floor(((color >> 8) & 0xff) * mod);
    const b = Math.floor((color & 0xff) * mod);
    return (r << 16) | (g << 8) | b;
  }

  private darkenColor(color: number, amount: number): number {
    return this.modifyColor(color, 1 - amount);
  }

  /**
   * Create a ship sprite container with proper graphics
   */
  createShipSprite(
    x: number,
    y: number,
    faction: FactionId,
    role: ShipRole,
    size: number = 40
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    // Main ship body (will be updated based on damage)
    const shipGraphics = this.scene.add.graphics();
    this.renderShipToGraphics(shipGraphics, faction, role, 'healthy', size);
    container.add(shipGraphics);

    // Store data for later updates
    container.setData('faction', faction);
    container.setData('role', role);
    container.setData('size', size);
    container.setData('damageState', 'healthy');
    container.setData('shipGraphics', shipGraphics);

    return container;
  }

  /**
   * Update ship sprite based on health percentage
   */
  updateShipDamageState(container: Phaser.GameObjects.Container, healthPercent: number): void {
    let newState: DamageState;

    if (healthPercent > 0.6) {
      newState = 'healthy';
    } else if (healthPercent > 0.3) {
      newState = 'damaged';
    } else {
      newState = 'critical';
    }

    const currentState = container.getData('damageState') as DamageState;
    if (currentState === newState) return;

    const faction = container.getData('faction') as FactionId;
    const role = container.getData('role') as ShipRole;
    const size = container.getData('size') as number;
    const shipGraphics = container.getData('shipGraphics') as Phaser.GameObjects.Graphics;

    shipGraphics.clear();
    this.renderShipToGraphics(shipGraphics, faction, role, newState, size);
    container.setData('damageState', newState);
  }

  /**
   * Render ship directly to graphics object (for dynamic updates)
   */
  private renderShipToGraphics(
    graphics: Phaser.GameObjects.Graphics,
    faction: FactionId,
    role: ShipRole,
    damageState: DamageState,
    size: number
  ): void {
    const design = FACTION_DESIGNS[faction][role];
    const baseColor = FACTION_COLORS[faction];
    const accentColor = FACTION_ACCENTS[faction];
    const engineColor = FACTION_ENGINE_COLORS[faction];

    const colorMod = this.getDamageColorMod(damageState);
    const bodyColor = this.modifyColor(baseColor, colorMod);

    // Offset to center the ship
    graphics.setPosition(-size / 2, -size / 2);

    this.drawShipBody(graphics, design, bodyColor, size);

    if (design.wingPoints) {
      this.drawWings(graphics, design.wingPoints, bodyColor, size);
    }

    this.drawCockpit(graphics, design.cockpit, accentColor, size);
    this.drawEngines(graphics, design.engines, engineColor, size);

    if (damageState !== 'healthy') {
      this.drawDamageEffects(graphics, design, damageState, size);
    }

    this.drawOutline(graphics, design, size);
  }
}
