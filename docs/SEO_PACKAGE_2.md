# SEO Package 2 (Crawlable Landing Pages)

## Scope
- Added two crawlable evergreen landing pages:
  - `/discover/mood-films/`
  - `/discover/director-deep-dives/`
- Added `Movie`-oriented JSON-LD to both pages.
- Added internal links from the authenticated homepage showcase and footer.
- Updated sitemap to include both new pages.
- Extended root `WebSite` schema with `hasPart` references.

## Added Files
- `public/discover/styles.css`
- `public/discover/mood-films/index.html`
- `public/discover/director-deep-dives/index.html`

## Updated Files
- `src/App.tsx` (homepage internal links to evergreen pages)
- `src/components/InfoFooter.tsx` (persistent footer links to evergreen pages)
- `public/sitemap.xml` (new URL entries)
- `index.html` (`hasPart` structured data links)

## Expected Outcome
- Search engines can discover and crawl non-hash content pages.
- Internal link graph from core app pages to SEO landing pages improves discoverability.
- Landing pages can rank for intent clusters ("best films by mood", "director deep dives").
