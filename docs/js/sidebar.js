// Sidebar: authority list, search, detail view
const Sidebar = (() => {
  let appData = null;
  let sortedAuthorities = [];

  function init(data) {
    appData = data;

    // Sort authorities by inaccessible count (descending)
    sortedAuthorities = Object.entries(data.authorities)
      .map(([code, auth]) => ({ code, ...auth }))
      .sort((a, b) => b.inaccessibleCount - a.inaccessibleCount);

    renderList(sortedAuthorities);
    bindEvents();
  }

  function renderList(authorities) {
    const container = document.getElementById('authority-list');
    container.innerHTML = '';

    if (authorities.length === 0) {
      container.innerHTML = '<div class="loading">Geen resultaten gevonden</div>';
      return;
    }

    for (const auth of authorities) {
      const item = document.createElement('div');
      item.className = 'authority-item';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.dataset.code = auth.code;

      const pct = auth.totalBusQuays > 0
        ? Math.round((auth.inaccessibleCount / auth.totalBusQuays) * 100)
        : 0;

      const typeLabel = auth.type === 'privaat' ? 'privaat beheer' : auth.type;

      item.innerHTML = `
        <div class="authority-name">${escapeHtml(auth.name)}</div>
        <div class="authority-type">${typeLabel}</div>
        <div class="authority-stats">
          <span class="inaccessible-count">${auth.inaccessibleCount} niet toegankelijk</span>
          <div class="inaccessible-bar">
            <div class="inaccessible-bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="total-count">${auth.totalBusQuays} totaal</span>
        </div>
      `;

      item.addEventListener('click', () => showDetail(auth.code));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(auth.code); }
      });
      container.appendChild(item);
    }
  }

  function showDetail(ownerCode) {
    const auth = appData.authorities[ownerCode];
    if (!auth) return;

    const listEl = document.getElementById('sidebar-content');
    const detailEl = document.getElementById('authority-detail');
    const searchEl = document.getElementById('search-box');

    listEl.classList.add('hidden');
    searchEl.classList.add('hidden');
    detailEl.classList.remove('hidden');

    const accessible = auth.totalBusQuays - auth.inaccessibleCount;
    const pct = auth.totalBusQuays > 0
      ? Math.round((auth.inaccessibleCount / auth.totalBusQuays) * 100)
      : 0;

    let contactHtml = '';
    if (auth.email) {
      contactHtml += `<div>E-mail: <a href="mailto:${escapeHtml(auth.email)}">${escapeHtml(auth.email)}</a></div>`;
    }
    if (auth.website) {
      contactHtml += `<div>Website: <a href="${escapeHtml(auth.website)}" target="_blank" rel="noopener">${escapeHtml(auth.website)}</a></div>`;
    }
    if (auth.phone) {
      contactHtml += `<div>Telefoon: ${escapeHtml(auth.phone)}</div>`;
    }

    const isPrivaat = auth.type === 'privaat';
    const typeLabel = isPrivaat ? 'privaat beheer' : auth.type;

    let actionsHtml = '';
    if (isPrivaat) {
      actionsHtml = `
        <div class="detail-actions">
          <div class="privaat-notice">Deze haltes worden beheerd door een private partij. De e-mailfunctie is niet beschikbaar.</div>
        </div>`;
    } else {
      actionsHtml = `
        <div class="detail-actions">
          <button class="btn btn-danger" id="detail-email-btn">Stuur email - ${auth.inaccessibleCount} haltes</button>
        </div>`;
    }

    const content = document.getElementById('detail-content');
    content.innerHTML = `
      <div class="detail-header">
        <h2>${escapeHtml(auth.name)}</h2>
        <div class="authority-type">${typeLabel}</div>
        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-value red">${auth.inaccessibleCount}</div>
            <div class="detail-stat-label">niet toegankelijk (${pct}%)</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-value green">${accessible}</div>
            <div class="detail-stat-label">toegankelijk</div>
          </div>
        </div>
        ${contactHtml ? `<div class="detail-contact">${contactHtml}</div>` : ''}
      </div>
      ${actionsHtml}
      <ul class="stop-list" id="detail-stop-list"></ul>
    `;

    // Render stop list
    const stopList = document.getElementById('detail-stop-list');
    for (const stop of auth.stops) {
      const li = document.createElement('li');
      li.className = 'stop-item';
      li.setAttribute('tabindex', '0');
      li.innerHTML = `
        <div class="stop-name">${escapeHtml(stop.name || stop.code)}</div>
        <div class="stop-town">${escapeHtml(stop.town)} — ${escapeHtml(stop.code)}</div>
      `;
      li.addEventListener('click', () => MapView.zoomToStop(stop));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); MapView.zoomToStop(stop); }
      });
      stopList.appendChild(li);
    }

    // Email button (only for non-private authorities)
    const emailBtn = document.getElementById('detail-email-btn');
    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        Email.showModal(auth, auth.stops, appData.concessionProviders);
      });
    }

    // Filter map to authority stops
    MapView.filterByAuthority(ownerCode, auth.type);
  }

  function showList() {
    const listEl = document.getElementById('sidebar-content');
    const detailEl = document.getElementById('authority-detail');
    const searchEl = document.getElementById('search-box');

    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    searchEl.classList.remove('hidden');

    MapView.resetView();
  }

  function bindEvents() {
    // Back button
    document.getElementById('back-btn').addEventListener('click', showList);

    // Search
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    function updateSearch() {
      const query = searchInput.value.trim().toLowerCase();
      clearBtn.classList.toggle('hidden', !searchInput.value);
      if (!query) {
        renderList(sortedAuthorities);
        return;
      }

      const filtered = sortedAuthorities.filter(auth =>
        auth.name.toLowerCase().includes(query) ||
        auth.code.toLowerCase().includes(query) ||
        auth.type.toLowerCase().includes(query)
      );
      renderList(filtered);
    }

    searchInput.addEventListener('input', updateSearch);

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      renderList(sortedAuthorities);
      searchInput.focus();
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, showDetail };
})();
