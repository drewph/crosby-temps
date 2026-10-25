# Handover

Last updated: 2026-10-25

## Live

- https://drewph.github.io/crosby-temps/ — deployed from `main` by GitHub Actions.
- Views: List (7/30/60 days), Calendar, Year (1940–current), with a day sheet on every square.
- Snapshots: 2025 = 365 days; 2026 = 297 days (1 Jan – 24 Oct).
- 70 tests. Typecheck, actionlint and a post-deploy smoke test run in CI.

## Open items

1. **Merge PR #38** (`docs/handover`): AGENTS.md, the auto-loaded handover, `/handover` and the `session-handover` skill. Until it merges, new sessions only see these files when run from this working tree.
2. **Confirm the 06:15 UTC schedule fires.** As of 2026-10-25 13:30 UTC there are zero runs with event `schedule`. Push and `workflow_dispatch` work. If it has still not fired tomorrow, add a fallback trigger before relying on frozen data.
3. **Unify List/Calendar with the snapshot** once the cron is proven. They currently read the live archive; Year reads the snapshot. Values match exactly today, but a revision would make the same date show different squares.
4. Optional: print/PDF colour legend for yarn shopping.
5. Optional: mobile moon-card layout; stronger smoke test comparing the deployed asset hash.

## Decisions

- Freeze on first write; never overwrite. The snapshot is the authoritative record.
- Use Open-Meteo gridded data, not Ronaldsway station data. No bias correction.
- 2 °C bands, 16 colours. Outer = max, inner = min. The physical proportions are illustrative; the crocheter chooses the pattern.
- Snapshots live in `public/data/<year>.json`; years without one use the archive.
- Session handover lives in the repo: public `AGENTS.md` plus auto-loaded `docs/HANDOVER.md`; private notes stay in `docs/private/` (gitignored). Update it at checkpoints, not only at session end.
- Do not merge PRs on the user's behalf.

## Data checks (2026-10-25)

- Snapshot vs Open-Meteo archive: exact match — 2025 365/365 and 2026 297/297.
- DST days (March/October 2025 and 2026): hourly aggregation vs daily API within 0.1 °C.
- Ronaldsway station comparison, 2025 (236 usable days): max bias +0.40 °C, MAE 0.74; min bias +0.94 °C, MAE 1.10. 99% / 92% within 2 °C.
- Band sensitivity vs that station: 46% of max/min measurements flip, 72% of days have at least one flip; 97% of flips are one band.

## Pipeline

- `.github/workflows/deploy.yml` triggers on push to `main`, schedule `15 6 * * *`, and `workflow_dispatch` with an optional `year`.
- The snapshot step runs on non-push events, commits `public/data` as `github-actions[bot]`, then builds and deploys in the same run (a `GITHUB_TOKEN` push does not retrigger workflows).
- Workflow permissions: `contents: write` on build; `pages: write` and `id-token: write` on deploy. The repository default is read-only; YAML grants elevate it.
- `node scripts/snapshot.mjs` fetches 1 January → yesterday (or a `--year`), adding only missing dates.

## Gotchas

- Vite base is `/crosby-temps/`; asset and snapshot URLs use `import.meta.env.BASE_URL`.
- In dev, a missing snapshot returns `index.html` with status 200; the loader checks `content-type` before parsing.
- `getYesterday()` is timezone-aware; every view intentionally ends yesterday.
- Year-view CSS is scoped with `#year-view`; empty cells are hidden to keep the patchwork readable.
- CI uses Node 24 and `npm ci`; keep `package-lock.json` committed.
- The public handover must stay sanitized: no secrets, tokens, personal data, absolute paths or session IDs.
- `/handover` and the `session-handover` skill are project-scoped; run OpenCode from the repository.

## Recent

- 2026-10-25: durable handover system — AGENTS.md, auto-loaded `docs/HANDOVER.md`, `/handover` command and `session-handover` skill (PR #38, b38f1f9).
- 2026-10-25: accessible dialog, live-region cleanup, noscript (PR #37); housekeeping — attribution, CI typecheck/lockfile/smoke test, favicon, contrast (PR #36); year view (PR #35); daily snapshot pipeline (PR #34).
- 2026-10-24: data freshness, timeouts and missing-day notice (PR #30); calendar squares (PR #32, #33); local moon calculation (PR #29); colour legend (PR #28); logo 1.6 MB → 42 KB (PR #31).
