/**
 * LobbyScene — online play: pick a mode, then QUICK MATCH, CREATE ROOM or
 * JOIN BY CODE; in the room pick a ship / squad (and team / scenario),
 * READY up, chat, see everyone's ping; disconnects show and reconnect on
 * their own. The relay connection and lobby state live in the game's
 * OnlineSession (src/net/lobby), so the room survives scene changes; this
 * scene only renders it and forwards the player's choices (what the buttons
 * do: src/scenes/online/lobbyActions).
 */

import Phaser from "phaser";
import {
  getOnlineSession,
  pilotName,
} from "../net/lobby/createOnlineSession";
import {
  connectionStatus,
  lobbyScreen,
  localPlayer,
  roomCountdowns,
  type LobbyState,
} from "../net/lobby/LobbyModel";
import { pendingLoadout } from "../net/lobby/lobbyEdits";
import type { SavedSquad } from "../net/lobby/loadoutChoices";
import { localSeatOf, ONLINE_BATTLES_ENABLED } from "../net/lobby/matchSetup";
import type { OnlineSession } from "../net/lobby/OnlineSession";
import type { Loadout } from "../net/protocol";
import {
  addBackButton,
  addMenuBackdrop,
  addMenuHeader,
  type MenuHeader,
} from "../ui/menu/MenuScaffold";
import { MenuFocus } from "../ui/menu/MenuFocus";
import type { HoloPressButton } from "../ui/menu/HoloPressButton";
import {
  bindMenuBack,
  fadeInMenu,
  goToScene,
  playUiBack,
} from "../ui/menu/menuTransitions";
import { HoloTextPrompt } from "../ui/lobby/HoloTextPrompt";
import { LobbyStatusChip } from "../ui/lobby/LobbyStatusChip";
import { renderOnlineMenu } from "../ui/lobby/OnlineMenuView";
import { renderOnlineRoom } from "../ui/lobby/OnlineRoomView";
import { modeTitle } from "../ui/lobby/onlineModes";
import { showMatchPendingCard } from "../ui/lobby/OnlineMatchCard";
import { LobbyChatInput } from "../ui/lobby/LobbyChatInput";
import { launchOnlineMatch } from "./online/launchOnlineMatch";
import {
  createMenuActions,
  createRoomActions,
  savedSquadFrom,
  type LobbyActionHost,
  type LobbyPrompt,
} from "./online/lobbyActions";

/** Painted backdrop behind the lobby. */
const BACKDROP_TEXTURE = "nebula_teal";
/** Status chip distance from the bottom edge. */
const STATUS_INSET = 32;
/** Countdown / queue-timer refresh period (ms). */
const CLOCK_REFRESH_MS = 250;

