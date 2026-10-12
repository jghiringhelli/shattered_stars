/**
 * LobbyScene — online play: pick a mode, then QUICK MATCH, CREATE ROOM or
 * JOIN BY CODE; in the room pick a ship / squad (and team / scenario),
 * READY up, chat, see everyone's ping; disconnects show and reconnect on
 * their own. The relay connection and lobby state live in the game's
 * OnlineSession (src/net/lobby), so the room survives scene changes; this
 * scene only renders it and forwards the player's choices.
 */

import Phaser from "phaser";
import {
  getOnlineSession,
  changePilotName,
  changeServer,
  pilotName,
} from "../net/lobby/createOnlineSession";
import {
  connectionStatus,
  lobbyScreen,
  localPlayer,
  roomCountdowns,
  type LobbyState,
} from "../net/lobby/LobbyModel";
import {
  cycleFaction,
  cycleShip,
  defaultLoadout,
  type SavedSquad,
} from "../net/lobby/loadoutChoices";
import {
  nextScenario,
  otherTeam,
  pendingLoadout,
} from "../net/lobby/lobbyEdits";
import {
  buildOnlineBattleConfig,
  buildOnlineDogfightInit,
  localSeatOf,
  ONLINE_BATTLES_ENABLED,
} from "../net/lobby/matchSetup";
import type { OnlineSession } from "../net/lobby/OnlineSession";
import type { FactionId } from "../config";
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

/** Painted backdrop behind the lobby. */
const BACKDROP_TEXTURE = "nebula_teal";
/** Status chip distance from the bottom edge. */
const STATUS_INSET = 32;
/** Countdown / queue-timer refresh period (ms). */
const CLOCK_REFRESH_MS = 250;

export class LobbyScene extends Phaser.Scene {
  private session!: OnlineSession;
  private unsubscribe: (() => void) | null = null;
  private header!: MenuHeader;
  private statusChip!: LobbyStatusChip;
  private prompt!: HoloTextPrompt;
  private chat!: LobbyChatInput;
  private view!: Phaser.GameObjects.Container;
  private focus: MenuFocus | null = null;
  private renderKey = "";
  private shownMatchId: string | null = null;
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

  private attach(session: OnlineSession): void {
    this.detach();
    this.session = session;
    this.unsubscribe = session.subscribe((state) => this.onState(state));
    session.connect();
    this.onState(session.state);
  }

  private detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private onState(state: LobbyState): void {
    const loadout = pendingLoadout(state, this.savedSquad());
    if (loadout) this.session.setLoadout(loadout);
    if (state.match && state.match.matchId !== this.shownMatchId)
      this.onMatchStart();
    if (!state.match && this.matchCard) {
      this.matchCard.destroy();
      this.matchCard = null;
    }
    this.render(true);
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
          this.roomActions(),
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
          this.menuActions(),
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

  private menuActions() {
    const s = this.session;
    return {
      selectMode: (mode: Parameters<OnlineSession["selectMode"]>[0]) =>
        s.selectMode(mode),
      quickMatch: () => s.quickMatch(),
      createRoom: () => s.createRoom(),
      joinByCode: () =>
        this.ask(
          "Join by code",
          "Room code from your friend:",
          "",
          "JOIN",
          (code) => {
            if (!s.joinRoom(code)) s.notify("Not connected", "danger");
          },
        ),
      cancelQueue: () => s.cancelQueue(),
      editName: () =>
        this.ask(
          "Pilot name",
          "Shown to other players:",
          pilotName(),
          "SAVE",
          (name) => this.attach(changePilotName(this.registry, name)),
        ),
      editServer: () =>
        this.ask(
          "Online server",
          "Relay address (leave empty for the default):",
          s.state.server.source === "settings"
            ? (s.state.server.url ?? "")
            : "",
          "SAVE",
          (url) => this.attach(changeServer(this.registry, url)),
          true,
        ),
      reconnect: () => s.connect(),
    };
  }

  private roomActions() {
    const s = this.session;
    const me = () => localPlayer(s.state);
    const mode = () => s.state.room?.mode ?? "dogfight";
    return {
      cycleFaction: () =>
        s.setLoadout(
          cycleFaction(mode(), me()?.loadout ?? null, 1, this.savedSquad()),
        ),
      cycleShip: () =>
        s.setLoadout(
          cycleShip(
            me()?.loadout ?? defaultLoadout(mode(), "free_confederation"),
            1,
          ),
        ),
      editSquad: () => this.editSquad(),
      toggleTeam: () => s.setTeam(otherTeam(me()?.team ?? 0)),
      cycleScenario: () =>
        s.setScenario(nextScenario(s.state.room?.options.scenarioId)),
      toggleReady: () => s.setReady(!(me()?.ready ?? false)),
      copyCode: () => this.copyCode(),
      leave: () => s.leaveRoom(),
      focusChat: () => this.chat.focus(),
    };
  }

  private editSquad(): void {
    const loadout = localPlayer(this.session.state)?.loadout;
    if (loadout) this.registry.set("onlineFaction", loadout.faction);
    this.scene.start("SquadBuilderScene", { initialMode: "online" });
  }

  private copyCode(): void {
    const code = this.session.state.room?.code;
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => undefined);
    this.session.notify(
      `Room code ${code} copied — send it to your wingmate`,
      "success",
    );
  }

  private savedSquad(): SavedSquad | null {
    const faction = this.registry.get("onlineFaction") as string | undefined;
    const ships = this.registry.get("onlineSquad") as string[] | undefined;
    return faction && ships && ships.length > 0
      ? { faction: faction as FactionId, ships }
      : null;
  }

  private onMatchStart(): void {
    const match = this.session.state.match;
    if (!match) return;
    this.shownMatchId = match.matchId;
    const localSeat = localSeatOf(match, this.session.state.localId);
    if (!ONLINE_BATTLES_ENABLED) {
      this.matchCard = showMatchPendingCard(this, match, localSeat, () => {
        this.matchCard = null;
        this.session.client.send({
          t: "match_over",
          tick: 0,
          winnerTeam: null,
        });
      });
      this.session.client.send({ t: "loaded" });
      return;
    }
    if (match.mode === "dogfight") {
      this.scene.start(
        "DogfightScene",
        buildOnlineDogfightInit(match, localSeat),
      );
      return;
    }
    this.registry.set(
      "battleConfig",
      buildOnlineBattleConfig(match, localSeat),
    );
    this.scene.start("ArcadeBattleScene");
  }

  private ask(
    title: string,
    message: string,
    initialValue: string,
    confirmLabel: string,
    done: (value: string) => void,
    allowEmpty = false,
  ): void {
    this.focus?.clear();
    this.prompt.open(
      { title, message, initialValue, confirmLabel },
      (value) => {
        if (value === null || (!allowEmpty && !value.trim())) return;
        done(value.trim());
      },
    );
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
