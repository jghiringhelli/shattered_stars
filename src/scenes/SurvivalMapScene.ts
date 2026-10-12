/**
 * Survival Map Scene — the roguelite's sector map (Slay the Spire-style).
 *
 * Shows the sector's branching node map with typed icons and a legend, the
 * path flown so far, reachable nodes, a hover preview of what each node
 * offers, and the run status / relics panel. Clicking a reachable node
 * travels there: battles start SurvivalScene; events, shops and repair
 * docks resolve here (MapChoiceFlows). The run is saved at every node.
 * See docs/adr/ADR-0004-survival-roguelite-run-structure.md.
 */

import Phaser from "phaser";
import { NODE_INFO } from "../data/survival/nodes";
import { pickEnemyFaction } from "../data/survival/enemyFactions";
import { FACTION_NAMES_SHORT } from "../data/survival/factionNames";
import { sectorName } from "../data/survival/sectors";
import { isCombatNode } from "../data/survival/nodes";
import { audioManager } from "../audio/AudioManager";
import { survivalMapMusic } from "../audio/musicContexts";
import { createHoverButton } from "../ui/ButtonFactory";
import { addMenuBackdrop, addMenuHeader } from "../ui/menu/MenuScaffold";
import { factionAccent, HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { SurvivalChoicePanel } from "../ui/survival/SurvivalChoicePanel";
import { SectorMapView } from "../ui/survival/SectorMapView";
import { RunStatusPanel } from "../ui/survival/RunStatusPanel";
import { MapChoiceFlows } from "../ui/survival/MapChoiceFlows";
import {
  runServiceOf,
  type RoguelikeRunService,
} from "../systems/survival/RoguelikeRunService";
import { canEnterNode, enterNode } from "../systems/survival/RunNavigation";
import {
  nextOptions,
  type MapNode,
} from "../systems/survival/SectorMapGenerator";
import { combatKindOf } from "../systems/survival/CombatNodePlan";
import { rngFor } from "../systems/survival/RunRng";
import type { RunState } from "../systems/survival/RunTypes";

/** Bottom-right buttons (px). */
const BUTTON = {
  width: 170,
  height: 40,
  y: 640,
  menuX: 990,
  abandonX: 1175,
} as const;

export class SurvivalMapScene extends Phaser.Scene {
  private service!: RoguelikeRunService;
  private mapView!: SectorMapView;
  private statusPanel!: RunStatusPanel;
  private choicePanel!: SurvivalChoicePanel;
  private flows!: MapChoiceFlows;

  constructor() {
    super({ key: "SurvivalMapScene" });
  }

  create(): void {
    this.service = runServiceOf(this.registry);
    const run = this.service.run ?? this.service.resume();
    if (!run) {
      this.scene.start("SurvivalSetupScene");
      return;
    }
    addMenuBackdrop(this, { textureId: "starfield_deep" });
    addMenuHeader(this, {
      title: `Survival — ${sectorName(run.sector)}`,
      subtitle:
        "Plot your route. Damage carries over between nodes — choose repairs wisely.",
      accent: factionAccent(run.faction),
    });
    audioManager.initialize();
    audioManager.playMusic(survivalMapMusic(run.activeKind));
    this.mapView = new SectorMapView(this);
    this.statusPanel = new RunStatusPanel(this);
    this.choicePanel = new SurvivalChoicePanel(this, run.faction);
    this.flows = new MapChoiceFlows(this.service, this.choicePanel, {
      refresh: () => this.refresh(),
      launchBattle: () => this.launchBattle(),
    });
    this.createButtons();
    this.refresh();
  }

  /** The run on the map (null once it has ended). */
  get run(): RunState | null {
    return this.service.run;
  }

  /**
   * Redraws the map and panel, then continues the run's flow: summary when
   * the run ended, else pending rewards, else the active node's dialog.
   */
  refresh(): void {
    const run = this.service.run;
    if (!run || run.status !== "active") {
      this.scene.start("SurvivalSummaryScene");
      return;
    }
    const reachable = new Set(
      nextOptions(run.map, run.currentNodeId)
        .filter((n) => canEnterNode(run, n.id))
        .map((n) => n.id),
    );
    this.mapView.render(
      {
        map: run.map,
        path: run.path,
        currentNodeId: run.currentNodeId,
        reachable,
      },
      {
        onSelect: (node) => this.travelTo(node.id),
        describe: (node) => this.describe(run, node),
      },
    );
    this.statusPanel.render(run);
    this.continueFlow(run);
  }

  private continueFlow(run: RunState): void {
    // Shop → Starport Cantina; travelling the map → Long Haul.
    audioManager.playMusic(survivalMapMusic(run.activeKind));
    if (run.pendingRewards.length > 0) {
      this.flows.showReward(run);
      return;
    }
    if (!run.activeNodeId) return;
    const battle = combatKindOf(run);
    if (battle) {
      this.flows.showEngage(
        `${NODE_INFO[battle].label} in progress — the battle restarts from its beginning`,
      );
    } else if (run.activeKind === "event") this.flows.showEvent(run);
    else if (run.activeKind === "shop") this.flows.showShop(run);
    else if (run.activeKind === "repair") this.flows.showDock(run);
  }

  /**
   * Travels to a reachable node (also the e2e entry point).
   *
   * @param nodeId - The node.
   * @returns True when the fleet moved.
   */
  travelTo(nodeId: string): boolean {
    const run = this.service.run;
    if (!run || this.flows.isOpen || !canEnterNode(run, nodeId)) return false;
    const entered = this.service.apply((r) => enterNode(r, nodeId));
    audioManager.playSound("ui_select", 0.7);
    if (entered && combatKindOf(entered)) this.launchBattle();
    else this.refresh();
    return true;
  }

  private launchBattle(): void {
    const run = this.service.run;
    if (!run) return;
    this.scene.start("SurvivalScene", {
      factionId: run.faction,
      fromRun: true,
    });
  }

  private describe(run: RunState, node: MapNode): string {
    const info = NODE_INFO[node.type];
    const base = `${info.icon} ${info.label}: ${info.preview}`;
    if (!isCombatNode(node.type)) return base;
    const enemy = pickEnemyFaction(
      rngFor(run.seed, "faction", node.id),
      run.faction,
    );
    return `${base} · Intel: ${FACTION_NAMES_SHORT[enemy]}`;
  }

  private createButtons(): void {
    createHoverButton(
      this,
      BUTTON.menuX,
      BUTTON.y,
      {
        width: BUTTON.width,
        height: BUTTON.height,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label: "SAVE & QUIT",
        font: "600 15px",
      },
      () => this.scene.start("MainMenuScene"),
    );
    createHoverButton(
      this,
      BUTTON.abandonX,
      BUTTON.y,
      {
        width: BUTTON.width,
        height: BUTTON.height,
        color: HOLO_PALETTE.danger,
        variant: "danger",
        label: "ABANDON RUN",
        font: "600 15px",
      },
      () => this.confirmAbandon(),
    );
  }

  private confirmAbandon(): void {
    if (this.flows.isOpen) return;
    this.choicePanel.show(
      "Abandon run?",
      [
        {
          icon: "✖",
          name: "Abandon",
          description: "End this run now (Star Charts are still paid)",
        },
        { icon: "↩", name: "Keep flying", description: "Return to the map" },
      ],
      (i) => {
        if (i === 0) {
          this.service.abandon();
          this.scene.start("SurvivalSummaryScene");
        } else this.refresh();
      },
    );
  }
}
