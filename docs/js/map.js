// Leaflet map, markers, popups, zoom-to-authority
const MapView = (() => {
  let map;
  let clusterGroup;
  let markersByAuthority = {};
  let allMarkers = [];
  let appData = null;

  function init(data) {
    appData = data;

    map = L.map('map', {
      preferCanvas: true,
      center: [52.15, 5.4], // Center of NL
      zoom: 8,
      minZoom: 6,
      maxZoom: 18,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://albertsikkema.com">Albert Sikkema</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 16,
    });

    // Add all markers
    const markers = [];
    for (const [ownerCode, authority] of Object.entries(data.authorities)) {
      markersByAuthority[ownerCode] = [];

      for (const stop of authority.stops) {
        if (!stop.lat || !stop.lon) continue;

        const marker = L.circleMarker([stop.lat, stop.lon], {
          radius: 6,
          fillColor: '#d32f2f',
          color: '#b71c1c',
          weight: 1,
          fillOpacity: 0.7,
        });

        marker.bindPopup(() => createPopup(stop, authority, ownerCode), { maxWidth: 300, minWidth: 260 });
        marker.stopData = stop;
        marker.authorityCode = ownerCode;

        markers.push(marker);
        markersByAuthority[ownerCode].push(marker);
      }
    }

    allMarkers = markers;
    clusterGroup.addLayers(markers);
    map.addLayer(clusterGroup);
  }

  function createPopup(stop, authority, ownerCode) {
    const div = document.createElement('div');
    div.className = 'stop-popup';

    // Title: town, name
    const h3 = document.createElement('h3');
    h3.textContent = `${stop.town}, ${stop.name || stop.code}`;
    div.appendChild(h3);

    // Details table
    const details = document.createElement('div');
    details.className = 'popup-details';

    const rows = [];
    if (stop.street) rows.push(['Straat', stop.street]);
    rows.push(['Halte', stop.code]);
    rows.push(['Wegbeheerder', authority.name]);
    if (stop.shelter !== undefined) rows.push(['Abri', stop.shelter ? 'Ja' : 'Nee']);

    details.innerHTML = rows
      .map(([label, value]) => `<div class="popup-row"><span class="popup-label">${label}</span><span class="popup-value">${value}</span></div>`)
      .join('');
    div.appendChild(details);

    // Google Street View link
    if (stop.lat && stop.lon) {
      const svLink = document.createElement('a');
      svLink.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${stop.lat},${stop.lon}`;
      svLink.target = '_blank';
      svLink.rel = 'noopener';
      svLink.className = 'popup-sv-link';
      svLink.textContent = 'Bekijk in Street View';
      div.appendChild(svLink);
    }

    // Action button
    if (authority.type === 'privaat') {
      const notice = document.createElement('p');
      notice.className = 'popup-privaat';
      notice.textContent = 'Privaat beheer';
      div.appendChild(notice);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-danger popup-btn-full';
      btn.textContent = 'Email beheerder';
      btn.addEventListener('click', () => {
        Email.showModal(authority, authority.stops, appData.concessionProviders);
      });
      div.appendChild(btn);
    }

    return div;
  }

  function zoomToAuthority(ownerCode) {
    const markers = markersByAuthority[ownerCode];
    if (!markers || markers.length === 0) return;

    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14 });
  }

  function zoomToStop(stop) {
    if (!stop.lat || !stop.lon) return;
    map.setView([stop.lat, stop.lon], 17);

    // Find and open the marker's popup
    const markers = allMarkers.filter(m =>
      m.stopData.code === stop.code
    );
    if (markers.length > 0) {
      // Unspiderfy clusters first
      clusterGroup.zoomToShowLayer(markers[0], () => {
        markers[0].openPopup();
      });
    }
  }

  function resetView() {
    map.setView([52.15, 5.4], 8);
  }

  return { init, zoomToAuthority, zoomToStop, resetView };
})();
