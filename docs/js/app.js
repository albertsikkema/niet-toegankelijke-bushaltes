// Entry point: load data, init components
(async function () {
  const statsEl = document.getElementById('stats');

  try {
    statsEl.textContent = 'Gegevens laden...';

    const res = await fetch('data/bus-stops.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Update stats header
    const pct = data.totals.totalBusQuays > 0
      ? Math.round((data.totals.inaccessibleBusQuays / data.totals.totalBusQuays) * 100)
      : 0;
    statsEl.innerHTML = `<strong>${data.totals.inaccessibleBusQuays.toLocaleString('nl-NL')}</strong> van ${data.totals.totalBusQuays.toLocaleString('nl-NL')} bushaltes niet toegankelijk (${pct}%) — ${data.totals.authorities} wegbeheerders`;

    // Initialize components
    Email.init();
    MapView.init(data);
    Sidebar.init(data);

    console.log('App initialized', data.totals);
  } catch (err) {
    console.error('Failed to load data:', err);
    statsEl.textContent = 'Fout bij laden van gegevens. Zorg dat data/bus-stops.json beschikbaar is.';
    document.getElementById('authority-list').innerHTML =
      '<div class="loading">Kan gegevens niet laden. Voer eerst het pipeline-script uit: <code>node pipeline/fetch-data.js</code></div>';
  }
})();
