# Contributing

Thanks for helping make bus stops in the Netherlands more accessible!
This guide explains how to run the project, how to make changes and how
to get them merged. See [README.md](README.md) for what the project does.

## Running locally

Requirements: Node.js 18 or newer (CI uses Node 24). The project has no
npm dependencies; `make run` fetches `serve` on demand via `npx`, which
needs access to the npm registry the first time.

### Fetch the data

```bash
node pipeline/fetch-data.js
```

Fetches live data from DOVA, Allmanak and PDOK/ArcGIS and writes
`docs/data/bus-stops.json`, `docs/data/stats.json` and
`docs/data/boundaries/`. Check the output with:

```bash
node pipeline/validate-data.js
```

The data in `docs/data/` is refreshed and committed every day by a
GitHub Actions workflow. Don't include regenerated data in your pull
request unless the change is about the data itself.

### Serve the web app

Copy `.env.example` to `.env` and set `CARTO_API_KEY` (needed for the
map tiles), then run:

```bash
make run
```

This writes `docs/js/config.js` and serves `docs/` with `npx serve`.
Both `.env` and `docs/js/config.js` are gitignored: never commit them.

### Run the tests

```bash
node --test
```

Tests live in `test/pipeline/` and `test/browser/` and use Node's
built-in `node:test` and `node:assert`. CI runs them on every pull
request.

## Code style

- **Vanilla JavaScript, no build step.** The site in `docs/` is served
  as-is; the browser modules are global singletons loaded by `<script>`
  tags in a fixed order (`theme.js` → `email.js` → `map.js` →
  `sidebar.js` → `app.js`).
- **No dependencies.** Don't add a `package.json` or npm packages; use
  Node's standard library and browser APIs. Front-end libraries (Leaflet)
  come from a CDN.
- **Keep it simple.** Small functions, clear names, no speculative
  abstractions.
- **Make logic testable.** Put logic in pure functions and export them
  for tests: `if (typeof module !== 'undefined') module.exports = …` in
  browser files, `module.exports` plus `if (require.main === module)` in
  pipeline scripts.
- **Language.** Code, comments and docs are in English; UI text and
  email templates are in Dutch.
- **Accessibility.** This is an accessibility project: keep the site
  usable by keyboard and screen reader.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <description>
```

- Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`,
  `perf`, `build`, `ci`.
- Subject: imperative mood, lowercase after the prefix, no trailing
  period, at most 50 characters.
- Use the body to explain what and why. One logical change per commit.

Examples:

```text
feat(sidebar): add keyboard navigation to authority list
fix: add accessible names to map stop markers
```

## Branches and pull requests

1. Fork the repository (or create a branch if you have write access).
   Never commit directly to `main`.
2. Name the branch `<type>/<short-description>`, for example
   `feat/stop-filter` or `fix/popup-focus`.
3. Make your change, add or update tests, and run `node --test`.
4. Add a line under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md)
   for user-visible changes.
5. Open a pull request against `main` with a Conventional Commits title
   and a short description of what changed and why. Link the issue it
   fixes (`Fixes #123`).
6. The test workflow must pass. The maintainer reviews and merges
   (squash merge).
