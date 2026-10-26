# Handover

Last updated: 2026-10-26

## Live

- https://drewph.github.io/crosby-temps/ — deployed from `main` by GitHub Actions.
- Views: List (7/30/60 days), Calendar, Year (1940–current), with a day sheet on every square.
- Snapshots: 2025 = 365 days; 2026 = 298 days (1 Jan – 25 Oct).
- 70 tests. Typecheck and a post-deploy smoke test run in CI.

## Open items

1. **Schedule experiment review (27–30 Oct).** Follow `docs/SCHEDULE-EXPERIMENT.md`. At review, implement exactly one: **S** (keep the useful early probe, switch views to the frozen snapshot) or **P** (single 06:15 cron, snapshot plus a provisional live tail). Do not ship both. Review on 30 Oct evening, or 31 Oct if the last probe is delayed.
2. Optional: print/PDF colour legend for yarn shopping.
3. Optional: mobile moon-card layout; stronger smoke test comparing the deployed asset hash.

## Decisions

- Freeze on first write; never overwrite. The snapshot is the authoritative record.
- Use Open-Meteo gridded data, not Ronaldsway station data. No bias correction.
- 2 °C bands, 16 colours. Outer = max, inner = min. The physical proportions are illustrative; the crocheter chooses the pattern.
- Snapshots live in `public/data/<year>.json`; years without one use the archive.
- Session handover lives in the repo: public `AGENTS.md` plus auto-loaded `docs/HANDOVER.md`; private notes stay in `docs/private/` (gitignored). Update it at checkpoints, not only at session end.
- Do not merge PRs on the user's behalf.

## Data checks (2026-10-26)

- Snapshot vs Open-Meteo archive: exact match — 2025 365/365 and 2026 298/298 (to 25 Oct).
- 25 Oct was recorded as 10.2 / 8.4 °C; the API returned the same values at creation time.
- DST days (March/October 2025 and 2026): hourly aggregation vs daily API within 0.1 °C.
- Ronaldsway station comparison, 2025 (236 usable days): max bias +0.40 °C, MAE 0.74; min bias +0.94 °C, MAE 1.10. 99% / 92% within 2 °C.
- Band sensitivity vs that station: 46% of max/min measurements flip, 72% of days have at least one flip; 97% of flips are one band.

## Pipeline

- `.github/workflows/deploy.yml` triggers on push to `main`, four schedule probes at 00:15/02:15/04:15/06:15 UTC (experiment 27–30 Oct; see `docs/SCHEDULE-EXPERIMENT.md`), and `workflow_dispatch` with an optional `year`.
- The first scheduled run (#41) fired at 13:02 UTC on 26 Oct, ~6h47 after the 06:15 slot, and completed every step including the bot commit, deploy and smoke test.
- The snapshot step runs on non-push events, commits `public/data` as `github-actions[bot]`, then builds and deploys in the same run (a `GITHUB_TOKEN` push does not retrigger workflows).
- Workflow permissions: `contents: write` on build; `pages: write` and `id-token: write` on deploy. The repository default is read-only; YAML grants elevate it.
- `node scripts/snapshot.mjs` fetches 1 January → yesterday (or a `--year`), adding only missing dates.

## Gotchas

- Vite base is `/crosby-temps/`; asset and snapshot URLs use `import.meta.env.BASE_URL`.
- In dev, a missing snapshot returns `index.html` with status 200; the loader checks `content-type` before parsing.
- `getYesterday()` is timezone-aware; every view intentionally ends yesterday.
- Year-view CSS is scoped with `#year-view`; empty cells are hidden to keep the patchwork readable.
- CI uses Node 24 and `npm ci`; keep `package-lock.json` committed.
- Cron is best-effort: run #41 was ~6h47 late. A late run is harmless; the job is idempotent and backfills missing dates.
- The extra schedule slots are a temporary experiment (review 30 Oct). Remove them if they do not make the snapshot reliably available before ~08:00 BST.
- An early run can freeze a more preliminary value; monitor the snapshot against the API for revisions.
- The experiment procedure and the S/P decision rule live in `docs/SCHEDULE-EXPERIMENT.md`; implement exactly one branch at review.
- The public handover must stay sanitized: no secrets, tokens, personal data, absolute paths or session IDs.
- `/handover` and the `session-handover` skill are project-scoped; run OpenCode from the repository.

## Recent

- 2026-10-26: schedule probes (00:15/02:15/04:15/06:15 UTC) and the S/P analysis plan (`docs/SCHEDULE-EXPERIMENT.md`); review 30 Oct.
- 2026-10-26: scheduled run #41 succeeded (fired 13:02 UTC, ~6h47 late), added 25 Oct as 10.2 / 8.4 (commit 9993370); handover system merged (PR #38, 750bb37).
- 2026-10-25: durable handover system — AGENTS.md, auto-loaded `docs/HANDOVER.md`, `/handover` command and `session-handover` skill (PR #38, b38f1f9).
- 2026-10-25: accessible dialog, live-region cleanup, noscript (PR #37); housekeeping — attribution, CI typecheck/lockfile/smoke test, favicon, contrast (PR #36); year view (PR #35); daily snapshot pipeline (PR #34).
- 2026-10-24: data freshness, timeouts and missing-day notice (PR #30); calendar squares (PR #32, #33); local moon calculation (PR #29); colour legend (PR #28); logo 1.6 MB → 42 KB (PR #31).
