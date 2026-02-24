# Niet Toegankelijke Bushaltes

An interactive map of **inaccessible bus stops in the Netherlands**, with a built-in tool to email the responsible road authorities (*wegbeheerders*) and request accessibility improvements.

[Live site](https://albertsikkema.github.io/niet-toegankelijke-bushaltes/)

## Data Sources

- **[Centraal Haltebestand (CHB)](https://halteviewer.ov-data.nl)** — maintained by DOVA, contains accessibility data for all 42,000+ Dutch bus stops
- **[Allmanak](https://rest-api.allmanak.nl)** — contact details for municipalities, provinces, and water boards

## Getting Started

### Prerequisites

- Node.js 18+ (uses built-in `fetch`)

### Run the data pipeline

Fetches live data from DOVA and Allmanak, filters to inaccessible bus stops, enriches with authority contact info, and writes the result to `docs/data/bus-stops.json`.

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
| `docs/data/bus-stops.json` | Generated data file (not checked in) |
| `api_tools/` | Bruno API collection for exploring the DOVA Sherpa API |

## Support

If you find this project useful, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/albertsikkema)

## License

[MIT](LICENSE)
