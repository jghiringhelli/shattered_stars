/**
 * Confederation lore, Act II — The Long Night (Days 41–120): slots 6–10
 * (docs/lore/campaigns/confederation.md).
 */

import { atTime, beat, onObjective, say, setFlag } from "../designKit";
import {
  COMMAND,
  PHOENIX,
  SANTOS,
  VASQUEZ,
} from "../designs/confederationAct1";
import type { MissionLore } from "../loreTypes";
import { debriefLine, KIRA } from "./confederationLoreShared";

/** Seconds after the relay is hacked before Chen's answer reaches the cell. */
const CHEN_ANSWER_DELAY_SECONDS = 5;

/** Slots 6–10 of the Confederation campaign. */
export const CONFEDERATION_ACT2_LORE: Readonly<Record<string, MissionLore>> = {
  conf_2_1: {
    day: 48,
    location: "Garrison lane",
  },
  conf_2_2: {
    day: 63,
    location: "Gallows Hulk",
    crossover: "X5",
    tagline: "Our people in their cages. Not tonight.",
    briefing:
      "The Gallows Hulk holds captured cell pilots in its cages. Break the pods loose and see them to the rendezvous while the hulk's gun decks and its Bastions hunt them. Lose no pod, and every freed pilot flies with the uprising.",
    objectiveText: {
      defenses: "Destroy the Gallows Hulk's gun decks",
    },
    script: [
      atTime(
        20,
        say(
          PHOENIX,
          "Second breakout on the other side of the hulk. Corsairs! Same idea, same night.",
          "urgent",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "cors_crew_rescued" },
        briefing:
          "The Gallows Hulk holds captured cell pilots in its cages, and the Corsairs have already emptied the other side of it. Their shuttles fly cover for your pods. Break the pods loose, see them to the rendezvous, and lose none.",
        addAllies: [
          {
            shipId: "corsair_blade",
            count: 2,
            tag: "corsair_cover",
            name: "Corsair Shuttle Escort",
          },
        ],
        script: [
          atTime(
            6,
            say(
              PHOENIX,
              "Corsair shuttles on the pods' flank. They remember who helped them off the other side.",
              "proud",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        PHOENIX,
        "Corsairs on the far side of the hulk, breaking out their own. Same night, same plan. Nobody told them.",
        "neutral",
      ),
      debriefLine(
        VASQUEZ,
        "The freed pilots are asking for ships. I'd say they've earned them.",
        "proud",
      ),
    ],
  },
  conf_2_3: {
    day: 70,
    location: "Ion storm parley point",
    tagline: "Pirates in a storm. Kira picked the weather.",
    briefing:
      "Captain Kira of the Void Corsairs offers a pact, and she chose an ion storm for the parley. Shields will bleed in it, and Phoenix does not trust the silence. Keep Kira in one piece: a crippled captain withdraws, and takes the deal with her.",
    objectiveText: {
      captain: "Keep Captain Kira in the fight",
      ambush: "Destroy the Hegemony ambush",
    },
    textSwaps: [
      [
        "The captain's dead. So is the alliance.",
        "Kira's out. So is the deal.",
      ],
      [
        "Captain lives. The Corsairs owe us now.",
        "Kira's still flying. The Corsairs owe us now.",
      ],
    ],
    script: [
      atTime(
        6,
        say(
          KIRA,
          "Santos. You came alone, more or less. Keep your wing off my stern and mine stays off yours.",
          "neutral",
        ),
      ),
      atTime(
        34,
        say(
          VASQUEZ,
          "They knew the meeting point. Fleet Intelligence, Vance's desk. I know that cipher.",
          "grim",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "cors_crew_rescued" },
        briefing:
          "Captain Kira of the Void Corsairs offers a pact in an ion storm. Her crew was pulled off the Gallows Hulk, and she knows who helped. She comes with a wingman and an open ear. Keep her in the fight: a crippled captain withdraws, and takes the deal with her.",
        addAllies: [
          {
            shipId: "corsair_blade",
            count: 1,
            tag: "kira_wing",
            name: "Kira's Wingman",
          },
        ],
        script: [
          atTime(
            10,
            say(
              KIRA,
              "Your cell pulled my crew off the Hulk. I don't forget that. Let's finish the talking.",
              "proud",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        SANTOS,
        "The ambush was Hegemony, and it was told where to wait. Someone sold this meeting.",
        "grim",
      ),
    ],
  },
  conf_2_4: {
    day: 74,
    location: "Hegemony deepcomm relay",
    crossover: "X6",
    tagline: "Their orders in a relay. Copy them quietly.",
    briefing:
      "A Hegemony deepcomm relay keeps Fleet Intelligence's standing orders. Park inside its dish range long enough to copy them, stay clear of the sensor towers if you can, and get out through the jump point. Vasquez wants to see the signatures.",
    objectiveText: {
      hack: "Copy the relay's orders: stay within dish range for 15 seconds",
      exfil: "Escape with the orders through the jump point",
    },
    script: [
      atTime(
        10,
        say(
          VASQUEZ,
          "The relay keeps Fleet Intelligence's orders. If Vance signed what I think he signed...",
          "grim",
        ),
      ),
      onObjective("hack", "completed", setFlag("x6_vance_orders", true)),
    ],
    variants: [
      {
        when: { flag: "heg_phoenix_defected" },
        script: [
          beat(
            { on: "objective", objectiveId: "hack", status: "completed" },
            [
              say(
                PHOENIX,
                "Chen listened. The relay is already asking Fleet Intelligence the questions I put to him.",
                "proud",
              ),
            ],
            { delaySeconds: CHEN_ANSWER_DELAY_SECONDS },
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        VASQUEZ,
        "Vance's signature is on every page. This is not Fleet policy. It is a private war.",
        "grim",
      ),
      debriefLine(
        PHOENIX,
        "I'll carry it to the one Hegemony officer who might listen. Chen. He fought me clean at Kessa.",
        "solemn",
      ),
    ],
  },
  conf_2_5: {
    day: 118,
    location: "Rim worlds orbit",
    tagline: "Kronos's vanguard over our worlds. Bring it down.",
    briefing:
      "HNS Iron Verdict, Kronos's vanguard battlecruiser, is shelling the Rim worlds' orbitals. Wildfire Squadron flies with you. Strip its Viper screen, then gut it from the stern.",
    objectiveText: { cruiser: "Destroy HNS Iron Verdict" },
    debriefAppend: [
      debriefLine(
        COMMAND,
        "Iron Verdict is gone. Kronos will not forget whose guns did it.",
        "grim",
      ),
    ],
  },
};
