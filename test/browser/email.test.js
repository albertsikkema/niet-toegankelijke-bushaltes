const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateSubject, generateBody, buildMailtoUrl, MAX_STOPS_MAILTO } = require('../../docs/js/email.js');

describe('generateSubject', () => {
  it('includes authority name', () => {
    const subject = generateSubject({ name: 'Gemeente Utrecht', type: 'gemeente' });
    assert.equal(subject, 'Verzoek verbetering toegankelijkheid bushaltes in Gemeente Utrecht');
  });

  it('falls back to type when name is missing', () => {
    const subject = generateSubject({ type: 'provincie' });
    assert.equal(subject, 'Verzoek verbetering toegankelijkheid bushaltes in provincie');
  });
});

describe('generateBody', () => {
  const stops = [
    { name: 'Halte A', town: 'Utrecht', street: 'Straat 1', code: 'NL:Q:1', concessionProvider: 'PUT' },
    { name: 'Halte B', town: 'Utrecht', street: '', code: 'NL:Q:2', concessionProvider: 'PUT' },
  ];
  const providers = { PUT: { name: 'Provincie Utrecht' } };

  it('uses burgemeester aanhef for gemeente', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('burgemeester en wethouders'), 'should contain gemeente aanhef');
  });

  it('uses Gedeputeerde Staten aanhef for provincie', () => {
    const authority = { name: 'Provincie Utrecht', type: 'provincie', totalBusQuays: 50 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('Gedeputeerde Staten'), 'should contain provincie aanhef');
  });

  it('uses dagelijks bestuur aanhef for waterschap', () => {
    const authority = { name: 'Waterschap Rivierenland', type: 'waterschap', totalBusQuays: 30 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('dagelijks bestuur'), 'should contain waterschap aanhef');
  });

  it('falls back to gemeente aanhef for rijkswaterstaat', () => {
    const authority = { name: 'Rijkswaterstaat', type: 'rijkswaterstaat', totalBusQuays: 10 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('burgemeester en wethouders'), 'rijkswaterstaat uses default gemeente aanhef');
  });

  it('includes stop names in the body', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('Halte A'), 'should include first stop name');
    assert.ok(body.includes('Halte B'), 'should include second stop name');
  });

  it('includes percentage calculation', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('2%'), 'should include 2% (2 of 100)');
  });

  it('handles zero totalBusQuays without error', () => {
    const authority = { name: 'Gemeente Leeg', type: 'gemeente', totalBusQuays: 0 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('0%'), 'should show 0% when totalBusQuays is 0');
  });

  it('includes concession provider name', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('Provincie Utrecht'), 'should include provider name');
  });

  it('falls back to generic provider name when provider is unknown', () => {
    const stopsNoProvider = [{ name: 'Halte X', town: 'Utrecht', street: '', code: 'NL:Q:9', concessionProvider: '' }];
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 10 };
    const body = generateBody(authority, stopsNoProvider, {});
    assert.ok(body.includes('de OV-autoriteit'), 'should fall back to generic provider name');
  });
});

describe('buildMailtoUrl', () => {
  it('returns a valid mailto URL with encoded parts', () => {
    const url = buildMailtoUrl('test@example.com', 'Subject', 'Body text');
    assert.ok(url.startsWith('mailto:test%40example.com'), 'should start with encoded email');
    assert.ok(url.includes('subject=Subject'), 'should include subject');
    assert.ok(url.includes('body=Body%20text'), 'should include encoded body');
  });

  it('truncates when more than MAX_STOPS_MAILTO stops', () => {
    const stopLines = [];
    for (let i = 0; i < 25; i++) {
      stopLines.push('  - Halte ' + i + ', Town [NL:Q:' + i + ']');
    }
    const body = 'Intro text\n\nHet gaat om de volgende haltes:\n' + stopLines.join('\n') + '\n\nRest of letter';
    const url = buildMailtoUrl('test@example.com', 'Subject', body);
    const decodedBody = decodeURIComponent(url.split('body=')[1]);
    assert.ok(decodedBody.includes('en nog 5 andere haltes'));
    // Should only have MAX_STOPS_MAILTO stop lines
    const resultStopLines = decodedBody.split('\n').filter(l => l.startsWith('  - '));
    assert.equal(resultStopLines.length, MAX_STOPS_MAILTO);
  });

  it('does not truncate when stops are within limit', () => {
    const stopLines = [];
    for (let i = 0; i < 5; i++) {
      stopLines.push('  - Halte ' + i + ', Town [NL:Q:' + i + ']');
    }
    const body = 'Intro\n' + stopLines.join('\n') + '\nEnd';
    const url = buildMailtoUrl('test@example.com', 'Subject', body);
    const decodedBody = decodeURIComponent(url.split('body=')[1]);
    assert.ok(!decodedBody.includes('andere haltes'));
  });
});
