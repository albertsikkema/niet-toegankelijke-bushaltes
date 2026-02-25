#!/usr/bin/env node
// Data pipeline: fetches DOVA quays + Allmanak contact info, outputs bus-stops.json
// Usage: node pipeline/fetch-data.js
// Requires Node 18+ (built-in fetch)

const fs = require('fs');
const path = require('path');

const DOVA_BASE = 'https://halteviewer.ov-data.nl/halteviewer';
const ALLMANAK_BASE = 'https://rest-api.allmanak.nl/v1';

// EPSG:3857 → WGS84 conversion
function toWgs84(x, y) {
  const lon = (x / 20037508.34) * 180;
  const lat = Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI - 90;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}

async function fetchJson(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 2000;
      console.warn(`  Retry ${attempt}/${retries} for ${url}: ${err.message} (waiting ${delay}ms)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function dovaPost(endpoint) {
  const data = await fetchJson(`${DOVA_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: [] }),
  });
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

// Step 4: Fetch Allmanak gemeenten
async function fetchAllmanakGemeenten() {
  console.log('Fetching gemeenten from Allmanak...');
  const url = `${ALLMANAK_BASE}/overheidsorganisatie?types=cs.%7BGemeente%7D&einddatum=is.null&limit=500`;
  const data = await fetchJson(url, {
    headers: { 'Accept': 'application/json' },
  });

  const map = new Map();
  for (const org of data) {
    // Find Organisatiecode resource identifier (e.g. "gm0737")
    // Fallback: extract from TOOI URI for merged gemeenten missing Organisatiecode
    const ids = org.resourceidentifiers || [];
    const orgCode = ids.find(r => r.naam === 'Organisatiecode');
    let code = orgCode ? orgCode.value : null;

    if (!code) {
      const tooiId = ids.find(r =>
        r.naam === 'resourceIdentifierTOOI' &&
        r.value && r.value.includes('/gemeente/gm')
      );
      if (tooiId) {
        const match = tooiId.value.match(/\/(gm\d+)/);
        if (match) code = match[1];
      }
    }
    if (!code) continue;
    const contact = org.contact || {};
    const emails = contact.emailadressen || [];
    const websites = contact.internetadressen || [];
    const phones = contact.telefoonnummers || [];

    let email = emails.length > 0 ? emails[0].email : null;
    const website = websites.length > 0 ? websites[0].url : null;
    const phone = phones.length > 0 ? phones[0].nummer : null;

    // Fallback: derive email from website domain
    if (!email && website) {
      try {
        const domain = new URL(website).hostname.replace(/^www\./, '');
        email = `gemeente@${domain}`;
      } catch (_) { /* ignore */ }
    }

    map.set(code, {
      name: org.naam || '',
      email: email || null,
      website: website || null,
      phone: phone || null,
    });
  }

  console.log(`  Gemeenten loaded: ${map.size}`);
  return map;
}

// Step 4b: Fetch Allmanak provinces
async function fetchAllmanakProvincies() {
  console.log('Fetching provincies from Allmanak...');
  const url = `${ALLMANAK_BASE}/overheidsorganisatie?types=cs.%7BProvincie%7D&einddatum=is.null&limit=50`;
  const data = await fetchJson(url, {
    headers: { 'Accept': 'application/json' },
  });

  const map = new Map();
  for (const org of data) {
    const ids = org.resourceidentifiers || [];
    // Look for TOOI identifier containing province code
    const tooiId = ids.find(r =>
      r.naam === 'resourceIdentifierTOOI' &&
      r.value && r.value.includes('/pv')
    );
    // Also try Organisatiecode
    const orgCode = ids.find(r => r.naam === 'Organisatiecode');

    let pvCode = null;
    if (tooiId && tooiId.value) {
      // Extract pv{number} from TOOI URI like ".../pv21"
      const match = tooiId.value.match(/pv(\d+)/);
      if (match) pvCode = `pv${match[1]}`;
    }
    if (!pvCode && orgCode && orgCode.value) {
      const match = orgCode.value.match(/pv(\d+)/);
      if (match) pvCode = `pv${match[1]}`;
    }
    if (!pvCode) continue;

    const contact = org.contact || {};
    const emails = contact.emailadressen || [];
    const websites = contact.internetadressen || [];
    const phones = contact.telefoonnummers || [];

    let email = emails.length > 0 ? emails[0].email : null;
    const website = websites.length > 0 ? websites[0].url : null;
    const phone = phones.length > 0 ? phones[0].nummer : null;

    if (!email && website) {
      try {
        const domain = new URL(website).hostname.replace(/^www\./, '');
        email = `info@${domain}`;
      } catch (_) { /* ignore */ }
    }

    map.set(pvCode, {
      name: org.naam || '',
      email: email || null,
      website: website || null,
      phone: phone || null,
    });
  }

  console.log(`  Provincies loaded: ${map.size}`);
  return map;
}

