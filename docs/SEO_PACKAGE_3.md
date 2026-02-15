# SEO Package 3 (Landing Expansion + Structured Data Sync)

## Scope
- Added third crawlable evergreen landing page:
  - `/discover/daily-curated-picks/`
- Updated root `WebSite` JSON-LD `hasPart` list to include new page.
- Updated sitemap for new page discovery.
- Expanded in-app internal links to include the new landing page.
- Normalized Daily Showcase `ItemList` schema URL to `https://schema.org/...`.

## Added Files
- `public/discover/daily-curated-picks/index.html`

## Updated Files
- `index.html`
- `public/sitemap.xml`
- `src/App.tsx`
- `src/components/InfoFooter.tsx`
- `src/features/daily-showcase/DailyShowcase.tsx`
- `README.md`

## Expected Outcome
- Improved crawl coverage for planned intent clusters.
- Stronger internal link graph from app surfaces to evergreen SEO pages.
- Cleaner schema consistency for search parsing and rich result eligibility.
