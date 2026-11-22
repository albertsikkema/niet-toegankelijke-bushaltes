const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  quayLatLon, quayToStop, authorityType, buildAuthorities, toWgs84,
} = require('../../pipeline/fetch-data.js');

const quay = (over = {}) => ({
  quaycode: 'NL:Q:1',
  quayname: 'Dam',
  town: 'Amsterdam',
  street: 'Damrak',
  quayownercode: 'G0363',
  quaydisabledaccessible: false,
  quayvisuallyaccessible: true,
  geom: [545000, 6868000],
  compassdirection: 90,
  mutationdate: '2024-03-05T23:30:00Z',
  shelter: true,
  concessionprovidercode: 'VRA',
  ...over,
});

const noContacts = {
  gemeenten: new Map(), provincies: new Map(), waterschappen: new Map(), rijkswaterstaat: new Map(),
};

describe('quayLatLon', () => {
  const expected = toWgs84(545000, 6868000);

  it('parses every geom format', () => {
    assert.deepEqual(quayLatLon([545000, 6868000]), expected);
    assert.deepEqual(quayLatLon('POINT (545000 6868000)'), expected);
    assert.deepEqual(quayLatLon({ coordinates: [545000, 6868000] }), expected);
  });

  it('returns 0/0 for missing, short or unparsable geoms', () => {
    const zero = { lat: 0, lon: 0 };
    assert.deepEqual(quayLatLon(null), zero);
    assert.deepEqual(quayLatLon(undefined), zero);
    assert.deepEqual(quayLatLon([545000]), zero);
    assert.deepEqual(quayLatLon('garbage'), zero);
    assert.deepEqual(quayLatLon({}), zero);
    assert.deepEqual(quayLatLon({ coordinates: [545000] }), zero);
  });
});

describe('quayToStop', () => {
  it('builds the stop with a fixed key order', () => {
    const stop = quayToStop(quay());
    assert.deepEqual(Object.keys(stop), [
      'code', 'name', 'town', 'street', 'lat', 'lon', 'shelter', 'wheelchairAccessible',
      'visuallyAccessible', 'compassDirection', 'mutationDate', 'concessionProvider',
    ]);
    assert.equal(stop.wheelchairAccessible, false);
    assert.equal(stop.visuallyAccessible, true);
    assert.equal(stop.compassDirection, 90);
    assert.equal(stop.mutationDate, '2024-03-05');
    assert.equal(stop.concessionProvider, 'VRA');
  });

  it('fills defaults for missing fields', () => {
    const stop = quayToStop({ quaycode: 'NL:Q:2', compassdirection: '180' });
    assert.deepEqual(stop, {
      code: 'NL:Q:2', name: '', town: '', street: '', lat: 0, lon: 0, shelter: false,
      wheelchairAccessible: false, visuallyAccessible: false, compassDirection: null,
      mutationDate: null, concessionProvider: '',
    });
  });
});

describe('authorityType', () => {
  it('types by owner code prefix', () => {
    assert.equal(authorityType('P0026', null), 'provincie');
    assert.equal(authorityType('W0621', null), 'waterschap');
    assert.equal(authorityType('RWSZN', null), 'rijkswaterstaat');
    assert.equal(authorityType('G0363', null), 'gemeente');
    assert.equal(authorityType('G0363', { name: 'x' }), 'gemeente');
  });

  it('types unknown owners without contact as privaat', () => {
    assert.equal(authorityType('HOORNBEECK', null), 'privaat');
    assert.equal(authorityType('UNKNOWN', null), 'privaat');
    assert.equal(authorityType('HOORNBEECK', { name: 'x' }), 'gemeente');
  });
});

describe('buildAuthorities', () => {
  const contacts = {
    ...noContacts,
    gemeenten: new Map([['gm0363', { name: 'Gemeente Amsterdam', email: 'a@x.nl', website: null, phone: null }]]),
  };

  it('groups by owner in order of first appearance and sorts stops', () => {
    const inaccessible = [
      quay({ quaycode: 'NL:Q:1', town: 'Amsterdam', quayname: 'Spui' }),
      quay({ quaycode: 'NL:Q:2', quayownercode: 'HOORNBEECK', stopdatamanager: 'Hoornbeeck College' }),
      quay({ quaycode: 'NL:Q:3', town: 'Amsterdam', quayname: 'Dam' }),
      quay({ quaycode: 'NL:Q:4', town: 'Abcoude', quayname: 'Zuid' }),
    ];
    const accessible = quay({ quaycode: 'NL:Q:5', quaydisabledaccessible: true });
    const { authorities, unmatchedCount } = buildAuthorities([...inaccessible, accessible], inaccessible, contacts);

    assert.deepEqual(Object.keys(authorities), ['G0363', 'HOORNBEECK']);
    assert.equal(unmatchedCount, 1);

    const amsterdam = authorities.G0363;
    assert.equal(amsterdam.name, 'Gemeente Amsterdam');
    assert.equal(amsterdam.email, 'a@x.nl');
    assert.equal(amsterdam.totalBusQuays, 4);
    assert.equal(amsterdam.inaccessibleCount, 3);
    assert.deepEqual(amsterdam.stops.map(s => s.code), ['NL:Q:4', 'NL:Q:3', 'NL:Q:1']);

    assert.deepEqual(
      { type: authorities.HOORNBEECK.type, name: authorities.HOORNBEECK.name, email: authorities.HOORNBEECK.email },
      { type: 'privaat', name: 'Hoornbeeck College', email: null },
    );
  });

  it('falls back to the owner code as name and UNKNOWN as owner', () => {
    const inaccessible = [quay({ quayownercode: 'G9999' }), quay({ quayownercode: undefined })];
    const { authorities, unmatchedCount } = buildAuthorities(inaccessible, inaccessible, noContacts);
    assert.equal(authorities.G9999.name, 'G9999');
    assert.equal(authorities.G9999.type, 'gemeente');
    assert.equal(authorities.UNKNOWN.type, 'privaat');
    assert.equal(unmatchedCount, 2);
  });
});
