const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toWgs84 } = require('../../pipeline/fetch-data.js');

describe('toWgs84', () => {
  it('converts origin (0,0) to (0,0)', () => {
    const result = toWgs84(0, 0);
    assert.equal(result.lat, 0);
    assert.equal(result.lon, 0);
  });

  it('converts Amsterdam CS coordinates to approximately 52.378, 4.9', () => {
    // Amsterdam Centraal in EPSG:3857: roughly x=545977, y=6867405
    const result = toWgs84(545977, 6867405);
    assert.ok(result.lat > 52.3 && result.lat < 52.5, `lat ${result.lat} should be near 52.378`);
    assert.ok(result.lon > 4.8 && result.lon < 5.0, `lon ${result.lon} should be near 4.9`);
  });

  it('rounds to 6 decimal places', () => {
    const result = toWgs84(545977, 6867405);
    const latDecimals = result.lat.toString().split('.')[1] || '';
    const lonDecimals = result.lon.toString().split('.')[1] || '';
    assert.ok(latDecimals.length <= 6, `lat has ${latDecimals.length} decimals, expected <= 6`);
    assert.ok(lonDecimals.length <= 6, `lon has ${lonDecimals.length} decimals, expected <= 6`);
  });

  it('returns negative longitude for western hemisphere', () => {
    const result = toWgs84(-8238310, 4970072); // roughly New York
    assert.ok(result.lon < 0, `lon ${result.lon} should be negative`);
  });
});
