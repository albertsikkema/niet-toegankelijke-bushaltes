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
    const inacc = data.totals.inaccessibleBusQuays.toLocaleString('nl-NL');
    const total = data.totals.totalBusQuays.toLocaleString('nl-NL');
    statsEl.innerHTML = `<span class="stats-full"><strong>${inacc}</strong> van ${total} bushaltes niet toegankelijk (${pct}%) — ${data.totals.authorities} wegbeheerders</span><span class="stats-short"><strong>${inacc}</strong> / ${total} niet toegankelijk (${pct}%)</span>`;

    // Initialize components
    Email.init();
    MapView.init(data);
    Sidebar.init(data);

    // Info modal
    const infoModal = document.getElementById('info-modal');
    const openInfoModal = () => { infoModal.classList.remove('hidden'); document.getElementById('info-modal-close').focus(); };
    const closeInfoModal = () => { infoModal.classList.add('hidden'); document.getElementById('info-btn').focus(); };
    document.getElementById('info-btn').addEventListener('click', openInfoModal);
    document.getElementById('info-modal-close').addEventListener('click', closeInfoModal);
    infoModal.addEventListener('click', (e) => { if (e.target === infoModal) closeInfoModal(); });
    infoModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeInfoModal();
      if (e.key === 'Tab') {
        var focusable = infoModal.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
      }
    });

    console.log('App initialized', data.totals);
  } catch (err) {
    console.error('Failed to load data:', err);
    statsEl.textContent = 'Fout bij laden van gegevens. Zorg dat data/bus-stops.json beschikbaar is.';
    document.getElementById('authority-list').innerHTML =
      '<div class="loading">Kan gegevens niet laden. Voer eerst het pipeline-script uit: <code>node pipeline/fetch-data.js</code></div>';
  }
})();
