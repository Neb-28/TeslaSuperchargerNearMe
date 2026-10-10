# TeslaSuperchargerNearMe.com

Mobile-first web app for EV drivers searching "Supercharger near me": find nearby Superchargers on an OpenStreetMap map, then see what's within walking distance while charging. Revenue comes from featured #1 listings, lead generation, ads and affiliate links.

## Read first

- `docs/PRD.md` is the source of truth for features, screens, data model, API routes and acceptance criteria.
- `design/` holds the approved screen designs (Home, Map, Station page). Match their layout, copy, spacing and colors.
- `reference/near-me-map.html` is a working prototype of the map: Overpass queries for stations and nearby places, distance sorting, walking times.

## Rules

- Build one milestone at a time (M1 to M4 in the PRD). Stop and summarize when a milestone is done.
- Use only the design tokens listed in the PRD's Design system section. No other colors or fonts.
- Server-render every page. Home and station pages must show their text without JavaScript.
- Load the map library only on the Map screen.
- Never call the public Overpass server from visitor requests; visitors read from our own database, filled by the nightly import job.
- Never use tile.openstreetmap.org in production; the tile URL comes from an environment variable.
- Every map and station page shows "© OpenStreetMap contributors". Every page shows "Not affiliated with Tesla, Inc.".
- Every paid placement and the lead card are labeled "Sponsored".
- Keep secrets in environment variables (`.env.local`, never committed). Add each new variable to `.env.example`.
- Touch targets at least 44 px; text contrast at least 4.5:1; real `<button>`, `<a>`, `<input>` and `<label>` elements.
- Write tests for API routes and for the listing order rule (featured first, then free places by walk time). Run them before each commit.

## Stack

Next.js (App Router) with TypeScript, Tailwind CSS, Postgres with PostGIS, Leaflet or MapLibre GL, Stripe Checkout and Billing. Hosting on Vercel (or similar) with managed Postgres (Supabase or Neon).
