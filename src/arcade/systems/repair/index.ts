/**
 * Repair mechanic and repair event channel — public API.
 */

export {
  detectRepairs,
  MIN_REPAIR_AMOUNT,
  RepairEventError,
  type DurabilitySnapshot,
  type RepairEvent,
  type RepairKind,
  type RepairObservation,
  type RepairSource,
  type RepairSourceKind,
} from "./RepairEvents";
export {
  RepairEventChannel,
  REPAIR_PULSE_INTERVAL_MS,
  type RepairListener,
} from "./RepairEventChannel";
export {
  DamagePauseTracker,
  HULL_REPAIR_DAMAGE_PAUSE_MS,
  repairStep,
  type RepairStepInput,
} from "./HullRepair";
export { selfRepairProfile, type SelfRepairProfile } from "./SelfRepair";
