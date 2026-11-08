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

function makeAuthority(code, type, name, total, inaccessible) {
  return { code, type, name, total, inaccessible };
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
    makeAuthority('G0001', 'gemeente', 'Gemeente A', 4, 2),
    makeAuthority('G0002', 'gemeente', 'Gemeente B', 3, 1),
    makeAuthority('P0001', 'provincie', 'Provincie X', 2, 1),
    makeAuthority('W0001', 'waterschap', 'Waterschap Y', 1, 1),
  ]);

  it('computes totals correctly', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.equal(stats.totals.totalBusQuays, 10);
    assert.equal(stats.totals.inaccessibleBusQuays, 5);
  });

  it('computes percentages', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.equal(stats.totals.inaccessiblePct, 50);
    assert.equal(stats.totals.wheelchairInaccessible, 4, '4 wheelchair-inaccessible out of 10');
    assert.equal(stats.totals.wheelchairPct, 40);
    assert.equal(stats.totals.visuallyInaccessible, 3, '3 visually-inaccessible out of 10');
    assert.equal(stats.totals.visualPct, 30);
  });

  it('returns empty worstGemeentes when no gemeente qualifies', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.deepEqual(stats.worstGemeentes, [], 'no gemeente has 100% inaccessible AND >=10 stops');
  });

  it('returns empty bestGemeentes when no gemeente has >=10 stops', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.deepEqual(stats.bestGemeentes, [], 'no gemeente has >=10 stops in this fixture');
  });

  it('includes authorityTypes aggregation', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    const types = stats.authorityTypes.map(t => t.type);
    assert.deepEqual(types, ['gemeente', 'provincie', 'waterschap']);
  });

  it('aggregates authorityTypes totals correctly', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    const gemType = stats.authorityTypes.find(t => t.type === 'gemeente');
    assert.equal(gemType.total, 7, 'gemeente total: 4 + 3');
    assert.equal(gemType.inaccessible, 3, 'gemeente inaccessible: 2 + 1');
    assert.equal(gemType.pct, 43, 'gemeente pct: round(3/7*100)');
  });

  it('computes conclusions with correct values', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    const c = stats.conclusions;
    assert.equal(c.totalGemeentes, 2);
    assert.equal(c.visualPct, 30, '3 visually inaccessible out of 10');
    assert.equal(c.wheelchairPct, 40, '4 wheelchair inaccessible out of 10');
    assert.equal(c.gemeentesOver50, 0, 'G0001 has 50% which is not >50');
    assert.equal(c.shelterPct, 40, '2 of 5 inaccessible stops have no shelter');
    assert.equal(c.top10Pct, 60, 'top 10 gemeentes have 3 of 5 total inaccessible');
  });

  it('includes a valid generated timestamp', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(stats.generated, 'generated should be truthy');
    assert.ok(!isNaN(Date.parse(stats.generated)), 'generated should be valid ISO date');
  });

  it('ranks mostInaccessibleGemeentes by absolute count descending', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.equal(stats.mostInaccessibleGemeentes.length, 2);
    assert.equal(stats.mostInaccessibleGemeentes[0].code, 'G0001', 'G0001 has 2 inaccessible');
    assert.equal(stats.mostInaccessibleGemeentes[1].code, 'G0002', 'G0002 has 1 inaccessible');
  });
});

describe('generateStats with large fixtures', () => {
  // Build a fixture where worstGemeentes and bestGemeentes actually produce results
  function makeQuays(ownerCode, total, inaccessibleCount) {
    const quays = [];
    for (let i = 0; i < total; i++) {
      const isInaccessible = i < inaccessibleCount;
      quays.push({
        quayownercode: ownerCode,
        quaydisabledaccessible: !isInaccessible,
        quayvisuallyaccessible: true,
        shelter: true,
      });
    }
    return quays;
  }

  const allBusQuays = [
    ...makeQuays('G0001', 15, 15), // 100% inaccessible, 15 stops
    ...makeQuays('G0002', 12, 12), // 100% inaccessible, 12 stops
    ...makeQuays('G0003', 20, 2),  // 10% inaccessible, 20 stops
    ...makeQuays('G0004', 10, 1),  // 10% inaccessible, 10 stops
  ];

  const inaccessible = allBusQuays.filter(q => q.quaydisabledaccessible === false);

  const authorities = makeAuthorities([
    makeAuthority('G0001', 'gemeente', 'Gemeente Worst1', 15, 15),
    makeAuthority('G0002', 'gemeente', 'Gemeente Worst2', 12, 12),
    makeAuthority('G0003', 'gemeente', 'Gemeente Best1', 20, 2),
    makeAuthority('G0004', 'gemeente', 'Gemeente Best2', 10, 1),
  ]);

  it('ranks worstGemeentes: 100% inaccessible with >=10 stops, sorted by count desc', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.equal(stats.worstGemeentes.length, 2);
    assert.equal(stats.worstGemeentes[0].code, 'G0001', 'G0001 has 15 inaccessible');
    assert.equal(stats.worstGemeentes[0].pct, 100);
    assert.equal(stats.worstGemeentes[1].code, 'G0002', 'G0002 has 12 inaccessible');
  });

  it('ranks bestGemeentes by lowest percentage, >=10 stops', () => {
    const stats = generateStats(allBusQuays, inaccessible, authorities);
    assert.ok(stats.bestGemeentes.length >= 2, 'should have at least 2 best gemeentes');
    assert.equal(stats.bestGemeentes[0].code, 'G0004', 'G0004 has 10% (1/10)');
    assert.equal(stats.bestGemeentes[0].pct, 10);
    assert.equal(stats.bestGemeentes[1].code, 'G0003', 'G0003 has 10% (2/20)');
  });
});
