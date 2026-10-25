# Project instructions

## Start here

- Read `docs/HANDOVER.md` before changing data, CI, or deploy. It is also loaded automatically via `opencode.jsonc`.
- This repository is **public**. Never add secrets, tokens, credentials, personal data, absolute local paths, or session IDs.
- Private notes belong in `docs/private/` (gitignored).

## Commands

```sh
npm ci            # install exactly
npm run dev       # Vite dev server
npm run typecheck
npm test          # watch mode; use `npx vitest run` for one-shot
npm run build
node scripts/snapshot.mjs [--year=YYYY]
```

## Architecture

- Vanilla TypeScript + Vite, no framework. Rendering lives in `src/main.ts`; pure helpers in `src/utils/`.
- Static hosting on GitHub Pages: https://drewph.github.io/crosby-temps/, base path `/crosby-temps/`.
- `.github/workflows/deploy.yml`: push → typecheck/test/build/deploy; daily 06:15 UTC snapshot; manual `year` dispatch for backfills.
- Snapshots live in `public/data/<year>.json` (Vite copies `public/` to the site root).
- One square per day: outer ring = daily max, inner square = daily min. Palette: 16 bands of 2 °C in `src/utils/temperatureBands.ts`.

## Data rules

- The snapshot is the record. Freeze on first write; never overwrite a recorded date.
- The daily job adds missing dates only; missing days must stay visible in the UI, not silently dropped.
- Do not switch data source, bias-correct, or change band boundaries without recording the decision in `docs/HANDOVER.md`.
- List and Calendar currently use the live archive; Year uses the snapshot. Unification is an open item.

## Working style

- Branch per change; do not merge PRs. Keep commits scoped and explain why.
- Run typecheck, tests and build before pushing.
- Update `docs/HANDOVER.md` when a PR merges, a decision is made, or a work item completes — do not wait to be asked.
- At session end run `/handover`, or say "wrap up" to load the `session-handover` skill.
