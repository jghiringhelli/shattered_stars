import { describe, expect, it } from "vitest";
import { extractReleaseNotes } from "../../../scripts/lib/changelog";

const CHANGELOG = `# Changelog

## [Unreleased]

### Added
- Something upcoming

## [0.2.0-beta.1] - 2026-10-15

### Added
- Lazy scenes

### Fixed
- A crash

## [0.1.0] - 2026-03-01

### Added
- First playable

[Unreleased]: https://example.com/compare/v0.2.0-beta.1...HEAD
`;

describe("extractReleaseNotes", () => {
  it("returns_the_body_of_the_requested_version_only", () => {
    const notes = extractReleaseNotes(CHANGELOG, "0.2.0-beta.1");
    expect(notes).toContain("- Lazy scenes");
    expect(notes).toContain("- A crash");
    expect(notes).not.toContain("First playable");
    expect(notes).not.toContain("upcoming");
  });

  it("returns_the_last_section_without_trailing_link_definitions", () => {
    const notes = extractReleaseNotes(CHANGELOG, "0.1.0");
    expect(notes).toBe("### Added\n- First playable");
  });

  it("returns_undefined_for_an_unknown_version", () => {
    expect(extractReleaseNotes(CHANGELOG, "9.9.9")).toBeUndefined();
  });

  it("returns_undefined_for_an_empty_section", () => {
    expect(extractReleaseNotes("## [1.0.0]\n\n## [0.9.0]\nx", "1.0.0")).toBeUndefined();
  });

  it("handles_crlf_files", () => {
    expect(extractReleaseNotes(CHANGELOG.replace(/\n/g, "\r\n"), "0.1.0")).toBe("### Added\n- First playable");
  });
});
