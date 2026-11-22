const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createStopSvg, stopMarkerTitle, stopPopupRows, boundaryMaskFeature } = require('../../docs/js/map.js');

describe('createStopSvg', () => {
  it('returns SVG with circle when no compass direction', () => {
    const svg = createStopSvg(null);
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('<circle'));
    assert.ok(!svg.includes('<polyline'), 'should not have chevron polyline');
  });

  it('returns SVG with circle when compass direction is undefined', () => {
    const svg = createStopSvg(undefined);
    assert.ok(svg.includes('<circle'));
    assert.ok(!svg.includes('<polyline'));
  });

  it('returns SVG with circle AND polyline for compass direction 180', () => {
    const svg = createStopSvg(180);
    assert.ok(svg.includes('<circle'));
    assert.ok(svg.includes('<polyline'), 'should have chevron polyline');
    assert.ok(svg.includes('rotate(180'), 'should rotate by 180 degrees');
  });

  it('returns SVG with circle AND polyline for compass direction 0', () => {
    const svg = createStopSvg(0);
    assert.ok(svg.includes('<circle'));
    assert.ok(svg.includes('<polyline'));
    assert.ok(svg.includes('rotate(0'));
  });

  it('has proper SVG structure', () => {
    const svg = createStopSvg(90);
    assert.ok(svg.startsWith('<svg'), 'should start with <svg');
    assert.ok(svg.endsWith('</svg>'), 'should end with </svg>');
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'should have xmlns');
    assert.ok(svg.includes('width="24"'), 'should have width 24');
    assert.ok(svg.includes('height="24"'), 'should have height 24');
  });

  it('handles compass direction 360 (boundary value)', () => {
    const svg = createStopSvg(360);
    assert.ok(svg.includes('<polyline'), 'should have chevron');
    assert.ok(svg.includes('rotate(360'), 'should rotate by 360');
  });

  it('handles negative compass direction', () => {
    const svg = createStopSvg(-90);
    assert.ok(svg.includes('<polyline'), 'should have chevron');
    assert.ok(svg.includes('rotate(-90'), 'should rotate by -90');
  });
});

describe('stopMarkerTitle', () => {
  const stop = (wheelchairAccessible, visuallyAccessible) => ({ name: 'A', town: 'B', wheelchairAccessible, visuallyAccessible });

  it('lists both problems', () => {
    assert.equal(stopMarkerTitle(stop(false, false)), 'A, B — niet rolstoeltoegankelijk, niet visueel toegankelijk');
  });

  it('lists one problem', () => {
    assert.equal(stopMarkerTitle(stop(false, true)), 'A, B — niet rolstoeltoegankelijk');
    assert.equal(stopMarkerTitle(stop(true, false)), 'A, B — niet visueel toegankelijk');
  });
});

describe('stopPopupRows', () => {
  const authority = { name: 'Gemeente Utrecht' };
  const providers = { PUT: { name: 'Provincie Utrecht' }, NONAME: { name: '' } };
  const stop = (over) => ({ code: 'NL:Q:1', street: 'Hoofdstraat', concessionProvider: 'PUT', ...over });

  it('lists street, code, authority and concession provider', () => {
    assert.deepEqual(stopPopupRows(stop(), authority, providers), [
      ['Straat', 'Hoofdstraat'],
      ['Halte', 'NL:Q:1'],
      ['Wegbeheerder', 'Gemeente Utrecht'],
      ['Concessieverlener', 'Provincie Utrecht'],
    ]);
  });

  it('skips an empty street', () => {
    assert.deepEqual(stopPopupRows(stop({ street: '' }), authority, providers)[0], ['Halte', 'NL:Q:1']);
  });

  it('skips unknown, nameless or missing concession providers', () => {
    const labels = (rows) => rows.map(r => r[0]);
    const base = ['Straat', 'Halte', 'Wegbeheerder'];
    assert.deepEqual(labels(stopPopupRows(stop({ concessionProvider: 'XYZ' }), authority, providers)), base);
    assert.deepEqual(labels(stopPopupRows(stop({ concessionProvider: 'NONAME' }), authority, providers)), base);
    assert.deepEqual(labels(stopPopupRows(stop({ concessionProvider: '' }), authority, providers)), base);
    assert.deepEqual(labels(stopPopupRows(stop(), authority, undefined)), base);
  });
});

describe('boundaryMaskFeature', () => {
  const world = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
  const ring = (x) => [[x, 0], [x + 1, 0], [x + 1, 1], [x, 0]];
  const inner = [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.2]];

  it('cuts the outer ring of a Polygon out of the world', () => {
    const mask = boundaryMaskFeature({ type: 'Polygon', coordinates: [ring(0), inner] });
    assert.deepEqual(mask, { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ring(0)] } });
  });

  it('cuts one hole per polygon of a MultiPolygon', () => {
    const mask = boundaryMaskFeature({ type: 'MultiPolygon', coordinates: [[ring(0), inner], [ring(5)]] });
    assert.deepEqual(mask.geometry.coordinates, [world, ring(0), ring(5)]);
  });

  it('returns only the world for other geometry types', () => {
    assert.deepEqual(boundaryMaskFeature({ type: 'Point', coordinates: [0, 0] }).geometry.coordinates, [world]);
  });
});

describe('map.js globals', () => {
  it('adds only the pure helpers to the global scope, the rest stays inside MapView', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const path = require('node:path');
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../docs/js/map.js'), 'utf8'), context);
    assert.deepEqual(Object.keys(context).sort(),
      ['boundaryMaskFeature', 'createStopSvg', 'stopMarkerTitle', 'stopPopupRows']);
    assert.deepEqual(Object.keys(vm.runInContext('MapView', context)).sort(),
      ['filterByAuthority', 'init', 'resetView', 'zoomToAuthority', 'zoomToStop']);
  });
});
