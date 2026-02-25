const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ownerCodeToAllmanakKey, GEMEENTE_REMAP } = require('../../pipeline/fetch-data.js');

describe('ownerCodeToAllmanakKey', () => {
  it('maps gemeente code G0737 to gemeenten/gm0737', () => {
    const result = ownerCodeToAllmanakKey('G0737');
    assert.deepEqual(result, { source: 'gemeenten', key: 'gm0737' });
  });

  it('maps remapped gemeente G0196 to gm0299 (Rijnwaarden → Zevenaar)', () => {
    const result = ownerCodeToAllmanakKey('G0196');
    assert.deepEqual(result, { source: 'gemeenten', key: 'gm0299' });
  });

  it('maps all entries in GEMEENTE_REMAP correctly', () => {
    for (const [code, expected] of Object.entries(GEMEENTE_REMAP)) {
      const result = ownerCodeToAllmanakKey(code);
      assert.equal(result.source, 'gemeenten');
      assert.equal(result.key, expected);
    }
  });

  it('maps provincie P0021 to pv21 (strips leading zeros)', () => {
    const result = ownerCodeToAllmanakKey('P0021');
    assert.deepEqual(result, { source: 'provincies', key: 'pv21' });
  });

  it('maps waterschap W0621 to ws0621', () => {
    const result = ownerCodeToAllmanakKey('W0621');
    assert.deepEqual(result, { source: 'waterschappen', key: 'ws0621' });
  });

  it('maps Rijkswaterstaat RWS to rijkswaterstaat/rws', () => {
    const result = ownerCodeToAllmanakKey('RWS');
    assert.deepEqual(result, { source: 'rijkswaterstaat', key: 'rws' });
  });

  it('returns null for null input', () => {
    assert.equal(ownerCodeToAllmanakKey(null), null);
  });

  it('returns null for undefined input', () => {
    assert.equal(ownerCodeToAllmanakKey(undefined), null);
  });

  it('returns null for unknown prefix', () => {
    assert.equal(ownerCodeToAllmanakKey('X1234'), null);
  });
});
