const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { feitenRow, feitenFormatDate } = require('../../docs/js/feiten.js');

describe('feitenRow', () => {
  it('wraps cells in <tr><td>...</td></tr>', () => {
    const result = feitenRow(['A', 'B']);
    assert.equal(result, '<tr><td>A</td><td>B</td></tr>');
  });

  it('handles single cell', () => {
    const result = feitenRow(['Only']);
    assert.equal(result, '<tr><td>Only</td></tr>');
  });

  it('handles empty array', () => {
    const result = feitenRow([]);
    assert.equal(result, '<tr></tr>');
  });

  it('handles numeric values', () => {
    const result = feitenRow([42, '100%']);
    assert.equal(result, '<tr><td>42</td><td>100%</td></tr>');
  });
});

describe('feitenFormatDate', () => {
  it('formats ISO date string to Dutch locale', () => {
    const result = feitenFormatDate('2024-03-15T10:00:00.000Z');
    // Should contain day and year
    assert.ok(result.includes('15'), 'should contain day 15');
    assert.ok(result.includes('2024'), 'should contain year 2024');
  });

  it('handles another date', () => {
    const result = feitenFormatDate('2025-01-01T00:00:00.000Z');
    assert.ok(result.includes('2025'), 'should contain year 2025');
  });
});
