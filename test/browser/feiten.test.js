const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { feitenRow, feitenFormatDate, feitenEscapeHtml } = require('../../docs/js/feiten.js');

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

  it('escapes HTML in cell values', () => {
    const result = feitenRow(['<img src=x onerror=alert(1)>', 5]);
    assert.equal(result, '<tr><td>&lt;img src=x onerror=alert(1)&gt;</td><td>5</td></tr>');
  });

  it('escapes ampersands and quotes in names', () => {
    const result = feitenRow(['Bergen & "Zoom" \'t']);
    assert.equal(result, '<tr><td>Bergen &amp; &quot;Zoom&quot; &#39;t</td></tr>');
  });
});

describe('feitenEscapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    assert.equal(feitenEscapeHtml('<a href="x">\'&\'</a>'),
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('does not double-escape the ampersand of produced entities', () => {
    assert.equal(feitenEscapeHtml('&lt;'), '&amp;lt;');
  });

  it('leaves plain text and numbers unchanged', () => {
    assert.equal(feitenEscapeHtml('Gemeente Brummen \u2014 1.234'), 'Gemeente Brummen \u2014 1.234');
    assert.equal(feitenEscapeHtml(42), '42');
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
