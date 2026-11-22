const http = require('node:http');
const { describe, it, afterEach, before, after } = require('node:test');
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

  it('passes options (including POST body) to fetch', async () => {
    let capturedOptions;
    globalThis.fetch = async (url, options) => {
      capturedOptions = options;
      return { ok: true, json: async () => ({ result: 'ok' }) };
    };

    const body = JSON.stringify({ params: [] });
    await fetchJson('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.body, body);
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.ok(capturedOptions.signal instanceof AbortSignal);
  });
});

describe('fetchJson timeout', () => {
  let server;
  let baseUrl;
  let requests = 0;

  before(async () => {
    server = http.createServer((req, res) => {
      requests++;
      if (req.url === '/stalled-body') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write('{"partial":'); // never ends
      }
      // any other path: never respond at all
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  it('aborts a stalled request, retries, and names the URL', async () => {
    requests = 0;
    const url = `${baseUrl}/stalled`;
    const start = Date.now();
    await assert.rejects(
      () => fetchJson(url, {}, 2, 100),
      { message: `Timed out after 100ms for ${url}` }
    );
    assert.equal(requests, 2);
    assert.ok(Date.now() - start < 5000);
  });

  it('aborts when the body stalls after headers', async () => {
    const url = `${baseUrl}/stalled-body`;
    const start = Date.now();
    await assert.rejects(
      () => fetchJson(url, {}, 1, 100),
      { message: `Timed out after 100ms for ${url}` }
    );
    assert.ok(Date.now() - start < 2000);
  });
});
