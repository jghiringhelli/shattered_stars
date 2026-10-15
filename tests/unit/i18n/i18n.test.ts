import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CATALOGS,
  createTranslator,
  interpolate,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "../../../src/i18n/translator";
import { EN_MESSAGES, type MessageKey } from "../../../src/i18n/messages.en";
import { getLocale, initLocale, resetLocale, setLocale, t } from "../../../src/i18n";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "i18n" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Keys passed as a string literal to `t("...")` anywhere in src (outside src/i18n). */
function usedKeys(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of sourceFiles("src")) {
    for (const match of readFileSync(file, "utf8").matchAll(/(?<![\w.])t\(\s*"([a-zA-Z0-9.]+)"/g)) {
      used.set(match[1]!, file);
    }
  }
  return used;
}

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("message catalog", () => {
  it("has_every_key_used_by_a_t_call", () => {
    const missing = [...usedKeys()].filter(([key]) => !(key in EN_MESSAGES)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });

  it("has_no_key_that_nothing_uses", () => {
    // A key may be referenced by a typed table (`readonly MessageKey[]`) instead of a direct t("…") call.
    const source = sourceFiles("src").map((file) => readFileSync(file, "utf8")).join("\n");
    const orphans = Object.keys(EN_MESSAGES).filter((key) => !source.includes(`"${key}"`));
    expect(orphans).toEqual([]);
  });

  it("uses_lower_case_dotted_keys_and_never_empty_text", () => {
    for (const [key, text] of Object.entries(EN_MESSAGES)) {
      expect(key).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("keeps_the_placeholders_of_every_translation_identical_to_english", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const [key, text] of Object.entries(CATALOGS[locale] ?? {})) {
        expect(placeholders(text), `${locale}:${key}`).toEqual(placeholders(EN_MESSAGES[key as MessageKey]));
      }
    }
  });
});

describe("translator", () => {
  it("fills_placeholders", () => {
    expect(interpolate("Saved {fileName}.", { fileName: "a.json" })).toBe("Saved a.json.");
  });

  it("leaves_an_unknown_placeholder_visible", () => {
    expect(interpolate("Hi {who}", {})).toBe("Hi {who}");
  });

  it("falls_back_to_english_for_a_key_missing_in_the_locale", () => {
    const translator = createTranslator("en", { en: {} });
    expect(translator.t("common.close")).toBe("CLOSE");
  });

  it("prefers_the_locale_catalog", () => {
    const translator = createTranslator("en", { en: { "common.close": "CERRAR" } });
    expect(translator.t("common.close")).toBe("CERRAR");
  });

  it("interpolates_typed_params", () => {
    expect(createTranslator("en").t("feedback.status.saved", { fileName: "f.json", trimmed: "" })).toBe(
      "Saved f.json.",
    );
  });
});

describe("resolveLocale", () => {
  it("picks_the_first_supported_candidate", () => {
    expect(resolveLocale(["fr-FR", "en-GB"])).toBe("en");
  });

  it("matches_on_the_primary_subtag_case_insensitively", () => {
    expect(resolveLocale(["EN_us"])).toBe("en");
  });

  it("falls_back_to_the_source_locale", () => {
    expect(resolveLocale([null, undefined, "ja"])).toBe("en");
  });

  it("honours_a_wider_supported_list", () => {
    expect(resolveLocale(["es-MX", "en"], ["es" as never, "en"])).toBe("es");
  });
});

describe("active locale", () => {
  afterEach(resetLocale);

  it("defaults_to_english_and_translates_through_t", () => {
    expect(getLocale()).toBe("en");
    expect(t("welcome.action.play")).toBe("LET ME PLAY");
  });

  it("setLocale_changes_the_reported_locale", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
  });

  it("initLocale_reads_the_lang_query_then_browser_languages_and_sets_html_lang", () => {
    const documentElement = { lang: "" };
    const locale = initLocale({
      navigator: { languages: ["de-DE", "en-US"] },
      location: { search: "?lang=xx" },
      document: { documentElement },
    });
    expect(locale).toBe("en");
    expect(documentElement.lang).toBe("en");
  });
});
