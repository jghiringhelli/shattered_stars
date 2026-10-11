/**
 * Survival roguelite — neutral text events (any faction). Pure data.
 */

import type { SurvivalEvent } from "./eventTypes";

export const NEUTRAL_EVENTS: readonly SurvivalEvent[] = [
  {
    id: "distress_beacon",
    title: "Distress Beacon",
    icon: "📡",
    text: "A freighter's beacon screams on every channel. Raiders are closing on it.",
    choices: [
      {
        label: "Intervene",
        description: "Fight the raiders; the grateful crew pays 30 salvage",
        outcomes: [
          { kind: "combat", elite: false },
          { kind: "salvage", amount: 30 },
        ],
      },
      {
        label: "Strip the wreck later",
        description: "Wait it out: 50% +40 salvage, 50% nothing left",
        gamble: {
          chance: 0.5,
          success: [{ kind: "salvage", amount: 40 }],
          failure: [],
        },
      },
      { label: "Fly on", description: "Nothing happens" },
    ],
  },
  {
    id: "derelict_hulk",
    title: "Derelict Hulk",
    icon: "🛰",
    text: "A gutted cruiser drifts in the dark, its reactor still faintly warm.",
    choices: [
      {
        label: "Salvage the hull",
        description: "70%: +45 salvage. 30%: booby trap, -15% hull",
        gamble: {
          chance: 0.7,
          success: [{ kind: "salvage", amount: 45 }],
          failure: [{ kind: "hull", fraction: -0.15 }],
        },
      },
      {
        label: "Rip out the reactor core",
        description: "Gain a relic, take 20% hull damage",
        outcomes: [{ kind: "relic" }, { kind: "hull", fraction: -0.2 }],
      },
      { label: "Leave it", description: "Nothing happens" },
    ],
  },
  {
    id: "mercenary_wing",
    title: "Mercenary Wing",
    icon: "🤝",
    text: "A freelance pilot offers her blaster for hire — or for barter.",
    choices: [
      {
        label: "Hire her",
        description: "Pay 55 salvage: +1 escort",
        cost: 55,
        outcomes: [{ kind: "escort" }],
      },
      {
        label: "Sell her an escort's ship",
        description: "Lose an escort, gain 80 salvage",
        requires: { minEscorts: 1 },
        outcomes: [{ kind: "loseEscort" }, { kind: "salvage", amount: 80 }],
      },
      { label: "Decline", description: "Nothing happens" },
    ],
  },
  {
    id: "ion_storm",
    title: "Ion Storm",
    icon: "🌩",
    text: "A violet ion storm blocks the lane. Sensors read something metallic in its eye.",
    choices: [
      {
        label: "Fly through the eye",
        description: "50%: a relic. 50%: -20% hull",
        gamble: {
          chance: 0.5,
          success: [{ kind: "relic" }],
          failure: [{ kind: "hull", fraction: -0.2 }],
        },
      },
      {
        label: "Go around",
        description: "Burn fuel: -10 salvage, +1 reroll",
        outcomes: [
          { kind: "salvage", amount: -10 },
          { kind: "rerolls", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "black_box",
    title: "Black Box",
    icon: "⬛",
    text: "A flight recorder tumbles past, still broadcasting a dead pilot's last minutes.",
    choices: [
      {
        label: "Decode it",
        description: "+6 Star Charts (kept after the run)",
        outcomes: [{ kind: "meta", amount: 6 }],
      },
      {
        label: "Sell the data",
        description: "+35 salvage",
        outcomes: [{ kind: "salvage", amount: 35 }],
      },
    ],
  },
  {
    id: "void_gambler",
    title: "Void Gambler",
    icon: "🎰",
    text: '"Double or nothing, pilot?" A corsair dealer grins from a gutted shuttle.',
    choices: [
      {
        label: "Bet 30 salvage",
        description: "45%: win 90. 55%: lose the stake",
        cost: 30,
        gamble: {
          chance: 0.45,
          success: [{ kind: "salvage", amount: 90 }],
          failure: [],
        },
      },
      {
        label: "Bet a reroll",
        description: "50%: a relic. 50%: nothing",
        requires: { minRerolls: 1 },
        outcomes: [{ kind: "rerolls", amount: -1 }],
        gamble: { chance: 0.5, success: [{ kind: "relic" }], failure: [] },
      },
      { label: "Walk away", description: "Nothing happens" },
    ],
  },
  {
    id: "abandoned_drydock",
    title: "Abandoned Drydock",
    icon: "🏗",
    text: "A mothballed drydock still has power in one bay.",
    choices: [
      {
        label: "Patch the hulls",
        description: "Repair 25% hull",
        outcomes: [{ kind: "hull", fraction: 0.25 }],
      },
      {
        label: "Refit the flagship",
        description: "Upgrade the flagship one level, -10% hull",
        outcomes: [{ kind: "upgrade" }, { kind: "hull", fraction: -0.1 }],
      },
    ],
  },
  {
    id: "nexus_whisper",
    title: "Nexus Whisper",
    icon: "🌌",
    text: "Something in the static speaks your call sign. It offers knowledge.",
    choices: [
      {
        label: "Listen",
        description: "Draft a free power, -15% hull",
        outcomes: [{ kind: "power" }, { kind: "hull", fraction: -0.15 }],
      },
      {
        label: "Jam the signal",
        description: "+2 rerolls",
        outcomes: [{ kind: "rerolls", amount: 2 }],
      },
      {
        label: "Answer with a targeting ping",
        description: "[mark relic] A hidden cache: +50 salvage",
        requires: { relicTag: "mark" },
        outcomes: [{ kind: "salvage", amount: 50 }],
      },
    ],
  },
];
