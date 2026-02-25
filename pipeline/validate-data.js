#!/usr/bin/env node
'use strict';

const { readFileSync } = require('fs');
const { join } = require('path');

const DATA_DIR = join(__dirname, '..', 'docs', 'data');
const BUS_STOPS_PATH = join(DATA_DIR, 'bus-stops.json');
const STATS_PATH = join(DATA_DIR, 'stats.json');

const THRESHOLDS = {
  totalBusQuays: 30_000,
  inaccessibleBusQuays: 1_000,
  authorities: 100,
};

function validate(busStopsPath, statsPath) {
  const errors = [];

  // --- Load bus-stops.json ---
  let busStops;
  try {
    busStops = JSON.parse(readFileSync(busStopsPath, 'utf-8'));
  } catch (err) {
    errors.push(`Failed to read bus-stops.json: ${err.message}`);
    return errors;
  }

  // --- Check generated timestamp ---
  if (!busStops.generated || isNaN(Date.parse(busStops.generated))) {
    errors.push('bus-stops.json: missing or invalid "generated" timestamp');
  }

  // --- Check totals ---
  const totals = busStops.totals || {};

  if ((totals.totalBusQuays ?? 0) < THRESHOLDS.totalBusQuays) {
    errors.push(
      `bus-stops.json: totalBusQuays (${totals.totalBusQuays ?? 'missing'}) below threshold ${THRESHOLDS.totalBusQuays}`
    );
  }

  if ((totals.inaccessibleBusQuays ?? 0) < THRESHOLDS.inaccessibleBusQuays) {
    errors.push(
      `bus-stops.json: inaccessibleBusQuays (${totals.inaccessibleBusQuays ?? 'missing'}) below threshold ${THRESHOLDS.inaccessibleBusQuays}`
    );
  }

  const authorityCount = Object.keys(busStops.authorities || {}).length;
  if (authorityCount < THRESHOLDS.authorities) {
    errors.push(
      `bus-stops.json: authority count (${authorityCount}) below threshold ${THRESHOLDS.authorities}`
    );
  }

  // --- Check every authority has a name and at least 1 stop ---
  for (const [code, auth] of Object.entries(busStops.authorities || {})) {
    if (!auth.name) {
      errors.push(`bus-stops.json: authority "${code}" has no name`);
    }
    if (!Array.isArray(auth.stops) || auth.stops.length === 0) {
      errors.push(`bus-stops.json: authority "${code}" has no stops`);
    }
  }

  // --- Load and cross-check stats.json ---
  let stats;
  try {
    stats = JSON.parse(readFileSync(statsPath, 'utf-8'));
  } catch (err) {
    errors.push(`Failed to read stats.json: ${err.message}`);
    return errors;
  }

  const statsTotalQuays = stats.totals?.totalBusQuays;
  if (statsTotalQuays !== totals.totalBusQuays) {
    errors.push(
      `stats.json totalBusQuays (${statsTotalQuays}) does not match bus-stops.json (${totals.totalBusQuays})`
    );
  }

  return errors;
}

// --- Main (when run directly) ---
if (require.main === module) {
  const errors = validate(BUS_STOPS_PATH, STATS_PATH);

  if (errors.length === 0) {
    console.log('Validation passed.');
    process.exit(0);
  } else {
    console.error('Validation FAILED:');
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }
}

module.exports = { validate, THRESHOLDS };
