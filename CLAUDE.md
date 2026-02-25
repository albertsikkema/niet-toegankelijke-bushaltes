# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project visualizes **inaccessible bus stops in the Netherlands** and helps citizens email responsible authorities (wegbeheerders) to request accessibility improvements. It combines data from the DOVA Halteviewer API (Centraal Halte Bestand), the Allmanak government contact API, and PDOK/ArcGIS boundary services.

Three components work together:
1. **Data pipeline** (`pipeline/fetch-data.js`) — fetches live data from DOVA + Allmanak + PDOK, outputs `docs/data/bus-stops.json` and boundary GeoJSON files
2. **Web application** (`docs/`) — GitHub Pages static site with map, sidebar, email composer, and informational pages
3. **API collection** (`api_tools/`) — Bruno API request definitions for exploring the DOVA Sherpa API

## Running the Pipeline

```bash
node pipeline/fetch-data.js
```

Requires Node 18+ (uses built-in `fetch`). Fetches all quays from DOVA, filters to non-fully-accessible Dutch bus stops (wheelchair or visually inaccessible), enriches with authority contact info from Allmanak, downloads administrative boundary geometries, and writes output to `docs/data/`.

## Serving the Web App Locally

The `docs/` folder is a static site (deployed via GitHub Pages). Serve it with any static server:

```bash
npx serve docs
```

The app loads `data/bus-stops.json` at startup. If missing, run the pipeline first.

## Architecture

### Data Pipeline (`pipeline/fetch-data.js`)

Single-file Node.js script, no dependencies. Runs these steps:
1. POST to DOVA `getQuays` → filter to active Dutch bus quays with `quaydisabledaccessible === false` OR `quayvisuallyaccessible === false`
2. Fetch gemeenten, provincies, waterschappen, and Rijkswaterstaat contact info from Allmanak REST API in parallel
3. Map DOVA `quayownercode` to Allmanak keys (e.g., `G0737` → `gm0737`, `P0021` → `pv21`)
4. Handle merged gemeenten via `GEMEENTE_REMAP` lookup table
5. Resolve concession provider names from a static `knownProviders` map
6. Convert coordinates from EPSG:3857 (Web Mercator) to WGS84 via `toWgs84()`
7. Fetch administrative boundary geometries from PDOK and ArcGIS, save as individual GeoJSON files in `docs/data/boundaries/`
8. Write enriched JSON to `docs/data/bus-stops.json`

### Web App (`docs/`)

Vanilla JS, no build step. Five modules loaded as global singletons via `<script>` tags (order matters):

| File | Module | Role |
|------|--------|------|
| `js/theme.js` | `Theme` | Dark/light theme toggle, OS preference detection, localStorage persistence, dispatches `themechange` events |
| `js/email.js` | `Email` | Generates Dutch formal email templates, manages compose modal, mailto/clipboard, toast notifications, focus trapping |
| `js/map.js` | `MapView` | Leaflet + MarkerCluster, circle markers with compass chevrons, popups with accessibility icons, authority boundary overlays, theme-aware tiles |
| `js/sidebar.js` | `Sidebar` | Authority list sorted by inaccessible count, search filter, detail drill-down, scroll indicators, keyboard navigation |
| `js/app.js` | (IIFE) | Entry point: fetches `bus-stops.json`, wires up all modules, manages info/welcome modals |

Script load order: `theme.js` → `email.js` → `map.js` → `sidebar.js` → `app.js` (each later module may reference earlier ones).

Additional pages:
- `feiten.html` — facts and statistics page with tables of worst/best-performing municipalities, data quality section
- `eisen.html` — accessibility requirements page explaining CROW standards (perron height, width, guidance lines, etc.)

External dependencies (loaded from CDN): Leaflet 1.9.4, Leaflet.markercluster 1.5.3, CARTO Voyager tiles.

### Data Shape (`docs/data/bus-stops.json`)

```
{
  generated: "ISO timestamp",
  totals: { totalBusQuays, inaccessibleBusQuays, authorities },
  authorities: {
    [ownerCode]: {
      type, name, email, website, phone,
      totalBusQuays, inaccessibleCount,
      stops: [{ code, name, town, street, lat, lon, shelter,
                wheelchairAccessible, visuallyAccessible,
                compassDirection, mutationDate, concessionProvider }]
    }
  },
  concessionProviders: { [code]: { name, email, website } }
}
```

Boundary files are stored as `docs/data/boundaries/{ownerCode}.json` (GeoJSON).

## API Protocol (DOVA Halteviewer)

The API uses **Sherpa** (JSON-RPC over HTTP, version 0). All endpoints use **HTTP POST** with body `{"params": [...]}`, except `sherpa.json` which is GET. Base URL: `https://halteviewer.ov-data.nl/halteviewer/`

## Key Conventions

- **Language:** UI text and email templates are in Dutch. "niet toegankelijk" = not accessible, "wegbeheerder" = road manager, "bushalte" = bus stop
- **Identifier formats:** `NL:S:{code}` (stations), `NL:Q:{code}` (quays)
- **Owner codes:** `G{nnnn}` = gemeente, `P{nnnn}` = provincie, `W{nnnn}` = waterschap, `RWS` = Rijkswaterstaat
- **Coordinate systems:** DOVA API returns EPSG:3857; `bus-stops.json` and the web app use WGS84 (lat/lon)
- **Authority types:** `gemeente`, `provincie`, `waterschap`, `rijkswaterstaat`, `privaat` (private managers don't get the email feature)
- **Accessibility tracking:** Stops are included if either `quaydisabledaccessible` (wheelchair) or `quayvisuallyaccessible` (visual) is `false`
- **Theme system:** `Theme` module dispatches `themechange` CustomEvents; other modules (notably `MapView`) listen to update tile layers
- **Analytics:** Privacy-friendly Umami analytics (no cookies, no trackers)
- **Bruno collection:** Open `api_tools/` with [Bruno](https://www.usebruno.com/). YML `seq:` fields control display order. Environment var `baseUrl` is set in `environments/production.yml`
