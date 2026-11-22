#!/usr/bin/env node
// Data pipeline: fetches DOVA quays + Allmanak contact info, outputs bus-stops.json
// Usage: node pipeline/fetch-data.js
// Requires Node 18+ (built-in fetch)

const fs = require('fs');
const path = require('path');

const DOVA_BASE = 'https://halteviewer.ov-data.nl/halteviewer';
const ALLMANAK_BASE = 'https://rest-api.allmanak.nl/v1';
const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');

// Per-attempt timeouts; slow calls measured in the daily workflow (#9)
const DEFAULT_TIMEOUT_MS = 20_000;
const DOVA_TIMEOUT_MS = 60_000;     // getQuays: 2–7 s, max seen 26 s
const BOUNDARY_TIMEOUT_MS = 90_000; // PDOK/ArcGIS geometry: max seen 42 s

// EPSG:3857 → WGS84 conversion
function toWgs84(x, y) {
  const lon = (x / 20037508.34) * 180;
  const lat = Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI - 90;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}

const MAX_RETRY_DELAY_MS = 15_000;

// Exponential backoff with ±25% jitter: ~2 s, ~4 s, … capped at 15 s
function retryDelay(attempt) {
  return Math.round(Math.min(1000 * 2 ** attempt * (0.75 + Math.random() * 0.5), MAX_RETRY_DELAY_MS));
}

async function fetchJson(url, options = {}, retries = 3, timeoutMs = DEFAULT_TIMEOUT_MS) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.retryable = res.status < 400 || res.status >= 500;
        throw err;
      }
      return await res.json();
    } catch (err) {
      if (controller.signal.aborted) err = new Error(`Timed out after ${timeoutMs}ms for ${url}`, { cause: err });
      // Only HTTP 4xx sets retryable = false; network, timeout and parse errors leave it undefined and are retried
      if (attempt === retries || err.retryable === false) throw err;
      const delay = retryDelay(attempt);
      console.warn(`  Retry ${attempt}/${retries} for ${url}: ${err.message} (waiting ${delay}ms)`);
      await new Promise(r => setTimeout(r, delay));
    } finally {
      clearTimeout(timer);
    }
  }
}

