const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { fetchJson } = require('../../pipeline/fetch-data.js');

describe('fetchJson', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed JSON on success', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ hello: 'world' }),
    });

    const result = await fetchJson('https://example.com/data');
    assert.deepEqual(result, { hello: 'world' });
  });

  it('retries on failure then succeeds', async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) throw new Error('network error');
      return { ok: true, json: async () => ({ recovered: true }) };
    };

    const result = await fetchJson('https://example.com/data', {}, 2);
    assert.deepEqual(result, { recovered: true });
    assert.equal(attempts, 2);
  });

  it('throws after exhausting retries', async () => {
    globalThis.fetch = async () => { throw new Error('persistent error'); };

    await assert.rejects(
      () => fetchJson('https://example.com/data', {}, 1),
      { message: 'persistent error' }
    );
  });

  it('throws on non-ok HTTP response after retries exhausted', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
    });

    await assert.rejects(
      () => fetchJson('https://example.com/data', {}, 1),
      /HTTP 500/
    );
  });
});
