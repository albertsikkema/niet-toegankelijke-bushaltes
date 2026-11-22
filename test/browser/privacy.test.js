const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGES = ['index.html', 'feiten.html', 'eisen.html'];
const HOST_COMMENT = '<!-- Umami analytics — self-hosted instance at analytics.test001.nl (EU, no cookies, IP not stored) -->';
const NOTICE = 'Wel wordt anonieme bezoekstatistiek bijgehouden via <a href="https://umami.is" target="_blank" rel="noopener">Umami</a> op analytics.test001.nl. Hierbij wordt uw IP-adres kortstondig verwerkt om geanonimiseerde statistieken te genereren; het IP-adres wordt niet opgeslagen.';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const read = (page) => fs.readFileSync(path.join(__dirname, '../../docs', page), 'utf8');

for (const page of PAGES) {
  describe(`analytics and privacy in ${page}`, () => {
    const html = read(page);
    const analyticsTags = html.match(/<script[^>]*src="js\/stats\.js"[^>]*>/g) || [];

    it('has an analytics script tag', () => {
      assert.ok(analyticsTags.length > 0);
    });

    it('documents the Umami host directly above the script tag', () => {
      assert.match(html, new RegExp(`${escapeRegExp(HOST_COMMENT)}\\s*<script[^>]*src="js/stats\\.js"`));
    });

    it('honours Do-Not-Track on every analytics script tag', () => {
      for (const tag of analyticsTags) assert.ok(tag.includes('data-do-not-track="true"'), tag);
    });

    it('shows the corrected privacy notice', () => {
      assert.ok(html.includes(NOTICE));
      assert.ok(!html.includes('Er worden geen persoonsgegevens verzameld of gedeeld'));
    });
  });
}
