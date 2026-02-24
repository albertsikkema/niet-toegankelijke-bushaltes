# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project visualizes **inaccessible bus stops in the Netherlands** and helps citizens email responsible authorities (wegbeheerders) to request accessibility improvements. It combines data from the DOVA Halteviewer API (Centraal Halte Bestand) and the Allmanak government contact API.

Three components work together:
1. **Data pipeline** (`pipeline/fetch-data.js`) — fetches live data from DOVA + Allmanak, outputs `docs/data/bus-stops.json`
2. **Web application** (`docs/`) — GitHub Pages static site with map, sidebar, and email composer
3. **API collection** (`api_tools/`) — Bruno API request definitions for exploring the DOVA Sherpa API

## Running the Pipeline

```bash
node pipeline/fetch-data.js
```

Requires Node 18+ (uses built-in `fetch`). Fetches all quays from DOVA, filters to inaccessible Dutch bus stops, enriches with authority contact info from Allmanak, and writes `docs/data/bus-stops.json`.

## Serving the Web App Locally

The `docs/` folder is a static site (deployed via GitHub Pages). Serve it with any static server:

```bash
npx serve docs
```

The app loads `data/bus-stops.json` at startup. If missing, run the pipeline first.

## Architecture

### Data Pipeline (`pipeline/fetch-data.js`)

Single-file Node.js script, no dependencies. Runs these steps:
1. POST to DOVA `getQuays` → filter to active Dutch bus quays with `quaydisabledaccessible === false`
2. Fetch gemeenten, provincies, waterschappen, and Rijkswaterstaat contact info from Allmanak REST API in parallel
3. Map DOVA `quayownercode` to Allmanak keys (e.g., `G0737` → `gm0737`, `P0021` → `pv21`)
4. Handle merged gemeenten via `GEMEENTE_REMAP` lookup table
5. Resolve concession provider names from a static `knownProviders` map
6. Convert coordinates from EPSG:3857 (Web Mercator) to WGS84 via `toWgs84()`
7. Write enriched JSON to `docs/data/bus-stops.json`

### Web App (`docs/`)

Vanilla JS, no build step. Four modules loaded as global singletons via `<script>` tags (order matters):

| File | Module | Role |
|------|--------|------|
| `js/email.js` | `Email` | Generates Dutch formal email templates, manages compose modal, mailto/clipboard |
| `js/map.js` | `MapView` | Leaflet + MarkerCluster, red circle markers, popups with stop details |
| `js/sidebar.js` | `Sidebar` | Authority list sorted by inaccessible count, search filter, detail drill-down |
| `js/app.js` | (IIFE) | Entry point: fetches `bus-stops.json`, wires up `Email`, `MapView`, `Sidebar`, info modal |

Script load order: `email.js` → `map.js` → `sidebar.js` → `app.js` (each later module may reference earlier ones).

External dependencies (loaded from CDN): Leaflet 1.9.4, Leaflet.markercluster 1.5.3, CARTO Voyager tiles.

### Data Shape (`docs/data/bus-stops.json`)

```
{
  totals: { totalBusQuays, inaccessibleBusQuays, authorities },
  authorities: {
    [ownerCode]: {
      type, name, email, website, phone,
      totalBusQuays, inaccessibleCount,
      stops: [{ code, name, town, street, lat, lon, shelter, concessionProvider }]
    }
  },
  concessionProviders: { [code]: { name, email, website } }
}
```

## API Protocol (DOVA Halteviewer)

The API uses **Sherpa** (JSON-RPC over HTTP, version 0). All endpoints use **HTTP POST** with body `{"params": [...]}`, except `sherpa.json` which is GET. Base URL: `https://halteviewer.ov-data.nl/halteviewer/`

## Key Conventions

- **Language:** UI text and email templates are in Dutch. "niet toegankelijk" = not accessible, "wegbeheerder" = road manager, "bushalte" = bus stop
- **Identifier formats:** `NL:S:{code}` (stations), `NL:Q:{code}` (quays)
- **Owner codes:** `G{nnnn}` = gemeente, `P{nnnn}` = provincie, `W{nnnn}` = waterschap, `RWS` = Rijkswaterstaat
- **Coordinate systems:** DOVA API returns EPSG:3857; `bus-stops.json` and the web app use WGS84 (lat/lon)
- **Authority types:** `gemeente`, `provincie`, `waterschap`, `rijkswaterstaat`, `privaat` (private managers don't get the email feature)
- **Bruno collection:** Open `api_tools/` with [Bruno](https://www.usebruno.com/). YML `seq:` fields control display order. Environment var `baseUrl` is set in `environments/production.yml`
