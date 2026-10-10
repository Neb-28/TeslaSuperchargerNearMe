# Design files

These are the approved screens, exported from the design canvas. Each file is one screen at phone width (390 px):

- `Home.dc.html` — landing page from Google: logo, headline, search, Near me / Map / Favorites.
- `Map.dc.html` — Near me map: search pill, filter chips, station pins, location dot, bottom sheet of nearest stations.
- `StationPage.dc.html` — station card, "Save on your EV" lead card, "While you charge" tabs with the #1 featured listing, Get featured banner.

The files use a design-canvas runtime (`support.js`, `<x-dc>`, `<sc-for>`, `<sc-if>`), so they will not open as normal web pages. Read them as a spec: the inline styles give exact sizes, colors, radii and spacing, and the script block at the bottom of each file holds the sample data and the interaction logic (tabs, filters, featured-first ordering).

Sample businesses, stations and numbers in these files are placeholders.
