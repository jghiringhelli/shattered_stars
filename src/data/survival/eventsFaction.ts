/**
 * Survival roguelite — faction-flavoured text events. Each has a "blue"
 * option open only to pilots of that faction (FTL-style). Pure data.
 */

import type { SurvivalEvent } from "./eventTypes";

export const FACTION_EVENTS: readonly SurvivalEvent[] = [
  {
    id: "corsair_toll",
    title: "Corsair Toll Gate",
    icon: "🏴‍☠️",
    faction: "void_corsairs",
    text: 'A ring of corsair gunships blocks the jump lane. "Toll\'s thirty, friend."',
    choices: [
      { label: "Pay the toll", description: "-30 salvage", cost: 30 },
      {
        label: "Refuse",
        description: "Fight an elite corsair wing (+40 salvage if you win)",
        outcomes: [
          { kind: "combat", elite: true },
          { kind: "salvage", amount: 40 },
        ],
      },
      {
        label: "Flash old colours",
        description:
          "[Void Corsairs] They wave you through with a tip: +25 salvage",
        requires: { faction: "void_corsairs" },
        outcomes: [{ kind: "salvage", amount: 25 }],
      },
    ],
  },
  {
    id: "synthetic_cache",
    title: "Dormant Synthetic Cache",
    icon: "🧊",
    faction: "synthetic_collective",
    text: "A Collective data-cache pulses quietly, waiting for a handshake.",
    choices: [
      {
        label: "Interface",
        description: "50%: draft a free power. 50%: feedback, -10% hull",
        gamble: {
          chance: 0.5,
          success: [{ kind: "power" }],
          failure: [{ kind: "hull", fraction: -0.1 }],
        },
      },
      {
        label: "Merge protocols",
        description: "[Synthetic Collective] Upgrade the flagship one level",
        requires: { faction: "synthetic_collective" },
        outcomes: [{ kind: "upgrade" }],
      },
      { label: "Leave it", description: "Nothing happens" },
    ],
  },
  {
    id: "ascendant_shrine",
    title: "Ascendant Shrine",
    icon: "⛩",
    faction: "ascendant_empire",
    text: "A drifting shrine hums at 432 hertz. Offerings glitter at its altar.",
    choices: [
      {
        label: "Meditate",
        description: "Repair 30% hull",
        outcomes: [{ kind: "hull", fraction: 0.3 }],
      },
      {
        label: "Loot the offerings",
        description: "+60 salvage, but its guardians attack",
        outcomes: [
          { kind: "combat", elite: false },
          { kind: "salvage", amount: 60 },
        ],
      },
      {
        label: "Receive the blessing",
        description: "[Ascendant Empire] An uncommon-or-better relic",
        requires: { faction: "ascendant_empire" },
        outcomes: [{ kind: "relic", minRarity: "uncommon" }],
      },
    ],
  },
  {
    id: "hegemony_checkpoint",
    title: "Hegemony Checkpoint",
    icon: "🛂",
    faction: "terran_hegemony",
    text: "A Hegemony customs frigate demands you heave to for inspection.",
    choices: [
      {
        label: "Submit",
        description: "Pay a 20 salvage fee; their techs repair 15% hull",
        cost: 20,
        outcomes: [{ kind: "hull", fraction: 0.15 }],
      },
      {
        label: "Run the blockade",
        description: "60%: +2 rerolls. 40%: -20% hull",
        gamble: {
          chance: 0.6,
          success: [{ kind: "rerolls", amount: 2 }],
          failure: [{ kind: "hull", fraction: -0.2 }],
        },
      },
      {
        label: "Transmit officer codes",
        description: "[Terran Hegemony] A free flagship refit (+1 upgrade)",
        requires: { faction: "terran_hegemony" },
        outcomes: [{ kind: "upgrade" }],
      },
    ],
  },
  {
    id: "confed_rally",
    title: "Confederation Rally Point",
    icon: "🚩",
    faction: "free_confederation",
    text: "Volunteers gather at a battered Confederation relay, looking for a leader.",
    choices: [
      {
        label: "Trade for parts",
        description: "Pay 40 salvage for a relic",
        cost: 40,
        outcomes: [{ kind: "relic" }],
      },
      {
        label: "Muster volunteers",
        description: "[Free Confederation] +1 escort and 10% repair",
        requires: { faction: "free_confederation" },
        outcomes: [{ kind: "escort" }, { kind: "hull", fraction: 0.1 }],
      },
      { label: "Move on", description: "Nothing happens" },
    ],
  },
  {
    id: "refugee_convoy",
    title: "Refugee Convoy",
    icon: "🚐",
    faction: "free_confederation",
    text: "A convoy of civilian haulers begs for an escort through raider space.",
    choices: [
      {
        label: "Escort them",
        description: "Fight the ambush; they gift you a relic",
        outcomes: [{ kind: "combat", elite: false }, { kind: "relic" }],
      },
      {
        label: "Share supplies",
        description: "-25 salvage, +8 Star Charts",
        cost: 25,
        outcomes: [{ kind: "meta", amount: 8 }],
      },
      { label: "Leave them", description: "Nothing happens" },
    ],
  },
];
