/**
 * LessonCoach — what the Flight School card shows about the player's input:
 * the key chips for the current lesson (lit while held, progress through the
 * gesture, a done state) and the reason a refused gesture did nothing
 * (STRESSED / RECHARGING / NOT ON DIAL). Reads the same held intents the
 * flight controls read; the model itself is pure (tutorial/LessonInputs).
 */

import type { FlightRefusal } from "../../arcade/systems/FlightCapabilities";
import type { ActionIntent } from "../../input/InputTypes";
import type {
  FlightSchoolStep,
  KeyLabeler,
} from "../../tutorial/FlightSchoolSteps";
import { advanceGesture } from "../../tutorial/GestureTracker";
import { lessonInputPlan } from "../../tutorial/LessonPlans";
import {
  lessonDoneView,
  lessonInputView,
  startGesture,
  type GestureProgress,
  type LessonInputPlan,
} from "../../tutorial/LessonInputs";
import {
  TRAINER_LESSONS,
  rechargeLeftMs,
  rechargeNotice,
  refusalNotice,
} from "../../tutorial/TraineeSupport";
import type { LessonPanel } from "./LessonPanel";

/** One frame, as the scene reports it to the coach. */
export interface CoachFrame {
  readonly stepId: string | null;
  readonly nowMs: number;
  /** Intents pressed this frame (a tap shorter than a frame is still seen). */
  readonly tapped: ReadonlySet<ActionIntent>;
  /** What the pilot controls refused this frame. */
  readonly refusals: readonly FlightRefusal[];
  /** The trainee's controls before this frame's flight (recharges as the player met them). */
  readonly controlBefore: Parameters<typeof rechargeLeftMs>[0];
}

/** The lesson card's input feedback. */
export class LessonCoach {
  private plan: LessonInputPlan | null = null;
  private gesture: GestureProgress = startGesture();
  /** The finished lesson's done chips are on show until the next lesson. */
  private showingDone = false;

  /**
   * @param panel - The lesson card.
   * @param isHeld - Whether an intent is held right now (InputManager).
   */
  constructor(
    private readonly panel: LessonPanel,
    private readonly isHeld: (intent: ActionIntent) => boolean,
  ) {}

  /**
   * Show a lesson and start tracking its gesture.
   *
   * @param index - Lesson index (0-based).
   * @param total - Number of lessons.
   * @param step - The lesson.
   * @param keys - Labels the player's bound keys.
   */
  begin(
    index: number,
    total: number,
    step: Pick<FlightSchoolStep, "id" | "title" | "prompt">,
    keys: KeyLabeler,
  ): void {
    this.plan = lessonInputPlan(step.id, keys);
    this.gesture = startGesture();
    this.showingDone = false;
    const view = this.plan
      ? lessonInputView(this.plan, this.gesture, new Set(), 0)
      : null;
    this.panel.showLesson(index, total, step.title, step.prompt(keys), {
      plan: this.plan,
      view,
    });
  }

  /** Show the finished lesson's chips as done (before the next lesson). */
  showDone(nowMs: number): void {
    this.showingDone = true;
    if (this.plan) this.panel.setInputs(lessonDoneView(this.plan), nowMs);
  }

  /**
   * Track one frame of input and explain refusals.
   *
   * @param frame - The frame.
   * @returns Whether a stressed refusal asks for the trainee to be refreshed.
   */
  update(frame: CoachFrame): boolean {
    const plan = this.plan;
    if (!plan || this.showingDone) return false;
    const held = new Set<ActionIntent>();
    for (const stage of plan.stages)
      for (const chip of stage.chips)
        for (const intent of chip.intents)
          if (this.isHeld(intent) || frame.tapped.has(intent)) held.add(intent);
    const next = advanceGesture(plan, this.gesture, {
      nowMs: frame.nowMs,
      held,
    });
    this.explain(frame, next.completions > this.gesture.completions);
    this.gesture = next;
    this.panel.setInputs(
      lessonInputView(plan, next, held, frame.nowMs),
      frame.nowMs,
    );
    const stressed = frame.refusals.some((r) => r.reason === "stressed");
    return stressed && frame.stepId !== null && frame.stepId in TRAINER_LESSONS;
  }

  private explain(frame: CoachFrame, gestureDone: boolean): void {
    const refusal = frame.refusals[0];
    if (refusal) {
      this.panel.showNotice(refusalNotice(refusal), frame.nowMs);
      return;
    }
    const trick =
      frame.stepId === null ? null : (TRAINER_LESSONS[frame.stepId] ?? null);
    if (!gestureDone || trick === null) return;
    const text = rechargeNotice(
      trick,
      rechargeLeftMs(frame.controlBefore, trick),
    );
    if (text !== null) this.panel.showNotice(text, frame.nowMs);
  }
}
