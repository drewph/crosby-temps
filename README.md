# Crosby Temperatures

A small static site that lists the last week of max/min daily temperatures for Crosby, Isle of Man using the Open-Meteo API. It now also shows the current moon phase and the next full moon using the U.S. Naval Observatory moon phases API for exact next full moon dates, with a local calculation fallback if the moon API is unavailable.

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

The site is configured for GitHub Pages with the base path `/crosby-temps/` and will be available at `https://<github-username>.github.io/crosby-temps/` after deployment.
