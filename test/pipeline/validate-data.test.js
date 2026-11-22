const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { writeFileSync, mkdirSync, rmSync } = require('fs');
const { join } = require('path');
const { validate, THRESHOLDS } = require('../../pipeline/validate-data.js');

const TMP = join(__dirname, '..', '..', '.tmp-validate-test');
const BUS_STOPS_PATH = join(TMP, 'bus-stops.json');
const STATS_PATH = join(TMP, 'stats.json');

function makeValidBusStops(overrides = {}) {
  const defaults = {
    generated: new Date().toISOString(),
    totals: {
      totalBusQuays: 40000,
      inaccessibleBusQuays: 25000,
      authorities: 200,
    },
    authorities: {},
  };

  // Build 200 authorities by default
  const authCount = overrides.authorityCount ?? 200;
  delete overrides.authorityCount;
  const authorities = overrides.authorities ?? {};
  if (Object.keys(authorities).length === 0) {
    for (let i = 0; i < authCount; i++) {
      const code = `G${String(i).padStart(4, '0')}`;
      authorities[code] = {
        type: 'gemeente',
        name: `Gemeente ${i}`,
        email: `info@gemeente${i}.nl`,
        stops: [{ code: `NL:Q:${i}`, name: `Stop ${i}` }],
      };
    }
  }

  return { ...defaults, ...overrides, authorities };
}

function makeValidStats(busStops) {
  return {
    generated: busStops.generated,
    totals: { totalBusQuays: busStops.totals.totalBusQuays },
  };
}

function clearEmails(busStops, n) {
  Object.values(busStops.authorities).slice(0, n).forEach(a => { a.email = null; });
}

function writePair(busStops, stats) {
  writeFileSync(BUS_STOPS_PATH, JSON.stringify(busStops));
  if (stats !== undefined) {
    writeFileSync(STATS_PATH, JSON.stringify(stats));
  }
}

describe('validate-data', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('passes with valid data', () => {
    const busStops = makeValidBusStops();
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.deepEqual(errors, []);
  });

  it('fails when bus-stops.json is missing', () => {
    const errors = validate(join(TMP, 'nonexistent.json'), STATS_PATH);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('Failed to read bus-stops.json'));
  });

  it('fails when totalBusQuays is too low', () => {
    const busStops = makeValidBusStops();
    busStops.totals.totalBusQuays = 100;
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('totalBusQuays') && e.includes('below threshold')));
  });

  it('fails when inaccessibleBusQuays is too low', () => {
    const busStops = makeValidBusStops();
    busStops.totals.inaccessibleBusQuays = 10;
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('inaccessibleBusQuays') && e.includes('below threshold')));
  });

  it('fails when authority count is too low', () => {
    const busStops = makeValidBusStops({ authorityCount: 5 });
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('authority count') && e.includes('below threshold')));
  });

  it('fails when generated timestamp is missing', () => {
    const busStops = makeValidBusStops();
    delete busStops.generated;
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('generated')));
  });

  it('fails when an authority has no name', () => {
    const busStops = makeValidBusStops();
    busStops.authorities['G0000'].name = '';
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('G0000') && e.includes('no name')));
  });

  it('fails when an authority has no stops', () => {
    const busStops = makeValidBusStops();
    busStops.authorities['G0001'].stops = [];
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('G0001') && e.includes('no stops')));
  });

  it('fails when stats.json is missing', () => {
    const busStops = makeValidBusStops();
    writeFileSync(BUS_STOPS_PATH, JSON.stringify(busStops));
    // Don't write stats.json
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('Failed to read stats.json')));
  });

  it('fails when stats.json totalBusQuays does not match', () => {
    const busStops = makeValidBusStops();
    const stats = makeValidStats(busStops);
    stats.totals.totalBusQuays = 999999;
    writePair(busStops, stats);
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('does not match')));
  });

  it('collects multiple errors at once', () => {
    const busStops = makeValidBusStops({ authorityCount: 5 });
    busStops.totals.totalBusQuays = 100;
    busStops.totals.inaccessibleBusQuays = 10;
    delete busStops.generated;
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.length >= 4, `Expected at least 4 errors, got ${errors.length}`);
  });

  it('fails when bus-stops.json contains malformed JSON', () => {
    writeFileSync(BUS_STOPS_PATH, '{not valid json!!!');
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('Failed to read bus-stops.json'));
  });

  it('fails when stats.json contains malformed JSON', () => {
    const busStops = makeValidBusStops();
    writeFileSync(BUS_STOPS_PATH, JSON.stringify(busStops));
    writeFileSync(STATS_PATH, 'not json');
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('Failed to read stats.json')));
  });

  it('fails when stats.json has no totals object', () => {
    const busStops = makeValidBusStops();
    writePair(busStops, { generated: busStops.generated });
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('does not match')), 'missing totals should cause mismatch');
  });

  it('passes when exactly the threshold share of authorities has no email', () => {
    const busStops = makeValidBusStops();
    clearEmails(busStops, 200 * THRESHOLDS.missingEmailRatio); // 50 of 200 = 25%
    writePair(busStops, makeValidStats(busStops));
    assert.deepEqual(validate(BUS_STOPS_PATH, STATS_PATH), []);
  });

  it('fails when too many non-privaat authorities have no email', () => {
    const busStops = makeValidBusStops();
    clearEmails(busStops, 200 * THRESHOLDS.missingEmailRatio + 1); // 51 of 200
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('51 of 200') && e.includes('no email') && e.includes('25%') && e.includes('G0000, G0001')));
  });

  it('excludes privaat authorities from the missing-email ratio', () => {
    const busStops = makeValidBusStops();
    // 100 privaat without email would be 50% if counted; non-privaat are all fine
    Object.values(busStops.authorities).slice(0, 100).forEach(a => { a.type = 'privaat'; a.email = null; });
    writePair(busStops, makeValidStats(busStops));
    assert.deepEqual(validate(BUS_STOPS_PATH, STATS_PATH), []);
  });

  it('counts only non-privaat authorities in the denominator', () => {
    const busStops = makeValidBusStops();
    const auths = Object.values(busStops.authorities);
    auths.slice(0, 100).forEach(a => { a.type = 'privaat'; }); // 100 non-privaat remain
    auths.slice(100, 130).forEach(a => { a.email = null; }); // 30/100 = 30% (15% of all 200)
    writePair(busStops, makeValidStats(busStops));
    const errors = validate(BUS_STOPS_PATH, STATS_PATH);
    assert.ok(errors.some(e => e.includes('30 of 100')));
  });
});
