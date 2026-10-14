/**
 * Creature codex — the bestiary: every creature as an encyclopedia entry
 * with its lore, how it moves, its telegraphed powers, its weak points and
 * plates (and which powers they switch off), its phases, how to fight it and
 * where it appears. Pure.
 */

import { ALL_CREATURES } from "../creatures/creatureCatalog";
import type {
  CreatureDefinition,
  CreatureMovementStyle,
  CreaturePowerSpec,
} from "../creatures/creatureTypes";
import {
  titleCase,
  withSearchText,
  type CodexEntry,
  type CodexParagraph,
} from "./codexTypes";

/** How each movement style reads in the bestiary. */
const MOVEMENT_TEXT: Readonly<Record<CreatureMovementStyle, string>> = {
  serpentine:
    "Undulates toward its prey in a sine wave; its body trails the head.",
  drift: "Drifts on a slow standoff orbit; its tentacles and maw do the work.",
  hive: "A slow spinning core with brood pods orbiting it.",
  blink:
    "Stalks at standoff and phase-shifts — untargetable while it relocates.",
  orbit_lunge: "Circles its prey, then lunges in a straight dash.",
};

/** Where each creature turns up. */
const WHERE_TEXT: Readonly<Record<string, string>> = {
  cinder_wyrm: "Survival — the sector 1 boss.",
  deepmaw: "Survival — the sector 2 boss.",
  choir_hive: "Survival — the sector 3 (final) boss.",
  pruning_herald:
    "Campaign — a Void Tide boss for the Act III–IV finales (Coalition).",
  warden_avatar:
    "Campaign — the Act V finale boss (Heart of the Void / The Answer).",
  tidecell:
    "Campaign — the Void Tide's outriders at the end of every Act III finale; adds the Warden Avatar calls.",
  hulk_gnawer:
    "Survival — adds the Choir-Hive calls; wreck-eater of hazard fields.",
};

function powerLine(power: CreaturePowerSpec): string {
  const wind =
    power.windupCycles === 1 ? "1 cycle" : `${power.windupCycles} cycles`;
  return `${power.name} (${titleCase(power.kind)}, ${wind} wind-up)`;
}

function paragraphsOf(creature: CreatureDefinition): CodexParagraph[] {
  const phases = creature.phases.map((phase) => phase.name).join(" → ");
  const parts = creature.parts
    .map((part) => {
      const disabled = creature.powers
        .filter((power) => power.requiresPart === part.id)
        .map((power) => power.name);
      const kind = part.damageMultiplier >= 1 ? "weak point" : "armoured plate";
      const off =
        disabled.length > 0
          ? ` — destroying it disables ${disabled.join(", ")}`
          : "";
      return `${part.name} (${kind} ×${part.damageMultiplier})${off}`;
    })
    .join("; ");
  const feeds =
    creature.feedHullPoints > 0
      ? " It heals only by feeding on wrecks; any hit breaks the meal."
      : "";
  return [
    { heading: "LORE", text: creature.lore.description },
    { heading: "ORIGIN", text: creature.lore.origin },
    {
      heading: "MOVEMENT",
      text: `${MOVEMENT_TEXT[creature.movement.style]}${feeds}`,
    },
    { heading: "POWERS", text: creature.powers.map(powerLine).join("; ") },
    ...(parts ? [{ heading: "BODY PARTS", text: parts }] : []),
    { heading: "PHASES", text: phases },
    { heading: "TACTICS", text: creature.lore.tactics },
    { heading: "WHERE", text: WHERE_TEXT[creature.id] ?? "Hazard missions." },
  ];
}

/** @returns One codex entry per creature, bosses first. */
export function creatureCodexEntries(): CodexEntry[] {
  return ALL_CREATURES.map((creature) =>
    withSearchText({
      section: "bestiary",
      id: creature.id,
      name: creature.name,
      tag: creature.isBoss ? "BOSS" : "CREATURE",
      faction: null,
      subtitle: creature.lore.epithet,
      paragraphs: paragraphsOf(creature),
    }),
  );
}
