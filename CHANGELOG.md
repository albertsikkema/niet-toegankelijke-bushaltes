# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project does not publish versioned releases yet.

## [Unreleased]

### Added

- Interactive map of bus stops in the Netherlands that are not fully
  accessible, with marker clustering and compass direction indicators.
- Data pipeline (`pipeline/fetch-data.js`) that combines DOVA
  Centraal Haltebestand quays with Allmanak contact details.
- Email composer that drafts a formal Dutch email to the responsible
  road authority, with copy-to-clipboard and mailto support.
- Sidebar listing authorities by number of inaccessible stops, with
  search, drill-down, scroll indicators and keyboard navigation.
- Administrative boundary outlines for authorities from PDOK and ArcGIS.
- Facts and statistics page (`feiten.html`) with a data quality section,
  driven by generated `stats.json`.
- Accessibility requirements page (`eisen.html`) explaining the CROW
  standards.
- Info modal with disclaimer, privacy notice, sources and contact, and a
  welcome modal for first-time visitors.
- Dark/light theme toggle with OS preference detection.
- Wheelchair and eye icons in stop popups.
- Privacy-friendly, self-hosted Umami analytics.
- Daily GitHub Actions workflow that refreshes, validates and deploys
  the bus stop data.
- Unit tests for pipeline and browser functions, run in CI before every
  deploy.
- SEO meta tags, structured data, sitemap, robots.txt and favicons.
- Bruno API collection for exploring the DOVA Halteviewer API.
- README, MIT license and project documentation.
- Privacy section on the facts and requirements pages (#20).
- Request timeouts for all pipeline API calls, with retries (#23).
- Data validation fails when more than 25% of authorities have no
  email address (#22).

### Changed

- Dataset expanded from wheelchair-inaccessible stops to all stops that
  are not fully accessible (wheelchair or visually impaired).
- Map tiles switched to CARTO Voyager; basemap requests now use a CARTO
  API key from `.env` or a repository secret.
- Redesigned sidebar and simplified mobile header.
- GitHub Actions updated to Node 24.
- Analytics now honours Do-Not-Track (#20).

### Removed

- `.github/FUNDING.yml` and its GitHub Sponsor button (#26).

### Fixed

- Map stop markers now have accessible names.
- XML content type on GitHub Pages (added `.nojekyll`).
- Privacy notice no longer claims that no personal data is processed;
  it now says the IP address is processed briefly and not stored (#20).

### Security

- Leaflet and MarkerCluster files from unpkg.com are loaded with
  Subresource Integrity hashes (#21).
- Authority names on the facts page are HTML-escaped, closing a DOM
  XSS (#24).

[Unreleased]: https://github.com/albertsikkema/niet-toegankelijke-bushaltes/commits/main
