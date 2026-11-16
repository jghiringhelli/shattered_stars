/**
 * Dev-only override of the analog steering tuning: `?analogTune=bank:60,hold:250`
 * (see parseAnalogTune in src/core/analogTuning for the keys). Installed by
 * main.ts in dev builds only; never persisted, never read online (online
 * battles fly the template engine).
 */

import { parseAnalogTune } from "../core/analogTuning";
import { setAnalogTuningOverride } from "../arcade/systems/SteeringMode";

/**
 * @param search - The page's query string.
 * @returns Whether an override was found and applied (a bad one is reported and ignored).
 */
export function installAnalogTuneOverride(search: string): boolean {
  const text = new URLSearchParams(search).get("analogTune");
  if (text === null) return false;
  try {
    setAnalogTuningOverride(parseAnalogTune(text));
    return true;
  } catch (error) {
    console.warn(`analogTune ignored: ${(error as Error).message}`);
    return false;
  }
}
