/**
 * Survival roguelite — the map's dialogs: claiming rewards (power draft
 * with spendable rerolls, relics, Hangar, mutations, sector jump), events,
 * shops and repair docks. Each dialog applies pure run operations through
 * the run service (which saves after each) and then hands control back.
 */

import { getEvent } from "../../data/survival/events";
import { sectorName } from "../../data/survival/sectors";
import type { RoguelikeRunService } from "../../systems/survival/RoguelikeRunService";
import {
  advanceSector,
  chooseHangar,
  chooseMutation,
  choosePower,
  chooseRelic,
  currentReward,
  hangarChoices,
  mutationChoices,
  powerDraft,
  relicChoices,
  skipPower,
  spendReroll,
} from "../../systems/survival/RewardFlow";
import { resolveEventChoice } from "../../systems/survival/EventResolver";
import { buyShopItem, shopStock } from "../../systems/survival/ShopService";
import { dockOptions, useDock } from "../../systems/survival/RepairDock";
import type { PendingReward, RunState } from "../../systems/survival/RunTypes";
import type { SurvivalChoicePanel } from "./SurvivalChoicePanel";
import {
  SALVAGE_GLYPH,
  dockCards,
  eventCards,
  hangarCards,
  mutationCards,
  powerCards,
  relicCards,
  shopCards,
} from "./choiceViewModels";

/** What the map scene does when a dialog closes. */
export interface FlowHooks {
  /** Redraw the map and continue the run's flow. */
  readonly refresh: () => void;
  /** Start the active battle. */
  readonly launchBattle: () => void;
}

export class MapChoiceFlows {
  /**
   * @param service - The run service.
   * @param panel - The choice overlay.
   * @param hooks - What to do when a dialog closes.
   */
  constructor(
    private readonly service: RoguelikeRunService,
    private readonly panel: SurvivalChoicePanel,
    private readonly hooks: FlowHooks,
  ) {}

  /** @returns True when a dialog is on screen. */
  get isOpen(): boolean {
    return this.panel.isOpen;
  }

  private update(op: (run: RunState) => RunState | null): void {
    this.service.apply((run) => op(run) ?? run);
  }

  /** Shows the reward at the front of the queue. */
  showReward(run: RunState): void {
    const reward = currentReward(run);
    if (reward) this.rewardDialog(run, reward);
  }

  private rewardDialog(run: RunState, reward: PendingReward): void {
    const done = () => this.hooks.refresh();
    if (reward.kind === "power") {
      const powers = powerDraft(run, reward.key);
      this.panel.show(
        "Choose a power",
        powerCards(powers, run.rerolls),
        (i) => {
          if (i < powers.length)
            this.update((r) => choosePower(r, powers[i]!.id));
          else if (i === powers.length) this.update(spendReroll);
          else this.update(skipPower);
          done();
        },
      );
    } else if (reward.kind === "relic") {
      const relics = relicChoices(run, reward);
      this.panel.show(
        "Choose a relic",
        relicCards(relics, run),
        (i) => {
          if (i < relics.length)
            this.update((r) => chooseRelic(r, relics[i]!.id));
          else this.update(spendReroll);
          done();
        },
        {
          subtitle:
            "Relics are permanent for this run. Shared [tags] hint at synergies; 3 of an archetype complete its set.",
        },
      );
    } else if (reward.kind === "hangar") {
      this.panel.show("Hangar", hangarCards(hangarChoices(run)), (i) => {
        this.update((r) => chooseHangar(r, i));
        done();
      });
    } else if (reward.kind === "mutation") {
      const options = mutationChoices(reward);
      this.panel.show(
        `${reward.slot} mutation`,
        mutationCards(options),
        (i) => {
          this.update((r) => chooseMutation(r, options[i]!.id));
          done();
        },
        {
          subtitle:
            "Mutations rewire how your flagship behaves. Pick one — the others are gone.",
        },
      );
    } else {
      this.panel.show(
        "Sector cleared",
        [
          {
            icon: "🚀",
            name: `Jump to ${sectorName(run.sector + 1)}`,
            description: "Enter the next sector",
          },
        ],
        () => {
          this.update(advanceSector);
          done();
        },
      );
    }
  }

  /** Shows the active event's choices. */
  showEvent(run: RunState): void {
    const event = run.activeEventId ? getEvent(run.activeEventId) : undefined;
    if (!event) {
      this.finish();
      return;
    }
    this.panel.show(
      event.title,
      eventCards(event, run),
      (i) => {
        const result = resolveEventChoice(this.service.run ?? run, event, i);
        this.service.apply(() => result.run);
        this.panel.show(
          event.title,
          [{ icon: "▸", name: "Continue", description: result.message }],
          () => {
            if (result.startsCombat) this.hooks.launchBattle();
            else this.finish();
          },
        );
      },
      { subtitle: event.text },
    );
  }

  /** Shows the active shop's shelf (re-shown after each purchase). */
  showShop(run: RunState): void {
    const nodeId = run.activeNodeId ?? "";
    const stock = shopStock(run, nodeId);
    this.panel.show(
      "Shop",
      shopCards(stock),
      (i) => {
        const item = stock[i];
        if (!item) {
          this.finish();
          return;
        }
        this.update((r) => buyShopItem(r, nodeId, item.id));
        this.showShop(this.service.run ?? run);
      },
      {
        subtitle: `Salvage: ${run.salvage} ${SALVAGE_GLYPH}   Rerolls: ${run.rerolls}`,
      },
    );
  }

  /** Shows the active repair dock's options. */
  showDock(run: RunState): void {
    const options = dockOptions(run);
    this.panel.show(
      "Repair dock",
      dockCards(options),
      (i) => {
        this.update((r) => useDock(r, options[i]!.id));
        this.finish();
      },
      {
        subtitle:
          "Choose one: repair the whole fleet, or upgrade a single ship.",
      },
    );
  }

  /**
   * Offers to (re-)engage the active battle (e.g. after resuming a save).
   *
   * @param label - The battle's description.
   */
  showEngage(label: string): void {
    this.panel.show(
      "Battle stations",
      [{ icon: "⚔", name: "Engage", description: label }],
      () => this.hooks.launchBattle(),
    );
  }

  private finish(): void {
    this.service.finishActiveNode();
    this.hooks.refresh();
  }
}