// Step 4c: Fetch Allmanak waterschappen
async function fetchAllmanakWaterschappen() {
  console.log('Fetching waterschappen from Allmanak...');
  const url = `${ALLMANAK_BASE}/overheidsorganisatie?types=cs.%7BWaterschap%7D&einddatum=is.null&limit=50`;
  const data = await fetchJson(url, {
    headers: { 'Accept': 'application/json' },
  });

  const map = new Map();
  for (const org of data) {
    const ids = org.resourceidentifiers || [];
    // Extract ws{code} from TOOI identifier like ".../waterschap/ws0621"
    const tooiId = ids.find(r =>
      r.naam === 'resourceIdentifierTOOI' &&
      r.value && r.value.includes('/waterschap/ws')
    );
    if (!tooiId) continue;

    const match = tooiId.value.match(/ws(\d+)/);
    if (!match) continue;
    const wsCode = `ws${match[1]}`;

    const contact = org.contact || {};
    const emails = contact.emailadressen || [];
    const websites = contact.internetadressen || [];
    const phones = contact.telefoonnummers || [];

    let email = emails.length > 0 ? emails[0].email : null;
    const website = websites.length > 0 ? websites[0].url : null;
    const phone = phones.length > 0 ? phones[0].nummer : null;

    if (!email && website) {
      try {
        const domain = new URL(website).hostname.replace(/^www\./, '');
        email = `info@${domain}`;
      } catch (_) { /* ignore */ }
    }

    map.set(wsCode, {
      name: org.naam || '',
      email: email || null,
      website: website || null,
      phone: phone || null,
    });
  }

  console.log(`  Waterschappen loaded: ${map.size}`);
  return map;
}

// Step 4d: Fetch Rijkswaterstaat from Allmanak
async function fetchAllmanakRijkswaterstaat() {
  console.log('Fetching Rijkswaterstaat from Allmanak...');
  const url = `${ALLMANAK_BASE}/overheidsorganisatie?naam=eq.Rijkswaterstaat&einddatum=is.null&limit=1`;
  const data = await fetchJson(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (data.length === 0) {
    console.log('  Rijkswaterstaat not found');
    return null;
  }

  const org = data[0];
  const contact = org.contact || {};
  const emails = contact.emailadressen || [];
  const websites = contact.internetadressen || [];
  const phones = contact.telefoonnummers || [];

  return {
    name: org.naam || 'Rijkswaterstaat',
    email: emails.length > 0 ? emails[0].email : null,
    website: websites.length > 0 ? websites[0].url : null,
    phone: phones.length > 0 ? phones[0].nummer : null,
  };
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
async function fetchAndSaveBoundaries(authorities) {
  const boundariesDir = path.join(__dirname, '..', 'docs', 'data', 'boundaries');
  fs.mkdirSync(boundariesDir, { recursive: true });

  console.log('Fetching boundaries from PDOK...');

  const pdokBase = 'https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0';
  const gemeenteUrl = `${pdokBase}?service=WFS&version=2.0.0&request=GetFeature&typeName=bestuurlijkegebieden:Gemeentegebied&outputFormat=json&srsName=EPSG:4326&count=500`;
  const provincieUrl = `${pdokBase}?service=WFS&version=2.0.0&request=GetFeature&typeName=bestuurlijkegebieden:Provinciegebied&outputFormat=json&srsName=EPSG:4326&count=500`;

  const waterschapUrl = 'https://services.arcgis.com/nSZVuSZjHpEZZbRo/arcgis/rest/services/Waterschapsgrenzen/FeatureServer/0/query?where=1%3D1&outFields=waterschapcode,naam,waterschap&f=geojson&resultRecordCount=50&outSR=4326';

  const [gemeenteData, provincieData, waterschapData] = await Promise.all([
    fetchJson(gemeenteUrl).catch(err => { console.warn('  Failed to fetch gemeente boundaries:', err.message); return null; }),
    fetchJson(provincieUrl).catch(err => { console.warn('  Failed to fetch provincie boundaries:', err.message); return null; }),
    fetchJson(waterschapUrl).catch(err => { console.warn('  Failed to fetch waterschap boundaries:', err.message); return null; }),
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

async function main() {
  const startTime = Date.now();

  // Step 1+2: Fetch quays
  const { allBusQuays, inaccessible } = await fetchInaccessibleBusStops();

  // Step 4+5: Fetch authority contact info (in parallel)
  const [gemeenten, provincies, waterschappen, rijkswaterstaat] = await Promise.all([
    fetchAllmanakGemeenten(),
    fetchAllmanakProvincies(),
    fetchAllmanakWaterschappen(),
    fetchAllmanakRijkswaterstaat(),
  ]);

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

  const lookupMaps = { gemeenten, provincies, waterschappen };

  for (const [ownerCode, data] of authoritiesMap) {
    const lookup = ownerCodeToAllmanakKey(ownerCode);
    let contact = null;

    if (lookup) {
      if (lookup.source === 'rijkswaterstaat') {
        contact = rijkswaterstaat;
      } else {
        const sourceMap = lookupMaps[lookup.source];
        if (sourceMap) contact = sourceMap.get(lookup.key) || null;
      }
    }

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
  await fetchAndSaveBoundaries(authorities);

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
  const statsPath = path.join(__dirname, '..', 'docs', 'data', 'stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`Stats written: ${statsPath}`);

  // Write output
  const outPath = path.join(__dirname, '..', 'docs', 'data', 'bus-stops.json');
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
  fetchConcessionProviderNames,
  GEMEENTE_REMAP,
  LARGE_CITIES,
};