export class LobbyScene extends Phaser.Scene implements LobbyActionHost {
  session!: OnlineSession;
  private unsubscribe: (() => void) | null = null;
  private header!: MenuHeader;
  private statusChip!: LobbyStatusChip;
  private prompt!: HoloTextPrompt;
  private chat!: LobbyChatInput;
  private view!: Phaser.GameObjects.Container;
  private focus: MenuFocus | null = null;
  private renderKey = "";
  private shownMatchId: string | null = null;
  private autoLoadoutKey = "";
  private matchCard: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: "LobbyScene" });
  }

  create(): void {
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    this.header = addMenuHeader(this, {
      title: "ONLINE",
      subtitle: "Choose a mode",
    });
    addBackButton(this, () => this.goBack());
    this.statusChip = new LobbyStatusChip(
      this,
      { x: this.scale.width / 2, y: this.scale.height - STATUS_INSET },
      "Connecting…",
    );
    this.prompt = new HoloTextPrompt(this);
    this.chat = new LobbyChatInput(this, {
      isActive: () =>
        lobbyScreen(this.session.state) === "room" && !this.prompt.isOpen,
      send: (text) => this.session.chat(text),
      changed: () => this.render(true),
    });
    this.view = this.add.container(0, 0);
    this.setupKeys();
    this.attach(getOnlineSession(this.registry));
    this.time.addEvent({
      delay: CLOCK_REFRESH_MS,
      loop: true,
      callback: () => this.render(false),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detach());
    fadeInMenu(this);
  }

  /** @param session - The session to render (replaced when the name or server changes). */
  attach(session: OnlineSession): void {
    this.detach();
    this.session = session;
    this.unsubscribe = session.subscribe((state) => this.onState(state));
    session.connect();
    this.onState(session.state);
  }

  /** @param prompt - What to ask. @param done - Receives the trimmed answer. */
  ask(prompt: LobbyPrompt, done: (value: string) => void): void {
    this.focus?.clear();
    this.prompt.open(prompt, (value) => {
      if (value === null || (!prompt.allowEmpty && !value.trim())) return;
      done(value.trim());
    });
  }

  /** @returns The squad saved from the Squad Builder, if any. */
  savedSquad(): SavedSquad | null {
    return savedSquadFrom(this.registry);
  }

  /** Open the Squad Builder for this room. */
  editSquad(): void {
    const loadout = localPlayer(this.session.state)?.loadout;
    if (loadout) this.registry.set("onlineFaction", loadout.faction);
    this.scene.start("SquadBuilderScene", { initialMode: "online" });
  }

  /** Focus the chat input. */
  focusChat(): void {
    this.chat.focus();
  }

  /** Leave online play for the offline main menu. */
  playOffline(): void {
    goToScene(this, "MainMenuScene");
  }

  private detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private onState(state: LobbyState): void {
    const loadout = pendingLoadout(state, this.savedSquad());
    if (loadout && state.room)
      this.sendAutoLoadout(
        [state.room.code, localPlayer(state)?.loadout ?? null],
        loadout,
      );
    if (state.match && state.match.matchId !== this.shownMatchId)
      this.onMatchStart();
    if (!state.match && this.matchCard) {
      this.matchCard.destroy();
      this.matchCard = null;
    }
    this.render(true);
  }

  /** Sends a suggested loadout once per (room, current loadout): a refusal must not be re-sent on every state change. */
  private sendAutoLoadout(context: unknown, loadout: Loadout): void {
    const key = JSON.stringify([context, loadout]);
    if (key === this.autoLoadoutKey) return;
    this.autoLoadoutKey = key;
    this.session.setLoadout(loadout);
  }

  /** Re-render: always on state changes, once per second for clocks. */
  private render(force: boolean): void {
    const state = this.session.state;
    const clocks = roomCountdowns(state, this.session.client.serverNow());
    const queued = state.queue
      ? Math.floor((this.session.client.serverNow() - state.queue.since) / 1000)
      : 0;
    const key = JSON.stringify([clocks, queued]);
    if (!force && key === this.renderKey) return;
    this.renderKey = key;
    this.view.removeAll(true);
    const buttons = state.room
      ? renderOnlineRoom(
          this,
          this.view,
          { state, chat: this.chat.state(state.chat), countdowns: clocks },
          createRoomActions(this),
        )
      : renderOnlineMenu(
          this,
          this.view,
          {
            state,
            pilotName: pilotName(),
            rttMs: this.session.client.rttMs,
            queuedSeconds: Math.max(0, queued),
          },
          createMenuActions(this),
        );
    this.updateHeader(state);
    this.resetFocus(buttons);
  }

  private updateHeader(state: LobbyState): void {
    this.header.title.setText(state.room ? "GAME ROOM" : "ONLINE");
    this.header.subtitle?.setText(
      state.room
        ? modeTitle(state.room.mode)
        : `${modeTitle(state.mode)} · choose how to find a match`,
    );
    const status =
      state.notice ?? connectionStatus(state, this.session.client.rttMs);
    this.statusChip.setStatus(status.text, status.tone);
  }

  private resetFocus(buttons: HoloPressButton[]): void {
    this.focus?.destroy();
    this.focus = new MenuFocus(this, buttons, {
      columns: buttons.length,
      isActive: () => !this.prompt.isOpen && !this.chat.focused,
    });
  }

  private onMatchStart(): void {
    const match = this.session.state.match;
    if (!match) return;
    this.shownMatchId = match.matchId;
    if (ONLINE_BATTLES_ENABLED) {
      launchOnlineMatch(this, match, this.session.state.localId);
      return;
    }
    const localSeat = localSeatOf(match, this.session.state.localId);
    this.matchCard = showMatchPendingCard(this, match, localSeat, () => {
      this.matchCard = null;
      this.session.client.send({ t: "match_over", tick: 0, winnerTeam: null });
    });
    this.session.client.send({ t: "loaded" });
  }

  private setupKeys(): void {
    bindMenuBack(this, () => this.goBack(), {
      escape: false,
      isActive: () => !this.prompt.isOpen && !this.chat.focused,
    });
    let lastEsc: KeyboardEvent | null = null;
    this.input.keyboard?.on("keydown-ESC", (event: KeyboardEvent) => {
      if (this.prompt.isOpen || this.prompt.handled(event) || event === lastEsc)
        return;
      lastEsc = event;
      if (this.chat.focused) return this.chat.blur();
      playUiBack();
      this.goBack();
    });
  }

  private goBack(): void {
    const screen = lobbyScreen(this.session.state);
    if (screen === "room") return this.session.leaveRoom();
    if (screen === "queue") return this.session.cancelQueue();
    goToScene(this, "MainMenuScene");
  }
}
