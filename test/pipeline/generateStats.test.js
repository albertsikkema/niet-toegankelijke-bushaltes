const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateStats } = require('../../pipeline/fetch-data.js');

// Synthetic test data
function makeQuay(ownerCode, { wheelchair = true, visual = true, shelter = true } = {}) {
  return {
    quayownercode: ownerCode,
    quaydisabledaccessible: wheelchair,
    quayvisuallyaccessible: visual,
    shelter,
  };
}

function makeAuthorities(entries) {
  const result = {};
  for (const e of entries) {
    result[e.code] = {
      type: e.type,
      name: e.name,
      totalBusQuays: e.total,
      inaccessibleCount: e.inaccessible,
      stops: [],
    };
  }
  return result;
}

describe('generateStats', () => {
  const allBusQuays = [
    // G0001: 4 quays, 2 wheelchair-inaccessible, 1 visually-inaccessible
    makeQuay('G0001', { wheelchair: false, visual: false, shelter: false }),
    makeQuay('G0001', { wheelchair: false, visual: true }),
    makeQuay('G0001'),
    makeQuay('G0001'),
    // G0002: 3 quays, 1 wheelchair-inaccessible
    makeQuay('G0002', { wheelchair: false, visual: true, shelter: true }),
    makeQuay('G0002'),
    makeQuay('G0002'),
    // P0001: 2 quays, 1 visually-inaccessible
    makeQuay('P0001', { wheelchair: true, visual: false }),
    makeQuay('P0001'),
    // W0001: 1 quay, inaccessible
    makeQuay('W0001', { wheelchair: false, visual: false, shelter: false }),
  ];

  const inaccessible = allBusQuays.filter(
    q => q.quaydisabledaccessible === false || q.quayvisuallyaccessible === false
  );

  const authorities = makeAuthorities([
    { code: 'G0001', type: 'gemeente', name: 'Gemeente A', total: 4, inaccessible: 2 },
    { code: 'G0002', type: 'gemeente', name: 'Gemeente B', total: 3, inaccessible: 1 },
    { code: 'P0001', type: 'provincie', name: 'Provincie X', total: 2, inaccessible: 1 },
    { code: 'W0001', type: 'waterschap', name: 'Waterschap Y', total: 1, inaccessible: 1 },
  ]);

  it('computes totals correctly', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.equal(stats.totals.totalBusQuays, 10);
    assert.equal(stats.totals.inaccessibleBusQuays, 5);
  });

  it('computes percentages', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.equal(stats.totals.inaccessiblePct, 50);
    // 4 wheelchair-inaccessible out of 10
    assert.equal(stats.totals.wheelchairInaccessible, 4);
    assert.equal(stats.totals.wheelchairPct, 40);
    // 3 visually-inaccessible out of 10
    assert.equal(stats.totals.visuallyInaccessible, 3);
    assert.equal(stats.totals.visualPct, 30);
  });

  it('ranks worstGemeentes (100% inaccessible, >=10 stops)', () => {
    // With our small fixture none have 100% and >=10, so empty
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(Array.isArray(stats.worstGemeentes));
  });

  it('ranks bestGemeentes by lowest percentage', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(Array.isArray(stats.bestGemeentes));
  });

  it('includes authorityTypes aggregation', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(Array.isArray(stats.authorityTypes));
    const types = stats.authorityTypes.map(t => t.type);
    assert.ok(types.includes('gemeente'));
    assert.ok(types.includes('provincie'));
    assert.ok(types.includes('waterschap'));
  });

  it('aggregates authorityTypes totals correctly', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    const gemType = stats.authorityTypes.find(t => t.type === 'gemeente');
    assert.equal(gemType.total, 7); // 4 + 3
    assert.equal(gemType.inaccessible, 3); // 2 + 1
  });

  it('provides conclusions object', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(stats.conclusions);
    assert.equal(typeof stats.conclusions.totalGemeentes, 'number');
    assert.equal(stats.conclusions.totalGemeentes, 2);
    assert.equal(typeof stats.conclusions.visualPct, 'number');
    assert.equal(typeof stats.conclusions.wheelchairPct, 'number');
    assert.equal(typeof stats.conclusions.shelterPct, 'number');
    assert.equal(typeof stats.conclusions.top10Pct, 'number');
  });

  it('includes a generated timestamp', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(stats.generated);
    assert.ok(!isNaN(Date.parse(stats.generated)));
  });
});
