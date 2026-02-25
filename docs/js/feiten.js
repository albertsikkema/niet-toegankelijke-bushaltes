// Feiten page — pure helper functions (testable from Node.js)
function feitenRow(cells) {
  return '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
}

function feitenFormatDate(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Feiten page: loads stats.json and populates tables + numbers dynamically
(function () {
  'use strict';

  var NL = 'nl-NL';

  function fmt(n) {
    return n.toLocaleString(NL);
  }

  function fillTable(id, rows) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = rows.join('');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function render(stats) {
    // Intro numbers
    setText('stat-total', fmt(stats.totals.totalBusQuays));
    setText('stat-inaccessible', fmt(stats.totals.inaccessibleBusQuays));
    setText('stat-inaccessible-pct', stats.totals.inaccessiblePct + '%');
    setText('stat-wheelchair-pct', stats.totals.wheelchairPct + '%');
    setText('stat-visual-pct', stats.totals.visualPct + '%');
    setText('stat-updated-date', feitenFormatDate(stats.generated));

    // Worst gemeentes
    setText('worst-count', stats.worstGemeentes.length);
    setText('worst-count-caption', stats.worstGemeentes.length);
    fillTable('table-worst', stats.worstGemeentes.map(function (a) {
      return feitenRow([a.name, fmt(a.inaccessible), fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Most inaccessible gemeentes
    fillTable('table-most', stats.mostInaccessibleGemeentes.map(function (a) {
      return feitenRow([a.name, fmt(a.inaccessible), fmt(a.total), a.pct + '%', fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Best gemeentes
    fillTable('table-best', stats.bestGemeentes.map(function (a) {
      return feitenRow([a.name, fmt(a.inaccessible), fmt(a.total), a.pct + '%', fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Large cities
    fillTable('table-cities', stats.largeCities.map(function (a) {
      return feitenRow([a.name, fmt(a.inaccessible), fmt(a.total), a.pct + '%', fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Provincies
    fillTable('table-provincies', stats.provincies.map(function (a) {
      return feitenRow([a.name, fmt(a.inaccessible), fmt(a.total), a.pct + '%', fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Waterschappen
    setText('ws-pct', stats.conclusions.wsPct + '%');
    fillTable('table-waterschappen', stats.waterschappen.map(function (a) {
      return feitenRow([a.name, fmt(a.inaccessible), fmt(a.total), a.pct + '%', fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Authority types
    fillTable('table-types', stats.authorityTypes.map(function (a) {
      return feitenRow([a.label, fmt(a.total), fmt(a.inaccessible), a.pct + '%', fmt(a.wheelchair), fmt(a.visual)]);
    }));

    // Conclusions
    var c = stats.conclusions;
    var items = [];
    if (!c.hasZeroPct) {
      items.push('Geen enkele gemeente heeft 0% niet volledig toegankelijke haltes \u2014 iedere gemeente heeft werk te doen.');
    }
    items.push(c.gemeentesOver50 + ' van ' + c.totalGemeentes + ' gemeentes (' + c.gemeentesOver50Pct + '%) heeft meer dan de helft van de haltes niet volledig toegankelijk.');
    items.push('Visuele toegankelijkheid is het grootste probleem: ' + c.visualPct + '% van alle haltes is visueel niet toegankelijk, tegenover ' + c.wheelchairPct + '% rolstoeltoegankelijkheid.');
    items.push('Waterschappen zijn de blinde vlek: ' + c.wsPct + '% van hun haltes is niet volledig toegankelijk.');
    if (c.bestCityName) {
      items.push(c.bestCityName + ' bewijst dat het kan: slechts ' + c.bestCityPct + '% niet volledig toegankelijk bij ' + fmt(c.bestCityTotal) + ' haltes.');
    }
    items.push(c.shelterPct + '% van niet volledig toegankelijke haltes heeft ook geen abri \u2014 een dubbele achterstand.');
    items.push('Het probleem is wijdverspreid \u2014 de top 10 gemeentes bevat slechts ' + c.top10Pct + '% van het totaal.');

    var list = document.getElementById('conclusions-list');
    if (list) {
      list.innerHTML = items.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    }

    // Generated date
    setText('generated-date', feitenFormatDate(stats.generated));
  }

  if (typeof document !== 'undefined') {
    fetch('data/stats.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(render)
      .catch(function (err) {
        console.error('Failed to load stats:', err);
        var intro = document.querySelector('.intro');
        if (intro) {
          intro.innerHTML = '<em>Kan de statistieken niet laden. Probeer het later opnieuw.</em>';
        }
      });
  }
})();

if (typeof module !== 'undefined') module.exports = { feitenRow: feitenRow, feitenFormatDate: feitenFormatDate };
