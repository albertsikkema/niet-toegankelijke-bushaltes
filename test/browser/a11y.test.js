const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = path.join(__dirname, '../../docs');
const read = (file) => fs.readFileSync(path.join(docs, file), 'utf8');

describe('index.html skip link', () => {
  const html = read('index.html');

  it('is the first element in <body>', () => {
    assert.match(html, /<body>\s*<a href="#map" class="skip-link">Direct naar inhoud<\/a>/);
  });

  it('targets an element that can receive focus', () => {
    assert.match(html, /<div id="map" tabindex="-1"/);
  });
});

describe('style.css', () => {
  it('disables transitions and animations under prefers-reduced-motion', () => {
    const css = read('css/style.css');
    const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
    assert.ok(block, 'missing prefers-reduced-motion block');
    // Not a short transition-duration: that also transitions `visibility`,
    // which keeps Leaflet popups unfocusable right after they open
    assert.match(block[0], /transition: none !important/);
    assert.match(block[0], /animation-duration: 0\.01ms !important/);
  });
});
