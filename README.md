# Niet met de bus?

An interactive map of **inaccessible bus stops in the Netherlands**, with a built-in tool to email the responsible road authorities (*wegbeheerders*) and request accessibility improvements. Of the 42,000+ bus stops in the Netherlands, roughly 67% are not fully accessible.

[Live site](https://nietmetdebus.nl/)

## Features

- **Interactive map** — browse all inaccessible bus stops with marker clustering, compass direction indicators, and authority boundary overlays
- **Sidebar** — search and browse authorities sorted by number of inaccessible stops, drill down to individual stops
- **Email composer** — generates a formal Dutch email addressed to the responsible authority, with copy-to-clipboard and mailto support
- **Facts & figures** — dedicated page with statistics, tables of worst/best-performing municipalities, and data quality information
- **Accessibility requirements** — page explaining the CROW standards that bus stops must meet
- **Dark/light theme** — toggle with OS preference detection
- **Welcome modal** — first-time visitor introduction

## Data Sources

- **[Centraal Haltebestand (CHB)](https://halteviewer.ov-data.nl)** — maintained by DOVA, contains accessibility data for all 42,000+ Dutch bus stops
- **[Allmanak](https://rest-api.allmanak.nl)** — contact details for municipalities, provinces, and water boards
- **[PDOK](https://service.pdok.nl)** / **ArcGIS** — administrative boundary geometries

## Getting Started

### Prerequisites

- Node.js 18+ (uses built-in `fetch`)

### Run the data pipeline

Fetches live data from DOVA and Allmanak, filters to non-fully-accessible bus stops, enriches with authority contact info, downloads boundary geometries, and writes results to `docs/data/`.

```bash
node pipeline/fetch-data.js
```

### Serve the web app locally

The `docs/` folder is a static site (deployed via GitHub Pages). Serve it with any static server:

```bash
npx serve docs
```

The app loads `data/bus-stops.json` at startup. If the file is missing, run the pipeline first.

## Project Structure

| Path | Description |
|------|-------------|
| `pipeline/fetch-data.js` | Data pipeline — fetches, filters, and enriches bus stop data |
| `docs/` | Static web app (HTML/CSS/vanilla JS) with Leaflet map |
| `docs/feiten.html` | Facts and statistics page |
| `docs/eisen.html` | Accessibility requirements page (CROW standards) |
| `docs/data/bus-stops.json` | Generated data file (not checked in) |
| `docs/data/boundaries/` | GeoJSON boundary files per authority (not checked in) |
| `api_tools/` | Bruno API collection for exploring the DOVA Sherpa API |

## Support

If you find this project useful, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/albertsikkema)

## License

[MIT](LICENSE)
