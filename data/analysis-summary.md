# DOVA Halteviewer — Analysis Summary

**Data fetched:** 2026-02-24
**API version:** 2.10.2

## Overview

| Metric | Value |
|--------|-------|
| Total railway stations | 405 |
| Total monitored equipment (all lifts) | 446 |
| Stations with monitored equipment | 171 |
| Equipment currently monitored | 443 |
| Equipment suppliers | 3 (coded A, B, C) |

## Equipment Status (Real-time)

| Status | Count | % |
|--------|-------|---|
| ONLINE | 411 | 92.2% |
| Offline | 32 | 7.2% |
| Unknown/no status | 3 | 0.7% |
| Within scheduled announcement | 14 | 3.1% |

### Stations with Offline Equipment (27 stations)

| Station | Offline/Total |
|---------|---------------|
| Arnhem Centraal | 1/10 |
| Amsterdam Centraal | 1/15 |
| Diemen Zuid | 1/1 |
| Driehuis | 2/2 |
| Deventer Colmschate | 1/2 |
| Duivendrecht | 2/4 |
| Ede-Wageningen | 1/3 |
| Elst | 1/2 |
| Groningen | 2/5 |
| Haarlem Spaarnwoude | 2/3 |
| Helmond | 1/2 |
| Hoorn | 1/3 |
| Hilversum Mediapark | 1/3 |
| Halfweg-Zwanenburg | 2/2 |
| Meppel | 1/3 |
| Maastricht | 1/3 |
| Oisterwijk | 1/2 |
| Purmerend | 1/2 |
| Amsterdam RAI | 1/2 |
| Roermond | 1/2 |
| Rijssen | 1/1 |
| Rotterdam Centraal | 1/7 |
| Rotterdam Noord | 1/1 |
| Schiedam Centrum | 1/4 |
| Utrecht Centraal | 1/18 |
| Uitgeest | 1/2 |
| Wierden | 1/2 |

### Worst-affected stations (100% equipment offline)

- **Driehuis** — 2/2 lifts offline
- **Halfweg-Zwanenburg** — 2/2 lifts offline
- **Diemen Zuid** — 1/1 lift offline
- **Rijssen** — 1/1 lift offline
- **Rotterdam Noord** — 1/1 lift offline

## Maintenance Announcements

| Description | Count |
|-------------|-------|
| "buiten gebruik" (out of service) | 129 |
| "lift in onderhoud" (lift under maintenance) | 19 |
| "leverancier wissel" (supplier change) | 3 |
| **Total** | **151** |

## Station Accessibility (prorail_codering)

| Status | Count | % | Meaning |
|--------|-------|---|---------|
| Toegankelijk | 155 | 38.3% | Fully accessible |
| Herstel | 190 | 46.9% | Needs repair/improvement |
| Nog te doen | 52 | 12.8% | Yet to be made accessible |
| n.b. | 1 | 0.2% | Not applicable |
| Unknown/null | 7 | 1.7% | No data |

**243 stations (60%) are NOT fully accessible.** Only 155 of 405 stations are rated "Toegankelijk".

### Notable stations rated "Nog te doen" (yet to be done)

Major stations still awaiting accessibility work:
- Amsterdam RAI
- Amersfoort Centraal
- Arnhem Centraal
- Den Haag Centraal
- Dordrecht
- Groningen
- Rotterdam Centraal
- Schiphol Airport

## Coordinate Verification

Conversion from EPSG:3857 → WGS84 verified:

| Station | EPSG:3857 (x, y) | WGS84 (lon, lat) | Expected |
|---------|-------------------|-------------------|----------|
| Amsterdam Centraal | 545,461 / 6,868,905 | 4.900279, 52.378883 | ~4.900, ~52.379 |

## Data Files

| File | Contents |
|------|----------|
| `stations.json` | 405 stations with cleaned fields, WGS84 coordinates, accessibility data |
| `equipment-status.json` | 446 equipment entries with real-time status, announcements, WGS84 coordinates |
| `api-documentation.md` | Full API endpoint documentation with signatures and data model |
| `sherpa-docs.json` | Raw Sherpa self-documentation response |

## Key Findings

1. **All monitored equipment is lifts** — no escalators or other equipment types appear in the monitoring system yet.

2. **92% of monitored lifts are online** — 32 out of 446 are currently reporting offline status.

3. **Majority of stations need accessibility improvements** — 60% of stations are not yet rated "Toegankelijk" (accessible). The "Herstel" (repair) category is the largest at 47%.

4. **Major stations still awaiting work** — Several key stations including Rotterdam Centraal, Den Haag Centraal, Groningen, Schiphol Airport, and Arnhem Centraal are still in the "Nog te doen" (yet to be done) category.

5. **Rich navigation model** — The API provides detailed topological data including entrances, access spaces, equipment, and navigable path links between them, enabling indoor routing for accessibility.

6. **54,111 quays total** — The system covers all public transport (bus, tram, rail) across the Netherlands, not just railways.
