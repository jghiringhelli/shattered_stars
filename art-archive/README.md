# art-archive

Art that is kept in git but **not shipped** with the game. Everything here
used to live under `public/assets/` and was copied into every build, but no
code or data loads it. Moving it out cut ~52 MB from `dist/`.

The folder mirrors the old public path: `art-archive/assets/<x>` was
`public/assets/<x>`.

| Folder | What it is |
|---|---|
| `assets/portraits/<faction>/<pilot>.png`, `<pilot>_talk.png` | Source frames for the portrait sheets (`*_sheet.png` in `public/`) |
| `assets/rotations/`, `assets/spritesheets/`, `assets/atlases/`, `assets/ships_pixel/`, `assets/effects/` | Old outputs of `scripts/create_game_sprites.py` |
| `assets/symbols/` | Old outputs of `scripts/generate_sprites.py` |
| `assets/monsters/`, `assets/bosses/` | Old outputs of `scripts/generate_monster_sprites.py` |
| `assets/ships_backup/`, `assets/ships_regen/` | Earlier ship sprite generations |
| `assets/generated/` | SVG placeholders |
| `assets/backgrounds/planet_ice.png` | A backdrop no scene uses |

## Re-auditing

```bash
npx tsx scripts/audit_assets.ts          # report unreferenced files in public/assets
npx tsx scripts/audit_assets.ts --list   # ...and list them
npx tsx scripts/audit_assets.ts --move   # move them here
```

The audit counts a file as used when it is in the asset manifest
(`src/assets/assetManifest.ts`, expanded over every ship, faction and pilot)
or when any quoted `assets/...` string in `src/` or `index.html` matches it.
Templates such as `${faction}` count as wildcards, so those checks err on the
side of keeping a file. Audio is never moved.

To bring something back, move it to `public/` and reference it from the
manifest (or from code).