async function dovaPost(endpoint) {
  const data = await fetchJson(`${DOVA_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: [] }),
  }, 3, DOVA_TIMEOUT_MS);
  if (data.error) throw new Error(`DOVA error: ${data.error.message}`);
  return data.result;
}

// Step 1+2: Fetch all quays, filter to inaccessible bus stops
async function fetchInaccessibleBusStops() {
  console.log('Fetching all quays from DOVA...');
  const quays = await dovaPost('getQuays');
  console.log(`  Total quays: ${quays.length}`);

  const FOREIGN_OWNERS = new Set(['DUITSLAND', 'BELGIE']);
  const busQuays = quays.filter(q =>
    q.transportmode === 'bus' &&
    q.quaystatus === 'available' &&
    !FOREIGN_OWNERS.has(q.quayownercode) &&
    q.quaycode.startsWith('NL:')
  );
  console.log(`  Active bus quays: ${busQuays.length}`);

  const inaccessible = busQuays.filter(q =>
    q.quaydisabledaccessible === false || q.quayvisuallyaccessible === false
  );
  console.log(`  Not fully accessible bus quays: ${inaccessible.length}`);

  return { allBusQuays: busQuays, inaccessible };
}

// Step 4: Fetch authority contact info from Allmanak
const tooiId = (ids, fragment) =>
  ids.find(r => r.naam === 'resourceIdentifierTOOI' && r.value && r.value.includes(fragment));

// "gm0737" from Organisatiecode; fallback: TOOI URI (merged gemeenten lack Organisatiecode)
function gemeenteCode(ids) {
  const orgCode = ids.find(r => r.naam === 'Organisatiecode');
  if (orgCode && orgCode.value) return orgCode.value;
  const tooi = tooiId(ids, '/gemeente/gm');
  const match = tooi && tooi.value.match(/\/(gm\d+)/);
  return match ? match[1] : null;
}

// "pv21" from TOOI URI like ".../pv21", else from Organisatiecode
function provincieCode(ids) {
  const candidates = [tooiId(ids, '/pv'), ids.find(r => r.naam === 'Organisatiecode')];
  for (const id of candidates) {
    const match = id && id.value && id.value.match(/pv(\d+)/);
    if (match) return `pv${match[1]}`;
  }
  return null;
}

// "ws0621" from TOOI URI like ".../waterschap/ws0621"
function waterschapCode(ids) {
  const tooi = tooiId(ids, '/waterschap/ws');
  const match = tooi && tooi.value.match(/ws(\d+)/);
  return match ? `ws${match[1]}` : null;
}

// Derive e.g. "info@example.nl" from "https://www.example.nl"
function emailFromWebsite(website, user) {
  if (!user || !website) return null;
  try {
    return `${user}@${new URL(website).hostname.replace(/^www\./, '')}`;
  } catch (_) {
    return null;
  }
}

function allmanakContact(org, { fallbackEmailUser = null, defaultName = '' }) {
  const contact = org.contact || {};
  const first = (list, field) => (list && list.length > 0 ? list[0][field] : null);
  const website = first(contact.internetadressen, 'url');
  const email = first(contact.emailadressen, 'email') || emailFromWebsite(website, fallbackEmailUser);
  return {
    name: org.naam || defaultName,
    email: email || null,
    website: website || null,
    phone: first(contact.telefoonnummers, 'nummer') || null,
  };
}

// Keys match ownerCodeToAllmanakKey().source
const ALLMANAK_SOURCES = {
  gemeenten: {
    filter: 'types=cs.%7BGemeente%7D&einddatum=is.null&limit=500',
    codeOf: gemeenteCode,
    fallbackEmailUser: 'gemeente',
  },
  provincies: {
    filter: 'types=cs.%7BProvincie%7D&einddatum=is.null&limit=50',
    codeOf: provincieCode,
    fallbackEmailUser: 'info',
  },
  waterschappen: {
    filter: 'types=cs.%7BWaterschap%7D&einddatum=is.null&limit=50',
    codeOf: waterschapCode,
    fallbackEmailUser: 'info',
  },
  // No email fallback: Rijkswaterstaat has no generic info@ address
  rijkswaterstaat: {
    filter: 'naam=eq.Rijkswaterstaat&einddatum=is.null&limit=1',
    codeOf: () => 'rws',
    defaultName: 'Rijkswaterstaat',
  },
};

// Fetch one Allmanak organisation type → Map(code → { name, email, website, phone })
async function fetchAllmanak(label, source) {
  console.log(`Fetching ${label} from Allmanak...`);
  const data = await fetchJson(`${ALLMANAK_BASE}/overheidsorganisatie?${source.filter}`, {
    headers: { 'Accept': 'application/json' },
  });
  const map = new Map();
  for (const org of data) {
    const code = source.codeOf(org.resourceidentifiers || []);
    if (code) map.set(code, allmanakContact(org, source));
  }
  console.log(`  ${label} loaded: ${map.size}`);
  return map;
}

// All authority contacts, fetched in parallel: { gemeenten: Map, provincies: Map, … }
async function fetchAllmanakContacts() {
  const labels = Object.keys(ALLMANAK_SOURCES);
  const maps = await Promise.all(labels.map(label => fetchAllmanak(label, ALLMANAK_SOURCES[label])));
  return Object.fromEntries(labels.map((label, i) => [label, maps[i]]));
}

// Old gemeente codes that were absorbed into new municipalities
const GEMEENTE_REMAP = {
  'G0196': 'gm0299',  // Rijnwaarden → Zevenaar
  'G0530': 'gm1992',  // Hellevoetsluis → Voorne aan Zee
  'G0786': 'gm1982',  // Grave → Land van Cuijk
  'G1702': 'gm1982',  // Sint Anthonis → Land van Cuijk
};

// Map DOVA ownercode to Allmanak lookup key and source map
function ownerCodeToAllmanakKey(ownerCode) {
  if (!ownerCode) return null;
  if (ownerCode.startsWith('G')) {
    const remapped = GEMEENTE_REMAP[ownerCode];
    if (remapped) return { source: 'gemeenten', key: remapped };
    // G0737 → gm0737
    return { source: 'gemeenten', key: 'gm' + ownerCode.slice(1) };
  }
  if (ownerCode.startsWith('P')) {
    // P0021 → pv21 (strip leading zeros)
    const num = parseInt(ownerCode.slice(1), 10);
    return { source: 'provincies', key: 'pv' + num };
  }
  if (ownerCode.startsWith('W')) {
    // W0621 → ws0621
    return { source: 'waterschappen', key: 'ws' + ownerCode.slice(1) };
  }
  if (ownerCode.startsWith('RWS')) {
    return { source: 'rijkswaterstaat', key: 'rws' };
  }
  return null;
}

// Allmanak contact for a DOVA owner code, or null
function findContact(ownerCode, contacts) {
  const lookup = ownerCodeToAllmanakKey(ownerCode);
  const source = lookup && contacts[lookup.source];
  return (source && source.get(lookup.key)) || null;
}

// Fetch concession provider names from DOVA (using a sample quay per provider)
async function fetchConcessionProviderNames(providerCodes) {
  // Known concession providers (from DOVA data, manually mapped)
  // The API doesn't have a bulk endpoint for this, so we use a static map
  // supplemented by whatever we can resolve
  const knownProviders = {
    'ALM': { name: 'Gemeente Almere', email: null, website: 'https://www.almere.nl' },
    'BE': { name: 'Provincie Drenthe (Bus Emmen)', email: null, website: 'https://www.provincie.drenthe.nl' },
    'DE': { name: 'Provincie Drenthe', email: null, website: 'https://www.provincie.drenthe.nl' },
    'FLV': { name: 'Provincie Flevoland', email: null, website: 'https://www.flevoland.nl' },
    'FR': { name: 'Provincie Fryslân', email: null, website: 'https://www.fryslan.frl' },
    'GLD': { name: 'Provincie Gelderland', email: null, website: 'https://www.gelderland.nl' },
    'LMB': { name: 'Provincie Limburg', email: null, website: 'https://www.limburg.nl' },
    'MRDH': { name: 'Metropoolregio Rotterdam Den Haag', email: null, website: 'https://mrdh.nl' },
    'OVGD': { name: 'Provincie Overijssel/Gelderland', email: null, website: 'https://www.overijssel.nl' },
    'OVS': { name: 'Provincie Overijssel', email: null, website: 'https://www.overijssel.nl' },
    'PNB': { name: 'Provincie Noord-Brabant', email: null, website: 'https://www.brabant.nl' },
    'PNH': { name: 'Provincie Noord-Holland', email: null, website: 'https://www.noord-holland.nl' },
    'PUT': { name: 'Provincie Utrecht', email: null, website: 'https://www.provincie-utrecht.nl' },
    'PZH': { name: 'Provincie Zuid-Holland', email: null, website: 'https://www.zuid-holland.nl' },
    'VRA': { name: 'Vervoerregio Amsterdam', email: null, website: 'https://vervoerregio.nl' },
    'ZLD': { name: 'Provincie Zeeland', email: null, website: 'https://www.zeeland.nl' },
  };

  const result = {};
  for (const code of providerCodes) {
    result[code] = knownProviders[code] || { name: code, email: null, website: null };
  }
  return result;
}

// Fetch administrative boundaries from PDOK and save as individual GeoJSON files
async function fetchAndSaveBoundaries(authorities, boundariesDir = path.join(DATA_DIR, 'boundaries')) {
  fs.mkdirSync(boundariesDir, { recursive: true });

  console.log('Fetching boundaries from PDOK...');

  const pdokBase = 'https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0';
  const gemeenteUrl = `${pdokBase}?service=WFS&version=2.0.0&request=GetFeature&typeName=bestuurlijkegebieden:Gemeentegebied&outputFormat=json&srsName=EPSG:4326&count=500`;
  const provincieUrl = `${pdokBase}?service=WFS&version=2.0.0&request=GetFeature&typeName=bestuurlijkegebieden:Provinciegebied&outputFormat=json&srsName=EPSG:4326&count=500`;

  const waterschapUrl = 'https://services.arcgis.com/nSZVuSZjHpEZZbRo/arcgis/rest/services/Waterschapsgrenzen/FeatureServer/0/query?where=1%3D1&outFields=waterschapcode,naam,waterschap&f=geojson&resultRecordCount=50&outSR=4326';

  const [gemeenteData, provincieData, waterschapData] = await Promise.all([
    fetchJson(gemeenteUrl, {}, 3, BOUNDARY_TIMEOUT_MS).catch(err => { console.warn('  Failed to fetch gemeente boundaries:', err.message); return null; }),
    fetchJson(provincieUrl, {}, 3, BOUNDARY_TIMEOUT_MS).catch(err => { console.warn('  Failed to fetch provincie boundaries:', err.message); return null; }),
    fetchJson(waterschapUrl, {}, 3, BOUNDARY_TIMEOUT_MS).catch(err => { console.warn('  Failed to fetch waterschap boundaries:', err.message); return null; }),
  ]);

  // Build reverse map: for remapped gemeenten, map the target gm code back to the original ownerCode
  // e.g. GEMEENTE_REMAP['G0196'] = 'gm0299' means PDOK code "0299" → ownerCode "G0196"
  const remapTarget = {}; // pdokCode → ownerCode
  for (const [ownerCode, gmCode] of Object.entries(GEMEENTE_REMAP)) {
    const pdokCode = gmCode.replace('gm', '');
    remapTarget[pdokCode] = ownerCode;
  }

  let saved = 0;

  // Process gemeente boundaries
  if (gemeenteData && gemeenteData.features) {
    for (const feature of gemeenteData.features) {
      const pdokCode = feature.properties.code;
      if (!pdokCode) continue;

      // Check if this PDOK code is a remap target
      let ownerCode = remapTarget[pdokCode];
      if (!ownerCode) {
        // Normal mapping: PDOK "0263" → "G0263"
        ownerCode = 'G' + pdokCode;
      }

      if (!authorities[ownerCode]) continue;

      const outFile = path.join(boundariesDir, `${ownerCode}.json`);
      fs.writeFileSync(outFile, JSON.stringify(feature.geometry));
      saved++;
    }
  }

  // Process provincie boundaries
  if (provincieData && provincieData.features) {
    for (const feature of provincieData.features) {
      const pdokCode = feature.properties.code;
      if (!pdokCode) continue;

      // Find matching ownerCode: PDOK "24" → ownerCode where parseInt(slice(1)) matches
      const matchingOwnerCode = Object.keys(authorities).find(oc =>
        oc.startsWith('P') && parseInt(oc.slice(1), 10).toString() === pdokCode
      );
      if (!matchingOwnerCode) continue;

      const outFile = path.join(boundariesDir, `${matchingOwnerCode}.json`);
      fs.writeFileSync(outFile, JSON.stringify(feature.geometry));
      saved++;
    }
  }

  // Process waterschap boundaries (matched by name)
  if (waterschapData && waterschapData.features) {
    const wsAuthorities = Object.entries(authorities)
      .filter(([, auth]) => auth.type === 'waterschap');

    for (const feature of waterschapData.features) {
      const names = [feature.properties.waterschap, feature.properties.naam]
        .filter(Boolean).map(n => n.toLowerCase());
      if (names.length === 0) continue;

      const match = wsAuthorities.find(([, auth]) => {
        const authName = auth.name.toLowerCase();
        return names.some(n => n.includes(authName) || authName.includes(n));
      });
      if (!match) continue;

      const ownerCode = match[0];
      const outFile = path.join(boundariesDir, `${ownerCode}.json`);
      fs.writeFileSync(outFile, JSON.stringify(feature.geometry));
      saved++;
    }
  }

  console.log(`  Boundaries saved: ${saved}`);
}

// 16 curated large cities for the "grote steden" table (DOVA owner codes)
const LARGE_CITIES = [
  'G0363', // Amsterdam
  'G0599', // Rotterdam
  'G0518', // Den Haag
  'G0344', // Utrecht
  'G0772', // Eindhoven
  'G0855', // Tilburg
  'G0014', // Groningen
  'G0034', // Almere
  'G0153', // Enschede
  'G0268', // Nijmegen
  'G0392', // Haarlem
  'G0080', // Leeuwarden
  'G0758', // Breda
  'G0202', // Arnhem
  'G0935', // Maastricht
  'G0307', // Amersfoort
];

function generateStats(allBusQuays, inaccessible, authorities) {
  // Global totals from allBusQuays (not just inaccessible)
  let totalWheelchairInaccessible = 0;
  let totalVisuallyInaccessible = 0;
  let totalWithShelter = 0;
  for (const q of allBusQuays) {
    if (q.quaydisabledaccessible === false) totalWheelchairInaccessible++;
    if (q.quayvisuallyaccessible === false) totalVisuallyInaccessible++;
    if (q.shelter === true) totalWithShelter++;
  }

  const totalBusQuays = allBusQuays.length;
  const inaccessibleCount = inaccessible.length;

  // Per-authority detailed counts (wheelchair, visual, shelter)
  // We need to count from inaccessible quays grouped by owner
  const ownerDetails = new Map();
  for (const q of inaccessible) {
    const owner = q.quayownercode || 'UNKNOWN';
    if (!ownerDetails.has(owner)) {
      ownerDetails.set(owner, { wheelchair: 0, visual: 0, noShelter: 0 });
    }
    const d = ownerDetails.get(owner);
    if (q.quaydisabledaccessible === false) d.wheelchair++;
    if (q.quayvisuallyaccessible === false) d.visual++;
    if (q.shelter !== true) d.noShelter++;
  }

  // Build per-authority stat rows
  const authRows = [];
  for (const [code, auth] of Object.entries(authorities)) {
    const detail = ownerDetails.get(code) || { wheelchair: 0, visual: 0, noShelter: 0 };
    const pct = auth.totalBusQuays > 0 ? Math.round((auth.inaccessibleCount / auth.totalBusQuays) * 100) : 0;
    authRows.push({
      code,
      name: auth.name,
      type: auth.type,
      total: auth.totalBusQuays,
      inaccessible: auth.inaccessibleCount,
      pct,
      wheelchair: detail.wheelchair,
      visual: detail.visual,
      noShelter: detail.noShelter,
    });
  }

  // Filter helpers
  const gemeentes = authRows.filter(a => a.type === 'gemeente');
  const min10 = gemeentes.filter(a => a.total >= 10);

  // Worst gemeentes: 100% inaccessible, >=10 stops, sorted by stop count desc
  const worstGemeentes = min10
    .filter(a => a.pct === 100)
    .sort((a, b) => b.inaccessible - a.inaccessible);

  // Most inaccessible gemeentes: top 5 by absolute count, desc
  const mostInaccessibleGemeentes = [...gemeentes]
    .sort((a, b) => b.inaccessible - a.inaccessible)
    .slice(0, 5);

  // Best gemeentes: top 5 by lowest %, >=10 stops, sorted asc
  const bestGemeentes = [...min10]
    .sort((a, b) => a.pct - b.pct || a.inaccessible - b.inaccessible)
    .slice(0, 5);

  // Large cities
  const largeCities = LARGE_CITIES
    .map(code => authRows.find(a => a.code === code))
    .filter(Boolean)
    .sort((a, b) => a.pct - b.pct || a.inaccessible - b.inaccessible);

  // Provincies
  const provincies = authRows
    .filter(a => a.type === 'provincie')
    .sort((a, b) => b.pct - a.pct || b.inaccessible - a.inaccessible);

  // Waterschappen
  const waterschappen = authRows
    .filter(a => a.type === 'waterschap')
    .sort((a, b) => b.pct - a.pct || b.inaccessible - a.inaccessible);

  // Authority types aggregated
  const typeAgg = {};
  for (const a of authRows) {
    const t = a.type;
    if (!typeAgg[t]) typeAgg[t] = { total: 0, inaccessible: 0, wheelchair: 0, visual: 0 };
    typeAgg[t].total += a.total;
    typeAgg[t].inaccessible += a.inaccessible;
    typeAgg[t].wheelchair += a.wheelchair;
    typeAgg[t].visual += a.visual;
  }
  const authorityTypes = ['gemeente', 'provincie', 'waterschap', 'rijkswaterstaat']
    .filter(t => typeAgg[t])
    .map(t => ({
      type: t,
      label: t.charAt(0).toUpperCase() + t.slice(1),
      total: typeAgg[t].total,
      inaccessible: typeAgg[t].inaccessible,
      pct: typeAgg[t].total > 0 ? Math.round((typeAgg[t].inaccessible / typeAgg[t].total) * 100) : 0,
      wheelchair: typeAgg[t].wheelchair,
      visual: typeAgg[t].visual,
    }));

  // Conclusions
  const gemeentesOver50 = gemeentes.filter(a => a.pct > 50).length;
  const totalGemeentes = gemeentes.length;
  const bestCity = largeCities.length > 0 ? largeCities[0] : null;
  const wsType = authorityTypes.find(t => t.type === 'waterschap');
  const wsPct = wsType ? wsType.pct : 0;

  // Count inaccessible stops without shelter
  let inaccessibleNoShelter = 0;
  for (const q of inaccessible) {
    if (q.shelter !== true) inaccessibleNoShelter++;
  }
  const shelterPct = inaccessibleCount > 0 ? Math.round((inaccessibleNoShelter / inaccessibleCount) * 100) : 0;

  // Top 10 share
  const top10 = [...gemeentes].sort((a, b) => b.inaccessible - a.inaccessible).slice(0, 10);
  const top10Total = top10.reduce((s, a) => s + a.inaccessible, 0);
  const top10Pct = inaccessibleCount > 0 ? Math.round((top10Total / inaccessibleCount) * 100) : 0;

  const hasZeroPct = min10.some(a => a.pct === 0);

  const wheelchairPct = totalBusQuays > 0 ? Math.round((totalWheelchairInaccessible / totalBusQuays) * 100) : 0;
  const visualPct = totalBusQuays > 0 ? Math.round((totalVisuallyInaccessible / totalBusQuays) * 100) : 0;
  const inaccessiblePct = totalBusQuays > 0 ? Math.round((inaccessibleCount / totalBusQuays) * 100) : 0;

  return {
    generated: new Date().toISOString(),
    totals: {
      totalBusQuays,
      inaccessibleBusQuays: inaccessibleCount,
      inaccessiblePct,
      wheelchairInaccessible: totalWheelchairInaccessible,
      wheelchairPct,
      visuallyInaccessible: totalVisuallyInaccessible,
      visualPct,
    },
    worstGemeentes,
    mostInaccessibleGemeentes,
    bestGemeentes,
    largeCities,
    provincies,
    waterschappen,
    authorityTypes,
    conclusions: {
      hasZeroPct,
      gemeentesOver50,
      totalGemeentes,
      gemeentesOver50Pct: totalGemeentes > 0 ? Math.round((gemeentesOver50 / totalGemeentes) * 100) : 0,
      visualPct,
      wheelchairPct,
      wsPct,
      bestCityName: bestCity ? bestCity.name : '',
      bestCityPct: bestCity ? bestCity.pct : 0,
      bestCityTotal: bestCity ? bestCity.total : 0,
      shelterPct,
      top10Pct,
    },
  };
}

async function main(dataDir = DATA_DIR) {
  const startTime = Date.now();

  // Step 1+2: Fetch quays
  const { allBusQuays, inaccessible } = await fetchInaccessibleBusStops();

  // Step 4+5: Fetch authority contact info (in parallel)
  const contacts = await fetchAllmanakContacts();

  // Step 6: Group inaccessible stops by quayownercode
  const authoritiesMap = new Map();
  const concessionProviderCodes = new Set();

  // Also count total bus quays per authority
  const totalBusQuaysByOwner = new Map();
  for (const q of allBusQuays) {
    const owner = q.quayownercode || 'UNKNOWN';
    totalBusQuaysByOwner.set(owner, (totalBusQuaysByOwner.get(owner) || 0) + 1);
  }

  for (const q of inaccessible) {
    const ownerCode = q.quayownercode || 'UNKNOWN';
    if (!authoritiesMap.has(ownerCode)) {
      authoritiesMap.set(ownerCode, { stops: [] });
    }

    // Parse coordinates from geom ([x, y] array in EPSG:3857)
    let lat = 0, lon = 0;
    if (q.geom) {
      let x, y;
      if (Array.isArray(q.geom) && q.geom.length >= 2) {
        [x, y] = q.geom;
      } else if (typeof q.geom === 'string') {
        const match = q.geom.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/);
        if (match) { x = parseFloat(match[1]); y = parseFloat(match[2]); }
      } else if (q.geom.coordinates) {
        [x, y] = q.geom.coordinates;
      }
      if (x !== undefined && y !== undefined) {
        const wgs = toWgs84(x, y);
        lat = wgs.lat;
        lon = wgs.lon;
      }
    }

    const providerCode = q.concessionprovidercode || '';
    if (providerCode) concessionProviderCodes.add(providerCode);

    authoritiesMap.get(ownerCode).stops.push({
      code: q.quaycode,
      name: q.quayname || '',
      town: q.town || '',
      street: q.street || '',
      lat,
      lon,
      shelter: q.shelter === true,
      wheelchairAccessible: q.quaydisabledaccessible === true,
      visuallyAccessible: q.quayvisuallyaccessible === true,
      compassDirection: typeof q.compassdirection === 'number' ? q.compassdirection : null,
      mutationDate: q.mutationdate ? new Date(q.mutationdate).toISOString().slice(0, 10) : null,
      concessionProvider: providerCode,
    });
  }

  // Build a name map from stopdatamanager field (for unmatched authorities)
  const stopdatamanagerNames = new Map();
  for (const q of inaccessible) {
    const owner = q.quayownercode || 'UNKNOWN';
    if (!stopdatamanagerNames.has(owner) && q.stopdatamanager) {
      stopdatamanagerNames.set(owner, q.stopdatamanager);
    }
  }

  // Resolve authority names and contact info
  const authorities = {};
  let unmatchedCount = 0;

  for (const [ownerCode, data] of authoritiesMap) {
    const contact = findContact(ownerCode, contacts);

    if (!contact) {
      unmatchedCount++;
    }

    let type = 'gemeente';
    if (ownerCode.startsWith('P')) type = 'provincie';
    else if (ownerCode.startsWith('W')) type = 'waterschap';
    else if (ownerCode.startsWith('RWS')) type = 'rijkswaterstaat';
    else if (!contact && !ownerCode.startsWith('G')) type = 'privaat';

    // Use stopdatamanager name as fallback
    const fallbackName = stopdatamanagerNames.get(ownerCode) || ownerCode;

    authorities[ownerCode] = {
      type,
      name: contact ? contact.name : fallbackName,
      email: contact ? contact.email : null,
      website: contact ? contact.website : null,
      phone: contact ? contact.phone : null,
      totalBusQuays: totalBusQuaysByOwner.get(ownerCode) || 0,
      inaccessibleCount: data.stops.length,
      stops: data.stops.sort((a, b) => a.town.localeCompare(b.town) || a.name.localeCompare(b.name)),
    };
  }

  // Fetch and save boundary files
  await fetchAndSaveBoundaries(authorities, path.join(dataDir, 'boundaries'));

  // Fetch concession provider info
  const concessionProviders = await fetchConcessionProviderNames(concessionProviderCodes);

  const output = {
    generated: new Date().toISOString(),
    totals: {
      totalBusQuays: allBusQuays.length,
      inaccessibleBusQuays: inaccessible.length,
      authorities: Object.keys(authorities).length,
    },
    authorities,
    concessionProviders,
  };

  // Generate stats for feiten.html
  const stats = generateStats(allBusQuays, inaccessible, authorities);
  const statsPath = path.join(dataDir, 'stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`Stats written: ${statsPath}`);

  // Write output
  const outPath = path.join(dataDir, 'bus-stops.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
  console.log(`Output: ${outPath}`);
  console.log(`  Total bus quays: ${output.totals.totalBusQuays}`);
  console.log(`  Inaccessible: ${output.totals.inaccessibleBusQuays}`);
  console.log(`  Authorities: ${output.totals.authorities}`);
  console.log(`  Unmatched authorities: ${unmatchedCount}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}

module.exports = {
  toWgs84,
  ownerCodeToAllmanakKey,
  generateStats,
  fetchJson,
  retryDelay,
  fetchConcessionProviderNames,
  GEMEENTE_REMAP,
  LARGE_CITIES,
  gemeenteCode,
  provincieCode,
  waterschapCode,
  allmanakContact,
  fetchAllmanak,
  ALLMANAK_SOURCES,
  findContact,
  main,
};
