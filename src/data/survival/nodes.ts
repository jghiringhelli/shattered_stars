/**
 * Survival roguelite — sector-map node types (pure data). See
 * docs/adr/ADR-0004-survival-roguelite-run-structure.md.
 *
 * Each node type has a distinct icon, colour and legend line so route
 * planning reads at a glance (Slay the Spire-style map legend).
 */

/** Every kind of node a sector map can hold. */
export type NodeType =
  "combat" | "elite" | "event" | "shop" | "repair" | "mystery" | "boss";

/** Node types that open a real-time battle in SurvivalScene. */
export const COMBAT_NODE_TYPES: ReadonlySet<NodeType> = new Set([
  "combat",
  "elite",
  "boss",
]);

/** How one node type is presented on the map. */
export interface NodeTypeInfo {
  readonly icon: string;
  readonly label: string;
  /** Fill colour of the node disc. */
  readonly color: number;
  /** One-line legend / hover preview of what the node offers. */
  readonly preview: string;
}

/** Presentation of every node type (icon + legend line + reward preview). */
export const NODE_INFO: Readonly<Record<NodeType, NodeTypeInfo>> = {
  combat: {
    icon: "⚔",
    label: "Combat",
    color: 0x4a90d9,
    preview: "Hostile patrol. Reward: salvage + power draft",
  },
  elite: {
    icon: "☠",
    label: "Elite",
    color: 0xd94a4a,
    preview: "Elite aces with affixes. Reward: relic + power + salvage",
  },
  event: {
    icon: "!",
    label: "Event",
    color: 0xd9b84a,
    preview: "A distress call or encounter — choices with risk and reward",
  },
  shop: {
    icon: "$",
    label: "Shop",
    color: 0x4ad98a,
    preview: "Spend salvage: repairs, relics, upgrades, escorts, rerolls",
  },
  repair: {
    icon: "✚",
    label: "Repair dock",
    color: 0x4ad9d9,
    preview: "Repair the fleet's hull OR upgrade one ship",
  },
  mystery: {
    icon: "?",
    label: "Unknown",
    color: 0x9a6ad9,
    preview: "Unknown signal: an event, a fight, a trader or a cache",
  },
  boss: {
    icon: "♛",
    label: "Sector boss",
    color: 0xff6a2a,
    preview: "Sector flagship. Reward: rare relic, hangar, mutation",
  },
};

/** Legend order shown on the map. */
export const LEGEND_ORDER: readonly NodeType[] = [
  "combat",
  "elite",
  "event",
  "shop",
  "repair",
  "mystery",
  "boss",
];

/**
 * @param type - A node type.
 * @returns True when entering it starts a battle.
 */
export function isCombatNode(type: NodeType): boolean {
  return COMBAT_NODE_TYPES.has(type);
}
