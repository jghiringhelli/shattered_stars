import { parseAnalogTune } from "../../src/core/analogTuning";
import {
  setDefaultArenaAnalogTuning,
  setDefaultArenaSteering,
} from "../../src/simulation/skill/ArenaSteering";

/**
 * `SKILL_STEERING=analog npm run test:skill` runs every skill gate with the
 * analog turn key instead of the templates (default: template).
 * `SKILL_ANALOG_TUNE=bank:60,hold:250` (see parseAnalogTune) runs the analog
 * gates with that tuning instead of the engine's default.
 */
setDefaultArenaSteering(
  process.env.SKILL_STEERING === "analog" ? "analog" : "template",
);
if (process.env.SKILL_ANALOG_TUNE)
  setDefaultArenaAnalogTuning(parseAnalogTune(process.env.SKILL_ANALOG_TUNE));
