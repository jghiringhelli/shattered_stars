/**
 * Sortie briefings — shared pre-battle briefing card (Dogfight, Ace Duel,
 * Boss Raid): pure model + stinger + Phaser card.
 */

export * from "./sortieBriefing";
export { playBriefingStinger } from "./briefingStinger";
export {
  SORTIE_BRIEFING_DATA_KEY,
  SortieBriefingCard,
  showSortieBriefing,
  type SortieBriefingOptions,
} from "./SortieBriefingCard";
