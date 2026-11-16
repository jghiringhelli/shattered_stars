import { setDefaultArenaSteering } from "../../src/simulation/skill/ArenaSteering";

/**
 * `SKILL_STEERING=analog npm run test:skill` runs every skill gate with the
 * analog turn key instead of the templates (default: template).
 */
setDefaultArenaSteering(
  process.env.SKILL_STEERING === "analog" ? "analog" : "template",
);
