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

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
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

  const inaccessible = busQuays.filter(q => q.quaydisabledaccessible === false);
  console.log(`  Inaccessible active bus quays: ${inaccessible.length}`);

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

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
