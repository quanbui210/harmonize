# TulliCheck

## Landing Page Animations & Performance Budget

### Animation Asset List
- Hero gradient loop: CSS-only (`heroFloat`, 6s loop)
- Section fade-up: IntersectionObserver + CSS (`ScrollAnimation`, 0.6s duration, 0.2s stagger)
- Headline SVG morph: GSAP 3 (dynamically imported, runs once per session, disabled for prefers-reduced-motion)
- Parallax layers: requestAnimationFrame scroll transform (translateY only, disabled for prefers-reduced-motion)
- Rulings teaser auto-scroll: CSS-only keyframes
- Magnetic CTA: lightweight pointer-driven transform (disabled for prefers-reduced-motion)

### Performance Budget
- Hero background: 0 external images/assets (CSS gradients only)
- Rulings preview calls: no network until user interaction; teaser fetch scheduled during idle time
- Search requests: debounced 300ms; results capped to 12 per request

## Adding New Ruling Cards (via Admin / Ingestion)

The landing page “Live BTI Rulings” and teaser card are backed by the BTI rulings stored in the database.

- Bulk import: use the Admin ingestion flow for BTI rulings (CSV ingestion) to add many rulings at once.
- Manual entry: use the Admin rulings form to add or correct a single ruling.
- After new rulings are ingested, they become discoverable automatically via the `/api/rulings` endpoint used by the landing page.

