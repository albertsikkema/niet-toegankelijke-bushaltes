# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an API collection and data analysis repository for the **DOVA Halteviewer API** (`https://halteviewer.ov-data.nl/halteviewer/`), which serves Dutch public transit station infrastructure data. There is no application source code, build system, or tests — the repository contains Bruno API request definitions and pre-fetched data snapshots.

## Repository Structure

- **`api_tools/`** — Bruno API collection (open with [Bruno](https://www.usebruno.com/))
  - `System/` — Health check, self-documentation, service descriptor
  - `Stations/` — Station lookup, search, bounding box queries, topology
  - `Quays/` — Platform/stop listing, detail, authority-based queries
  - `Equipment/` — Lift/escalator status monitoring (real-time)
  - `Navigation/` — Entrances, access spaces, navigable path links
- **`data/`** — Pre-fetched API responses and analysis
  - `api-documentation.md` — Full documentation of all 22 endpoints
  - `analysis-summary.md` — Statistical analysis of the data
  - `stations.json`, `equipment-status.json` — Raw data snapshots
  - `analysis-stats.json`, `sherpa-docs.json` — Structured metadata

## API Protocol

The API uses **Sherpa** (JSON-RPC over HTTP, version 0). All endpoints use **HTTP POST** with body `{"params": [...]}`, except `sherpa.json` which is GET. Base URL: `https://halteviewer.ov-data.nl/halteviewer/`

## Domain Model

```
Station (Stopplace)         NL:S:{code}
 ├── Quays                  NL:Q:{code}     — platforms/stops
 ├── TopoQuays                              — topological layout with geometry
 ├── Entrances                              — entry points with accessibility info
 ├── AccessSpaces                           — tunnels, halls, overpasses
 ├── Equipment                              — lifts, escalators (real-time status)
 ├── Facilities                             — named station facilities
 └── NavPathLinks                           — navigable routes between components
```

## Key Conventions

- **Identifier formats:** `NL:S:{code}` (stations), `NL:Q:{code}` (quays), `NL:P:{code}` (places)
- **Equipment foreign codes:** `{STATION}-{TYPE}-{SEQ}` (e.g., `ASD-LIF-001`)
- **Coordinate systems:** EPSG:3857 (Web Mercator, API primary), EPSG:28992 (Dutch RD New), EPSG:4326 (WGS84, used in data files)
- **YML request files** use `seq:` fields to control display order in Bruno
- **Dutch language** appears in data values (e.g., "buiten gebruik" = out of service, "Toegankelijk" = accessible)
- `.env` files must not be committed (per `.gitignore`)
