import { describe, expect, it } from "vitest";
import {
  MIN_TEXT_PX,
  holoFont,
  holoFontFromCss,
} from "../../../../src/ui/theme/holoFont";

describe("minimum text size", () => {
  it("raises tiny sizes to the 12 px floor", () => {
    expect(MIN_TEXT_PX).toBe(12);
    expect(holoFont(9).fontSize).toBe("12px");
    expect(holoFont(11).fontSize).toBe("12px");
  });

  it("keeps sizes at or above the floor unchanged", () => {
    expect(holoFont(12).fontSize).toBe("12px");
    expect(holoFont(18).fontSize).toBe("18px");
  });

  it("applies the floor to legacy CSS shorthands too", () => {
    expect(holoFontFromCss("bold 10px Arial").fontSize).toBe("12px");
  });
});
