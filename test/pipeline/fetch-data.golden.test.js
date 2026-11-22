const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../../pipeline/fetch-data.js');

// Golden-output test: runs main() on fixture API responses and compares
// every output file with test/fixtures/pipeline/expected/<scenario>/.
// Regenerate ONLY for an intended behaviour change:
//   UPDATE_GOLDEN=1 node --test test/pipeline/fetch-data.golden.test.js
const FIXTURES = path.join(__dirname, '..', 'fixtures', 'pipeline');
const EXPECTED = path.join(FIXTURES, 'expected');
const ROUTES = [
  ['/getQuays', 'dova-quays.json'],
  ['%7BGemeente%7D', 'allmanak-gemeenten.json'],
  ['%7BProvincie%7D', 'allmanak-provincies.json'],
  ['%7BWaterschap%7D', 'allmanak-waterschappen.json'],
  ['naam=eq.Rijkswaterstaat', 'allmanak-rijkswaterstaat.json'],
  ['Gemeentegebied', 'pdok-gemeenten.json'],
  ['Provinciegebied', 'pdok-provincies.json'],
  ['Waterschapsgrenzen', 'arcgis-waterschappen.json'],
];

const SCENARIOS = {
  full: {},
  degraded: { 'allmanak-rijkswaterstaat.json': [], 'pdok-gemeenten.json': 404 },
};

function stubFetch(overrides) {
  return async (url) => {
    const route = ROUTES.find(([part]) => url.includes(part));
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    const override = overrides[route[1]];
    if (override === 404) return { ok: false, status: 404, json: async () => ({}) };
    const body = override ?? JSON.parse(fs.readFileSync(path.join(FIXTURES, route[1]), 'utf8'));
    return { ok: true, status: 200, json: async () => body };
  };
}

const normalise = (text) => text.replace(/"generated": "[^"]*"/, '"generated": "<generated>"');

// Relative paths of all files under dir, sorted
function listFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
  }).sort();
}

describe('fetch-data main() golden output', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-data-golden-'));
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const [scenario, overrides] of Object.entries(SCENARIOS)) {
    it(`writes the expected files (${scenario})`, async () => {
      mock.method(globalThis, 'fetch', stubFetch(overrides));
      await main(tmpDir);

      const expectedDir = path.join(EXPECTED, scenario);
      const actualFiles = listFiles(tmpDir);

      if (process.env.UPDATE_GOLDEN) {
        fs.rmSync(expectedDir, { recursive: true, force: true });
        for (const file of actualFiles) {
          const target = path.join(expectedDir, file);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, normalise(fs.readFileSync(path.join(tmpDir, file), 'utf8')));
        }
        assert.fail(`golden files updated in ${expectedDir}`);
      }

      assert.deepEqual(actualFiles, listFiles(expectedDir));
      for (const file of actualFiles) {
        const actual = normalise(fs.readFileSync(path.join(tmpDir, file), 'utf8'));
        const expected = fs.readFileSync(path.join(expectedDir, file), 'utf8');
        assert.equal(actual, expected, `${scenario}/${file} differs`);
      }
    });
  }
});
