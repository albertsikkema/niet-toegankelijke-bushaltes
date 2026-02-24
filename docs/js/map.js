// Leaflet map, markers, popups, zoom-to-authority
const MapView = (() => {
  let map;
  let clusterGroup;
  let markersByAuthority = {};
  let allMarkers = [];
  let appData = null;
  let boundaryLayer = null;
  let boundaryCache = {};
  let tileLayer = null;

  const TILE_URLS = {
    light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  };

  function createStopIcon(compassDirection) {
    var size = 24;
    var cx = size / 2;
    var cy = size / 2;
    var r = 5;
    var chevron = '';
    if (compassDirection !== null && compassDirection !== undefined) {
      // Chevron ">" pointing north by default, rotated by compassDirection
      // Placed outside the circle with a small gap
      var x1 = cx - 3, y1 = cy - 8;
      var xTip = cx, yTip = cy - 11;
      var x2 = cx + 3, y2 = cy - 8;
      chevron = '<polyline points="' + x1 + ',' + y1 + ' ' + xTip + ',' + yTip + ' ' + x2 + ',' + y2 + '" ' +
        'fill="none" stroke="#d32f2f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
        'transform="rotate(' + compassDirection + ', ' + cx + ', ' + cy + ')"/>';
    }
    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">' +
      chevron +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#d32f2f" stroke="#b71c1c" stroke-width="1"/>' +
      '</svg>';
    return L.divIcon({
      html: svg,
      className: 'stop-marker',
      iconSize: [size, size],
      iconAnchor: [cx, cy],
    });
  }

  function init(data) {
    appData = data;

    map = L.map('map', {
      preferCanvas: true,
      center: [52.15, 5.4], // Center of NL
      zoom: 8,
      minZoom: 6,
      maxZoom: 18,
    });

    var initialTheme = (typeof Theme !== 'undefined') ? Theme.current() : 'light';
    tileLayer = L.tileLayer(TILE_URLS[initialTheme], {
      attribution: '&copy; <a href="https://albertsikkema.com">Albert Sikkema</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    window.addEventListener('themechange', function (e) {
      var theme = e.detail.theme;
      tileLayer.setUrl(TILE_URLS[theme] || TILE_URLS.light);
    });

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

        const marker = L.marker([stop.lat, stop.lon], {
          icon: createStopIcon(stop.compassDirection),
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

    // Focus popup content when opened from sidebar navigation
    map.on('popupopen', function () {
      if (!pendingFocus) return;
      pendingFocus = false;
      // Small delay to ensure Leaflet has fully rendered the popup DOM
      setTimeout(function () {
        var container = document.querySelector('.stop-popup[tabindex]');
        if (container) container.focus();
      }, 50);
    });
  }

  function createPopup(stop, authority, ownerCode) {
    const div = document.createElement('div');
    div.className = 'stop-popup';
    div.setAttribute('tabindex', '-1');
    div.setAttribute('role', 'region');
    div.setAttribute('aria-label', 'Halte-informatie: ' + stop.town + ', ' + (stop.name || stop.code));

    // Title: town, name
    const h3 = document.createElement('h3');
    h3.textContent = `${stop.town}, ${stop.name || stop.code}`;
    div.appendChild(h3);

    // Details as description list for screen readers
    const dl = document.createElement('dl');
    dl.className = 'popup-details';

    const rows = [];
    if (stop.street) rows.push(['Straat', stop.street]);
    rows.push(['Halte', stop.code]);
    rows.push(['Wegbeheerder', authority.name]);
    if (stop.concessionProvider && appData.concessionProviders) {
      const cp = appData.concessionProviders[stop.concessionProvider];
      if (cp && cp.name) rows.push(['Concessieverlener', cp.name]);
    }
    rows.push(['Rolstoeltoegankelijk', stop.wheelchairAccessible ? 'Ja' : 'Nee']);
    rows.push(['Visueel toegankelijk', stop.visuallyAccessible ? 'Ja' : 'Nee']);

    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.className = 'popup-label';
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.className = 'popup-value';
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    div.appendChild(dl);

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

  var pendingFocus = false;

  function zoomToStop(stop) {
    if (!stop.lat || !stop.lon) return;

    // Find the marker for this stop
    const marker = allMarkers.find(m => m.stopData.code === stop.code);
    if (marker) {
      pendingFocus = true;
      // zoomToShowLayer handles unclustering and zoom, then open popup
      clusterGroup.zoomToShowLayer(marker, () => {
        map.setView([stop.lat, stop.lon], 17);
        marker.openPopup();
      });
    } else {
      map.setView([stop.lat, stop.lon], 17);
    }
  }

  function filterByAuthority(ownerCode, authType) {
    const markers = markersByAuthority[ownerCode];
    if (!markers || markers.length === 0) return;

    clusterGroup.clearLayers();
    clusterGroup.addLayers(markers);

    // Remove existing boundary
    if (boundaryLayer) {
      map.removeLayer(boundaryLayer);
      boundaryLayer = null;
    }

    // Fetch boundary for gemeente/provincie
    if (authType === 'gemeente' || authType === 'provincie' || authType === 'waterschap') {
      const showBoundary = (geometry) => {
        // Build inverted mask: fill everything outside the boundary
        var world = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
        var holes = [];
        if (geometry.type === 'Polygon') {
          holes.push(geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
          for (var i = 0; i < geometry.coordinates.length; i++) {
            holes.push(geometry.coordinates[i][0]);
          }
        }
        var maskGeo = {
          type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [world].concat(holes) }
        };
        var borderGeo = { type: 'Feature', properties: {}, geometry: geometry };

        var isDark = (typeof Theme !== 'undefined') && Theme.current() === 'dark';
        var maskLayer = L.geoJSON(maskGeo, {
          style: { stroke: false, fillColor: isDark ? '#fff' : '#000', fillOpacity: isDark ? 0.2 : 0.15 }
        });
        var borderLayer = L.geoJSON(borderGeo, {
          style: { color: '#1976d2', weight: 2, fill: false }
        });

        boundaryLayer = L.layerGroup([maskLayer, borderLayer]).addTo(map);
        map.fitBounds(borderLayer.getBounds().pad(0.05), { maxZoom: 14 });
      };

      if (boundaryCache[ownerCode]) {
        showBoundary(boundaryCache[ownerCode]);
      } else {
        fetch('data/boundaries/' + ownerCode + '.json')
          .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
          .then(function (geometry) {
            boundaryCache[ownerCode] = geometry;
            showBoundary(geometry);
          })
          .catch(function (err) {
            console.warn('Boundary load failed for ' + ownerCode + ':', err);
            // Fallback: fit to markers
            var group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14 });
          });
      }
    } else {
      // No boundary available, fit to markers
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14 });
    }
  }

  function resetView() {
    if (boundaryLayer) {
      map.removeLayer(boundaryLayer);
      boundaryLayer = null;
    }
    clusterGroup.clearLayers();
    clusterGroup.addLayers(allMarkers);
    map.setView([52.15, 5.4], 8);
  }

  return { init, zoomToAuthority, zoomToStop, filterByAuthority, resetView };
})();
