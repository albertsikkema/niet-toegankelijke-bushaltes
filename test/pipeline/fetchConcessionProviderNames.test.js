const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fetchConcessionProviderNames } = require('../../pipeline/fetch-data.js');

describe('fetchConcessionProviderNames', () => {
  it('resolves known provider VRA', async () => {
    const result = await fetchConcessionProviderNames(new Set(['VRA']));
    assert.equal(result.VRA.name, 'Vervoerregio Amsterdam');
    assert.ok(result.VRA.website);
  });

  it('resolves known provider PNH', async () => {
    const result = await fetchConcessionProviderNames(new Set(['PNH']));
    assert.equal(result.PNH.name, 'Provincie Noord-Holland');
  });

  it('falls back to code as name for unknown provider', async () => {
    const result = await fetchConcessionProviderNames(new Set(['UNKNOWN_CODE']));
    assert.equal(result.UNKNOWN_CODE.name, 'UNKNOWN_CODE');
    assert.equal(result.UNKNOWN_CODE.email, null);
    assert.equal(result.UNKNOWN_CODE.website, null);
  });

  it('returns empty object for empty input', async () => {
    const result = await fetchConcessionProviderNames(new Set());
    assert.deepEqual(result, {});
  });

  it('handles multiple codes at once', async () => {
    const result = await fetchConcessionProviderNames(new Set(['VRA', 'FR', 'NOPE']));
    assert.equal(result.VRA.name, 'Vervoerregio Amsterdam');
    assert.equal(result.FR.name, 'Provincie Fryslân');
    assert.equal(result.NOPE.name, 'NOPE');
  });
});
