/**
 * OnlineMatchCard — shown when a match starts while the battle scenes do not
 * run on the lockstep session yet (matchSetup.ONLINE_BATTLES_ENABLED off):
 * the canonical seat list, seed and input delay the relay agreed on, and a
 * BACK TO ROOM button that reports the match over so the room re-opens.
 */

import type Phaser from "phaser";
import { describeLoadout } from "../../net/lobby/loadoutChoices";
import { TICK_MS, type MatchStart } from "../../net/protocol";
import { createHoverButton } from "../ButtonFactory";
import { createModalFrame } from "./lobbyModal";
import { addLobbyText } from "./lobbyLayout";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { modeTitle } from "./onlineModes";

const CARD = { width: 620, height: 300, lineHeight: 24 } as const;

/**
 * @param scene - Lobby scene.
 * @param match - The started match.
 * @param localSeat - This client's seat.
 * @param onClose - Report the match over (the room returns to its lobby).
 * @returns The card's root (destroy it to close the card).
 */
export function showMatchPendingCard(
  scene: Phaser.Scene,
  match: MatchStart,
  localSeat: number,
  onClose: () => void,
): Phaser.GameObjects.Container {
  const frame = createModalFrame(scene, {
    width: CARD.width,
    height: CARD.height,
    title: "MATCH READY",
    accent: HOLO_PALETTE.accent,
  });
  const { container } = frame;
  container.setName("online_match_card");
  const cx = frame.left + frame.width / 2;
  const top = frame.contentTop + 8;
  const lines = [
    `${modeTitle(match.mode)} · seed ${match.seed} · input delay ${Math.round(match.inputDelay * TICK_MS)} ms`,
    ...match.seats.map(
      (s) =>
        `Seat ${s.seat + 1}${s.seat === localSeat ? " (you)" : ""}: ${s.name} — ${describeLoadout(s.loadout)}`,
    ),
    "Battles over the network arrive with the next build.",
  ];
  lines.forEach((line, i) =>
    container.add(
      addLobbyText(scene, { x: cx, y: top + i * CARD.lineHeight }, line, {
        size: 14,
        originX: 0.5,
        color:
          i === lines.length - 1
            ? HOLO_PALETTE.warning
            : HOLO_PALETTE.textSecondary,
      }),
    ),
  );
  const back = createHoverButton(
    scene,
    cx,
    frame.top + frame.height - 40,
    {
      width: 200,
      height: 38,
      color: HOLO_PALETTE.panelFill,
      variant: "primary",
      label: "BACK TO ROOM",
      icon: "back",
    },
    () => {
      onClose();
      container.destroy();
    },
  );
  back.setName("online_match_back");
  container.add(back);
  return container;
}
