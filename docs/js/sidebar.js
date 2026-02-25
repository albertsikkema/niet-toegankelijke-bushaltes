// Sidebar: authority list, search, detail view
const Sidebar = (() => {
  let appData = null;
  let sortedAuthorities = [];
  const sidebar = document.getElementById('sidebar');

  function checkScrollIndicator() {
    const el = sidebar.querySelector('#sidebar-content:not(.hidden), #authority-detail:not(.hidden)');
    if (!el) { sidebar.classList.remove('has-more-content'); return; }
    const hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 1;
    sidebar.classList.toggle('has-more-content', hasMore);
  }

  function init(data) {
    appData = data;

    // Sort authorities by inaccessible count (descending)
    sortedAuthorities = Object.entries(data.authorities)
      .map(([code, auth]) => ({ code, ...auth }))
      .sort((a, b) => b.inaccessibleCount - a.inaccessibleCount);

    renderList(sortedAuthorities);
    bindEvents();

    document.getElementById('sidebar-content').addEventListener('scroll', checkScrollIndicator);
    document.getElementById('authority-detail').addEventListener('scroll', checkScrollIndicator);
    checkScrollIndicator();
  }

  function renderList(authorities) {
    const container = document.getElementById('authority-list');
    container.innerHTML = '';

    if (authorities.length === 0) {
      container.innerHTML = '<div class="loading">Geen resultaten gevonden</div>';
      requestAnimationFrame(checkScrollIndicator);
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

      const accessible = auth.totalBusQuays - auth.inaccessibleCount;

      item.innerHTML = `
        <div class="authority-name">${escapeHtml(auth.name)} <span class="authority-type">${typeLabel}</span></div>
        <div class="authority-stats">
          <span class="inaccessible-count">Niet toegankelijk: <span class="red">${auth.inaccessibleCount}</span></span>
        </div>
        <div class="authority-bar-row">
          <span class="detail-bar-pct red">${pct}%</span>
          <div class="inaccessible-bar">
            <div class="inaccessible-bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="detail-bar-pct">${100 - pct}%</span>
        </div>
      `;

      item.addEventListener('click', () => showDetail(auth.code));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(auth.code); }
      });
      container.appendChild(item);
    }
    requestAnimationFrame(checkScrollIndicator);
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
    sidebar.classList.add('sidebar-detail-visible');

    const accessible = auth.totalBusQuays - auth.inaccessibleCount;
    const pct = auth.totalBusQuays > 0
      ? Math.round((auth.inaccessibleCount / auth.totalBusQuays) * 100)
      : 0;

    let contactHtml = '';
    if (auth.email) {
      contactHtml += `<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> E-mail: <a href="mailto:${escapeHtml(auth.email)}">${escapeHtml(auth.email)}</a></div>`;
    }
    if (auth.website) {
      contactHtml += `<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Website: <a href="${escapeHtml(auth.website)}" target="_blank" rel="noopener">${escapeHtml(auth.website)}</a></div>`;
    }
    if (auth.phone) {
      contactHtml += `<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Telefoon: ${escapeHtml(auth.phone)}</div>`;
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
        <h2>${escapeHtml(auth.name)} <span class="authority-type">${typeLabel}</span></h2>
        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-value red">${auth.inaccessibleCount}</div>
            <div class="detail-stat-label">niet toegankelijk</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-value">${accessible}</div>
            <div class="detail-stat-label">toegankelijk</div>
          </div>
        </div>
        <div class="detail-bar-row">
          <span class="detail-bar-pct red">${pct}%</span>
          <div class="inaccessible-bar">
            <div class="inaccessible-bar-fill" style="width: ${pct}%"></div>
          </div>
          <span class="detail-bar-pct">${100 - pct}%</span>
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
    requestAnimationFrame(checkScrollIndicator);
  }

  function showList() {
    const listEl = document.getElementById('sidebar-content');
    const detailEl = document.getElementById('authority-detail');
    const searchEl = document.getElementById('search-box');

    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    searchEl.classList.remove('hidden');
    sidebar.classList.remove('sidebar-detail-visible');

    MapView.resetView();
    requestAnimationFrame(checkScrollIndicator);
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
      sidebar.classList.toggle('sidebar-list-visible', !!query);
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
      sidebar.classList.remove('sidebar-list-visible');
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
