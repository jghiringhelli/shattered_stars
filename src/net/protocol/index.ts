/**
 * Shared wire protocol of the online relay (imported by the client and by
 * server/src). Pure: no browser or Node APIs.
 */

export * from "./version";
export * from "./limits";
export * from "./messages";
export * from "./codec";
export * from "./timing";
export * from "./teamFactions";
export {
  validateClientMessage,
  readLoadout,
  readTickInput,
  MAX_TICK,
  type Validated,
} from "./validateClient";
