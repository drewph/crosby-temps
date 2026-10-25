# Crosby Temperatures

A small static site that lists the last week of max/min daily temperatures for Crosby, Isle of Man using the Open-Meteo API. It also shows the current moon phase and the next full moon, calculated locally from the lunar cycle.

## Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Run tests:

   ```bash
   npm test
   ```

4. Build for production:

   ```bash
   npm run build
   ```

## Daily data snapshot

The site itself reads Open-Meteo live, but `public/data/<year>.json` keeps a frozen
record of each day's max/min temperature so past squares stay stable when the
reanalysis data is revised.

- A scheduled workflow runs at 06:15 UTC, records yesterday, commits the file
  and deploys. It only fills dates that are missing; it never overwrites one.
- Run it locally with `node scripts/snapshot.mjs`.
- Backfill an earlier year from the Actions tab with **Run workflow** and a
  `year` input (1940 or later), or locally with
  `node scripts/snapshot.mjs --year=2025`.
- Stored values are the raw one-decimal readings; rounding and colour bands are
  applied when rendering.

The site is configured for GitHub Pages with the base path `/crosby-temps/` and will be available at `https://<github-username>.github.io/crosby-temps/` after deployment.
