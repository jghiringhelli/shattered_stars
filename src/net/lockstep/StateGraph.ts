/**
 * StateGraph — snapshot and restore of a battle scene's simulation objects
 * for lockstep resyncs: `captureGraph` on the authority, `restoreGraph` on
 * the client that jumps to it. See stateGraphCapture / stateGraphRestore.
 */

export { captureGraph } from "./stateGraphCapture";
export { restoreGraph, type RestoreResult } from "./stateGraphRestore";
export type { ClassRef, GraphOptions } from "./stateGraphTypes";
