const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', '..', 'docs');
const PAGES = ['index.html', 'feiten.html', 'eisen.html'];
const EXPECTED = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://unpkg.com', 'https://analytics.test001.nl'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
  'img-src': ["'self'", 'data:', 'https://unpkg.com', 'https://*.basemaps.cartocdn.com'],
  'connect-src': ["'self'", 'https://analytics.test001.nl'],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
};
const META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;
// Kept to one line so `i < n` followed later by `const onX =` is not a match
const INLINE_HANDLER = /<[^>\n]*\son[a-z]+\s*=|setAttribute\(\s*['"`]on[a-z]+['"`]/i;

function parsePolicy(content) {
  const policy = {};
  for (const part of content.split(';').map(s => s.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    policy[name] = values;
  }
  return policy;
}

it('every HTML page is covered by the CSP test', () => {
  const pages = fs.readdirSync(DOCS).filter(f => f.endsWith('.html')).sort();
  assert.deepEqual(pages, [...PAGES].sort());
});

for (const page of PAGES) {
  describe(`Content-Security-Policy in ${page}`, () => {
    const html = fs.readFileSync(path.join(DOCS, page), 'utf8');
    const match = html.match(META);

    it('has exactly one CSP meta tag with the expected policy', () => {
      assert.ok(match, 'CSP meta tag missing');
      assert.equal(html.match(new RegExp(META.source, 'g')).length, 1);
      assert.deepEqual(parsePolicy(match[1]), EXPECTED);
    });

    it('places the CSP meta before any script or stylesheet', () => {
      assert.ok(match, 'CSP meta tag missing');
      const firstResource = html.search(/<script\b|<link\b[^>]*rel="stylesheet"/);
      assert.ok(firstResource !== -1, 'page has no script or stylesheet');
      assert.ok(match.index < firstResource, 'CSP meta must precede scripts/stylesheets');
    });

    it('has no executable inline scripts', () => {
      const inline = (html.match(/<script\b[^>]*>/g) || [])
        .filter(tag => !/\bsrc=/.test(tag) && !/type="application\/ld\+json"/.test(tag));
      assert.deepEqual(inline, []);
    });

    it('has no inline event handlers or javascript: URLs', () => {
      assert.doesNotMatch(html, INLINE_HANDLER);
      assert.doesNotMatch(html, /javascript:/i);
    });
  });
}

describe('inline handler pattern', () => {
  it('catches inline handlers in markup and setAttribute', () => {
    assert.match('<button onclick="go()">', INLINE_HANDLER);
    assert.match("el.innerHTML = '<a href=\"#\" onmouseover=x>';", INLINE_HANDLER);
    assert.match("el.setAttribute('onclick', 'go()');", INLINE_HANDLER);
  });

  it('ignores a comparison followed by an on* variable on a later line', () => {
    assert.doesNotMatch('for (let i = 0; i < n; i++) {}\nconst onClose = () => {};', INLINE_HANDLER);
  });
});

describe('scripts build no inline event handlers', () => {
  // stats.js is minified third-party code; config.js is generated and gitignored
  const files = fs.readdirSync(path.join(DOCS, 'js'))
    .filter(f => f.endsWith('.js') && f !== 'stats.js' && f !== 'config.js');
  for (const file of files) {
    it(file, () => {
      const src = fs.readFileSync(path.join(DOCS, 'js', file), 'utf8');
      assert.doesNotMatch(src, INLINE_HANDLER);
    });
  }
});
