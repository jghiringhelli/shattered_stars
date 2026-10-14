/**
 * roleTerms — tooltip terms for ship roles (Light fighter … Capital) and
 * for the play styles role hints are written in. Styles reuse the label and
 * tagline of the play-style catalog so the two never disagree. Pure data.
 */

import type { ShipRole } from "../../core/types";
import { ROLE_BLURBS } from "../roleHints/roleSections";
import {
  PLAYSTYLES,
  ROLE_TITLES,
  type Playstyle,
} from "../roleHints/playstyleCatalog";
import { term, type TermEntry } from "./termTypes";

/** Term id of a ship role. */
export type RoleTermId = `role.${ShipRole}`;
/** Term id of a play style. */
export type StyleTermId = `style.${Playstyle}`;

const ROLE_DETAIL: Readonly<
  Record<ShipRole, { example: string; howItPlays: string }>
> = {
  light_fighter: {
    example: "Four light fighters out-turn and out-number one expensive ace.",
    howItPlays:
      "Fly them as a pack and focus the marked target; alone they are fragile.",
  },
  heavy_fighter: {
    example: "A heavy fighter holds the front while interceptors flank.",
    howItPlays: "The safest first pick: good dice, decent hull, few weaknesses.",
  },
  interceptor: {
    example: "An interceptor circles behind a bomber and shoots its rear arc.",
    howItPlays:
      "Use speed and barrel rolls to avoid arcs; do not trade shots head-on.",
  },
  bomber: {
    example: "A bomber locks a gunship and sends a torpedo from range 2.",
    howItPlays:
      "Keep it behind your fighters, lock, fire, reload — and never fly alone.",
  },
  gunship: {
    example: "A gunship's turret keeps shooting while it flies away from a pack.",
    howItPlays: "Absorb damage and project power; its weakness is turning.",
  },
  support: {
    example: "A support ship's aura keeps every ally within range shielded.",
    howItPlays: "Stay inside the wing; its value is what the others do next to it.",
  },
  capital: {
    example: "A cruiser anchors the Epic format and wins by attrition.",
    howItPlays: "Escort it and protect it from interceptor swarms.",
  },
};

export const ROLE_TERMS: Readonly<Record<RoleTermId, TermEntry>> =
  Object.fromEntries(
    (Object.keys(ROLE_DETAIL) as ShipRole[]).map((role) => [
      `role.${role}`,
      term(
        ROLE_TITLES[role],
        ROLE_BLURBS[role],
        ROLE_DETAIL[role].example,
        ROLE_DETAIL[role].howItPlays,
        `role_${role}`,
      ),
    ]),
  ) as Record<RoleTermId, TermEntry>;

const STYLE_EXAMPLES: Readonly<Record<Playstyle, string>> = {
  striker: "A heavy fighter with a cannon trades blows and wins the exchange.",
  flanker: "An interceptor loops behind a gunship and shoots its rear arc.",
  marksman: "A calm pilot lines up a long shot and never wastes a cycle.",
  brawler: "A heavy fighter closes to range 1 and shreds a wounded ace.",
  hunter: "A hunter finishes the fighter your striker just stripped of shields.",
  interceptor: "A fast pilot chases a bomber and rolls out of its escort's arc.",
  tank: "A shielded gunship soaks a volley that would kill a fighter.",
  wingman: "Two wingmen fly close so each protects the other's tail.",
  support: "A support ship's aura keeps the whole wing fighting.",
  bomber: "A bomber fires its torpedo at range 3 then escorts take over.",
  gunner: "A turret kills the pursuer you cannot turn to face.",
  suppressor: "A stress cannon locks a target out of its red maneuvers.",
  ghost: "A cloaked raider appears behind the line and kills the bombers.",
  salvager: "Every kill pays shields back, so it lives off the fight.",
  commander: "A named leader's talents buff the whole squad.",
};

export const STYLE_TERMS: Readonly<Record<StyleTermId, TermEntry>> =
  Object.fromEntries(
    (Object.keys(PLAYSTYLES) as Playstyle[]).map((style) => {
      const info = PLAYSTYLES[style];
      return [
        `style.${style}`,
        term(
          info.label,
          `Plays as: ${info.tagline}.`,
          STYLE_EXAMPLES[style],
          `Wants ${info.squadPartner}.`,
        ),
      ];
    }),
  ) as Record<StyleTermId, TermEntry>;
