const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', '..', 'docs');
const pages = fs.readdirSync(DOCS).filter(f => f.endsWith('.html'));

// <script src="https://unpkg.com/..."> and <link rel="stylesheet" href="https://unpkg.com/...">;
// preconnect/dns-prefetch hints fetch nothing and are not subject to SRI.
function cdnTags(html) {
  const tags = html.match(/<(script|link)\b[^>]*>/g) || [];
  return tags.filter(tag =>
    /\b(src|href)="https:\/\/unpkg\.com\//.test(tag) && !/\brel="(preconnect|dns-prefetch)"/.test(tag));
}

describe('Subresource Integrity on unpkg.com resources', () => {
  it('index.html loads the 5 Leaflet/MarkerCluster files from unpkg', () => {
    const html = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
    assert.equal(cdnTags(html).length, 5);
  });

  for (const page of pages) {
    it(`${page}: every unpkg.com resource has sha384 integrity and crossorigin="anonymous"`, () => {
      const html = fs.readFileSync(path.join(DOCS, page), 'utf8');
      for (const tag of cdnTags(html)) {
        assert.match(tag, /\bintegrity="sha384-[A-Za-z0-9+/]{64}"/, tag);
        assert.match(tag, /\bcrossorigin="anonymous"/, tag);
      }
    });
  }
});
