const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  gemeenteCode, provincieCode, waterschapCode, allmanakContact,
  fetchAllmanak, ALLMANAK_SOURCES, findContact,
} = require('../../pipeline/fetch-data.js');

const tooi = (kind, code) => ({ naam: 'resourceIdentifierTOOI', value: `https://identifier.overheid.nl/tooi/id/${kind}/${code}` });
const orgCode = (value) => ({ naam: 'Organisatiecode', value });

describe('gemeenteCode', () => {
  it('uses Organisatiecode', () => {
    assert.equal(gemeenteCode([orgCode('gm0344'), tooi('gemeente', 'gm9999')]), 'gm0344');
  });

  it('falls back to the TOOI URI', () => {
    assert.equal(gemeenteCode([tooi('gemeente', 'gm0299')]), 'gm0299');
  });

  it('returns null without a usable id', () => {
    assert.equal(gemeenteCode([]), null);
    assert.equal(gemeenteCode([orgCode(''), tooi('provincie', 'pv26')]), null);
  });
});

describe('provincieCode', () => {
  it('prefers the TOOI URI over Organisatiecode', () => {
    assert.equal(provincieCode([tooi('provincie', 'pv26'), orgCode('pv99')]), 'pv26');
  });

  it('falls back to Organisatiecode', () => {
    assert.equal(provincieCode([orgCode('pv21')]), 'pv21');
  });

  it('returns null without a usable id', () => {
    assert.equal(provincieCode([]), null);
    assert.equal(provincieCode([orgCode('xx99')]), null);
  });
});

describe('waterschapCode', () => {
  it('extracts the code from the TOOI URI', () => {
    assert.equal(waterschapCode([tooi('waterschap', 'ws0621')]), 'ws0621');
  });

  it('returns null without a TOOI id or without digits', () => {
    assert.equal(waterschapCode([orgCode('ws0621')]), null);
    assert.equal(waterschapCode([tooi('waterschap', 'wsabc')]), null);
  });
});

describe('allmanakContact', () => {
  const org = (contact, naam = 'Org') => ({ naam, contact });

  it('takes the first email, website and phone', () => {
    const contact = allmanakContact(org({
      emailadressen: [{ email: 'a@x.nl' }, { email: 'b@x.nl' }],
      internetadressen: [{ url: 'https://www.x.nl' }],
      telefoonnummers: [{ nummer: '14 020' }],
    }), ALLMANAK_SOURCES.gemeenten);
    assert.deepEqual(contact, { name: 'Org', email: 'a@x.nl', website: 'https://www.x.nl', phone: '14 020' });
  });

  it('derives gemeente@ from the website for gemeenten', () => {
    const contact = allmanakContact(org({ internetadressen: [{ url: 'https://www.amsterdam.nl' }] }), ALLMANAK_SOURCES.gemeenten);
    assert.equal(contact.email, 'gemeente@amsterdam.nl');
  });

  it('derives info@ from the website for provincies and waterschappen', () => {
    const website = { internetadressen: [{ url: 'https://hhdelfland.nl/contact' }] };
    assert.equal(allmanakContact(org(website), ALLMANAK_SOURCES.provincies).email, 'info@hhdelfland.nl');
    assert.equal(allmanakContact(org(website), ALLMANAK_SOURCES.waterschappen).email, 'info@hhdelfland.nl');
  });

  it('does not derive an email for Rijkswaterstaat', () => {
    const contact = allmanakContact(org({ internetadressen: [{ url: 'https://www.rijkswaterstaat.nl' }] }), ALLMANAK_SOURCES.rijkswaterstaat);
    assert.equal(contact.email, null);
  });

  it('leaves email null for an invalid website', () => {
    const contact = allmanakContact(org({ internetadressen: [{ url: 'not a url' }] }), ALLMANAK_SOURCES.gemeenten);
    assert.equal(contact.email, null);
    assert.equal(contact.website, 'not a url');
  });

  it('returns nulls for a missing contact block and uses the default name', () => {
    assert.deepEqual(allmanakContact({}, ALLMANAK_SOURCES.gemeenten), { name: '', email: null, website: null, phone: null });
    assert.equal(allmanakContact({}, ALLMANAK_SOURCES.rijkswaterstaat).name, 'Rijkswaterstaat');
  });
});

describe('fetchAllmanak', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('requests the source filter and skips orgs without a code', async (t) => {
    t.mock.method(console, 'log', () => {});
    let requestedUrl;
    globalThis.fetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => [
          { naam: 'Provincie Utrecht', resourceidentifiers: [tooi('provincie', 'pv26')] },
          { naam: 'Zonder code', resourceidentifiers: [orgCode('xx')] },
          { naam: 'Zonder ids' },
        ],
      };
    };

    const map = await fetchAllmanak('provincies', ALLMANAK_SOURCES.provincies);
    assert.ok(requestedUrl.endsWith(`/overheidsorganisatie?${ALLMANAK_SOURCES.provincies.filter}`));
    assert.deepEqual([...map.keys()], ['pv26']);
    assert.equal(map.get('pv26').name, 'Provincie Utrecht');
  });
});

describe('findContact', () => {
  const rws = { name: 'Rijkswaterstaat' };
  const zevenaar = { name: 'Gemeente Zevenaar' };
  const contacts = {
    gemeenten: new Map([['gm0299', zevenaar]]),
    provincies: new Map(),
    waterschappen: new Map(),
    rijkswaterstaat: new Map([['rws', rws]]),
  };

  it('resolves RWS owner codes through the rijkswaterstaat map', () => {
    assert.equal(findContact('RWSZN', contacts), rws);
  });

  it('resolves remapped gemeenten', () => {
    assert.equal(findContact('G0196', contacts), zevenaar);
  });

  it('returns null for unknown or private owners', () => {
    assert.equal(findContact('G9999', contacts), null);
    assert.equal(findContact('HOORNBEECK', contacts), null);
    assert.equal(findContact('RWSZN', { ...contacts, rijkswaterstaat: new Map() }), null);
  });
});
