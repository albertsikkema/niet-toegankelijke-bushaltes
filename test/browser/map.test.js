const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createStopSvg } = require('../../docs/js/map.js');

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
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes('width="24"'));
    assert.ok(svg.includes('height="24"'));
  });
});
