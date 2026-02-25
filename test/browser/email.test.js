const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateSubject, generateBody, buildMailtoUrl, MAX_STOPS_MAILTO } = require('../../docs/js/email.js');

describe('generateSubject', () => {
  it('includes authority name', () => {
    const subject = generateSubject({ name: 'Gemeente Utrecht', type: 'gemeente' });
    assert.ok(subject.includes('Gemeente Utrecht'));
  });

  it('falls back to type when name is missing', () => {
    const subject = generateSubject({ type: 'provincie' });
    assert.ok(subject.includes('provincie'));
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
    assert.ok(body.includes('burgemeester en wethouders'));
  });

  it('uses Gedeputeerde Staten aanhef for provincie', () => {
    const authority = { name: 'Provincie Utrecht', type: 'provincie', totalBusQuays: 50 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('Gedeputeerde Staten'));
  });

  it('uses dagelijks bestuur aanhef for waterschap', () => {
    const authority = { name: 'Waterschap Rivierenland', type: 'waterschap', totalBusQuays: 30 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('dagelijks bestuur'));
  });

  it('includes stop names in the body', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('Halte A'));
    assert.ok(body.includes('Halte B'));
  });

  it('includes percentage calculation', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('2%'), 'should include 2% (2 of 100)');
  });

  it('includes concession provider name', () => {
    const authority = { name: 'Gemeente Utrecht', type: 'gemeente', totalBusQuays: 100 };
    const body = generateBody(authority, stops, providers);
    assert.ok(body.includes('Provincie Utrecht'));
  });
});

describe('buildMailtoUrl', () => {
  it('returns a valid mailto URL', () => {
    const url = buildMailtoUrl('test@example.com', 'Subject', 'Body text');
    assert.ok(url.startsWith('mailto:'));
    assert.ok(url.includes('subject='));
    assert.ok(url.includes('body='));
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
