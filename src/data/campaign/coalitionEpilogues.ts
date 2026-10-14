/**
 * coalitionEpilogues — what each Act V ending says (docs/lore/campaign_arc.md
 * §6): one line per hero voice plus lines that only play when the Chronicle
 * or a Coalition mission left the matching flag, and the title and summary
 * the completion screen shows for each choice. The Quiet is the forced Seal
 * (unity below 4).
 */

import type { FlagCondition } from "../../campaign/scripting/scriptTypes";
import type { Speaker } from "./designKit";
import {
  ADMIRAL,
  CHEN,
  DREAMER,
  HERALD,
  KIRA,
  OMEGA,
  PHOENIX,
  SANTOS,
  VASQUEZ,
  WHISPER,
} from "./designs/coalitionShared";
import type { EndingId } from "./crossovers";
import type { EpilogueLine } from "./epilogues";

const epi = (
  speaker: Speaker,
  text: string,
  flag?: string,
): EpilogueLine => {
  const when: FlagCondition | undefined = flag ? { flag } : undefined;
  return {
    speaker: speaker.name,
    portraitKey: speaker.portraitKey,
    text,
    ...(when ? { when } : {}),
  };
};

/** The title and summary of each ending on the choice screen. */
export const ENDING_TEXT: Readonly<
  Record<EndingId, { title: string; summary: string }>
> = {
  answer: {
    title: "Answer",
    summary:
      "The lattice, the chorus, the cipher, the gate codes and the shard become one voice. The Warden hears a galaxy that is loud without breaking the lanes, and it recedes into a guardian role. Psionics survive, and the five powers sign the Brannoc Accord.",
  },
  sever: {
    title: "Sever",
    summary:
      "The Resonance strike destroys the Warden. The lanes it kept healthy begin to fray, and within a generation half the wild lanes close. The galaxy is free but smaller, and psionics fade for a decade.",
  },
  seal: {
    title: "Seal",
    summary:
      "The Nexus is rebuilt around a mind: the Dreamer and your most-flown hero. The Tide sleeps, the cold war resumes, and a memorial stands at Brannoc.",
  },
  quiet: {
    title: "The Quiet",
    summary:
      "Without enough trust between the five powers, only the Seal remains. The Reach is lost with Vega Prime, and the Ascendant become a refugee people.",
  },
};

const ANSWER: readonly EpilogueLine[] = [
  epi(
    DREAMER,
    "Five voices, one note. The Warden answered, and it was not a scream.",
  ),
  epi(
    CHEN,
    "The five powers signed the Brannoc Accord at one table. The gates stay open to everyone.",
  ),
  epi(
    SANTOS,
    "Libre keeps its own flag. That was always the point of the Accord.",
  ),
  epi(
    OMEGA,
    "The lattice is a voice among voices. I am told the word for that is a chorus.",
  ),
  epi(KIRA, "I gave the shard back. Best price I ever got."),
  epi(
    HERALD,
    "Vega's colonists sang in the chorus. Not one of them was left behind.",
    "coal_exodus_all_saved",
  ),
  epi(
    ADMIRAL,
    "I kept the codes, as I promised Kira. Then I gave them to the cradle.",
    "cors_gate_codes",
  ),
  epi(
    WHISPER,
    "Vance's case went into the cradle with the rest. His half of the codes became one voice among five.",
    "coal_codes_recovered",
  ),
];

const SEVER: readonly EpilogueLine[] = [
  epi(
    DREAMER,
    "The Warden is gone, and I can no longer hear the lanes breathe. The gift is leaving us.",
  ),
  epi(
    CHEN,
    "The gates held, but half the wild lanes closed within the year. The Hegemony has fewer lanes to tax and fewer to defend.",
  ),
  epi(
    SANTOS,
    "A smaller galaxy, but a free one. Libre will teach its children the names of the lanes we lost.",
  ),
  epi(
    OMEGA,
    "The relays are quiet. Fewer lanes, fewer signals. The lattice survives in the ones that remain.",
  ),
  epi(
    KIRA,
    "Half my wild lanes just closed. A Pirate King with a shrinking map. Typical.",
  ),
  epi(
    VASQUEZ,
    "The Sol Mouth stayed open. Humanity's first lane is still there.",
    "coal_sol_mouth_saved",
  ),
  epi(
    PHOENIX,
    "The Brannoc ceasefire held through the fraying. That was worth the price.",
    "x14_ceasefire_called",
  ),
];

const SEAL: readonly EpilogueLine[] = [
  epi(
    DREAMER,
    "I stay. The Nexus is rebuilt around me and the one who flew beside me. The Tide sleeps.",
  ),
  epi(
    CHEN,
    "A memorial stands at Brannoc. The five powers are back to arguing across it.",
  ),
  epi(
    SANTOS,
    "Libre drills at the memorial every year. Nobody remembers who started the argument.",
  ),
  epi(
    OMEGA,
    "The lattice listens to a sleeping mind now. It hums in a different key.",
  ),
  epi(KIRA, "Back to the Drift. Nobody taxes a sleeping god."),
  epi(
    HERALD,
    "Vega's people keep the vigil with her. They sing in shifts.",
    "coal_exodus_all_saved",
  ),
  epi(
    ADMIRAL,
    "The codes are inside the Nexus now. Some doors stay shut because we choose it.",
    "cors_gate_codes",
  ),
];

const QUIET: readonly EpilogueLine[] = [
  epi(
    DREAMER,
    "The Seal holds. The Reach is gone with Vega Prime, and my people have no sky left to keep.",
  ),
  epi(
    CHEN,
    "We sealed it too late for the Reach. The Spine is crowded with refugees we cannot house.",
  ),
  epi(
    SANTOS,
    "Libre opens its ports to the Ascendant. It is not enough, but it is what we have.",
  ),
  epi(
    OMEGA,
    "I count four thousand Ascendant ships in need of berths. The lattice has begun routing them.",
  ),
  epi(
    KIRA,
    "Brass Anchorage fills with Vaelith. Who'd have thought pirates would be the landlords.",
  ),
  epi(
    HERALD,
    "Vega's liners reached the Rim. Their children are the only ones who remember the colony.",
    "coal_exodus_complete",
  ),
  epi(
    CHEN,
    "The truce held. It is the only reason anyone is still talking.",
    "coal_truce_held",
  ),
];

/** The lines each Act V ending plays, in order. */
export const ENDING_EPILOGUES: Readonly<
  Record<EndingId, readonly EpilogueLine[]>
> = {
  answer: ANSWER,
  sever: SEVER,
  seal: SEAL,
  quiet: QUIET,
};
