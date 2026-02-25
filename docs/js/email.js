// Email template generation
var MAX_STOPS_MAILTO = 20; // URL length limit for mailto

function generateSubject(authority) {
  var name = authority.name || authority.type;
  return 'Verzoek verbetering toegankelijkheid bushaltes in ' + name;
}

function generateBody(authority, stops, concessionProviders) {
  var isProvincie = authority.type === 'provincie';
  var isWaterschap = authority.type === 'waterschap';
  var name = authority.name;
  var count = stops.length;
  var total = authority.totalBusQuays;
  var pct = total > 0 ? Math.round((count / total) * 100) : 0;

  var aanhef;
  if (isProvincie) {
    aanhef = 'Geacht college van Gedeputeerde Staten van ' + name;
  } else if (isWaterschap) {
    aanhef = 'Geacht dagelijks bestuur van ' + name;
  } else {
    aanhef = 'Geacht college van burgemeester en wethouders van ' + name;
  }

  // Build stop list
  var stopLines = stops
    .map(function (s) { return '  - ' + s.name + ', ' + s.town + (s.street ? ' (' + s.street + ')' : '') + ' [' + s.code + ']'; })
    .join('\n');

  // Find primary concession provider
  var providerCounts = {};
  for (var i = 0; i < stops.length; i++) {
    var s = stops[i];
    if (s.concessionProvider) {
      providerCounts[s.concessionProvider] = (providerCounts[s.concessionProvider] || 0) + 1;
    }
  }
  var primaryProvider = Object.keys(providerCounts).sort(function (a, b) { return providerCounts[b] - providerCounts[a]; })[0];
  var providerInfo = primaryProvider && concessionProviders[primaryProvider];
  var providerName = providerInfo ? providerInfo.name : 'de OV-autoriteit';

  // Human intro varies by type
  var introZin;
  if (isProvincie) {
    introZin = 'Als inwoner van deze provincie en regelmatig gebruiker van het openbaar vervoer';
  } else if (isWaterschap) {
    introZin = 'Als inwoner en gebruiker van het openbaar vervoer in uw beheergebied';
  } else {
    introZin = 'Als inwoner van uw gemeente en gebruiker van het openbaar vervoer';
  }

  return aanhef + ',\n\n' +
    introZin + ' schrijf ik u omdat ik mij zorgen maak over de toegankelijkheid van bushaltes voor mensen met een beperking.\n\n' +
    'Uit het Centraal Haltebestand (CHB, beheerd door DOVA) blijkt dat ' + count + ' van de ' + total + ' bushaltes (' + pct + '%) onder uw beheer niet voldoen aan de toegankelijkheidsnormen van de CROW Richtlijn Toegankelijkheid. Dit betekent dat deze haltes niet bruikbaar zijn voor mensen die gebruik maken van een rolstoel, rollator of andere hulpmiddelen. Denk hierbij aan te lage perronhoogtes (norm: minimaal 18 cm), te smalle platforms (norm: minimaal 1,50 m), ontbrekende geleide- en waarschuwingslijnen, of het ontbreken van een obstakelvrije toegangsroute.\n\n' +
    'Het gaat om de volgende haltes:\n' +
    stopLines + '\n\n' +
    'Wettelijk kader\n' +
    'Nederland heeft het VN-verdrag inzake de rechten van personen met een handicap geratificeerd. Artikel 9 (Toegankelijkheid) verplicht overheden om passende maatregelen te nemen zodat mensen met een beperking op voet van gelijkheid toegang hebben tot vervoer. Artikel 20 (Persoonlijke mobiliteit) vraagt om het faciliteren van persoonlijke mobiliteit tegen betaalbare kosten.\n\n' +
    'De Wet gelijke behandeling op grond van handicap of chronische ziekte (Wgbh/cz) verbiedt in artikel 3 onderscheid bij de toegang tot openbaar vervoer. Op grond van artikel 2 van deze wet is de beheerder van de fysieke infrastructuur verplicht om geleidelijk doeltreffende aanpassingen te verrichten, tenzij dit een onevenredige belasting vormt.\n\n' +
    'Daarnaast hebben Rijk, provincies, vervoerregio\u2019s, gemeenten en vervoerders in het Bestuursakkoord Toegankelijkheid OV 2022-2032 afgesproken om de toegankelijkheid van haltes te verbeteren volgens de CROW-normen.\n\n' +
    'Verzoek\n' +
    'Ik verzoek u vriendelijk om:\n' +
    '  1. Een overzicht te geven van de planning voor het toegankelijk maken van bovengenoemde haltes;\n' +
    '  2. Bij toekomstige reconstructies van wegen en haltes de CROW-normen als uitgangspunt te nemen;\n' +
    '  3. Gebruik te maken van de beschikbare subsidies van de OV-autoriteit (' + providerName + ') voor het versnellen van deze aanpassingen.\n\n' +
    'Ik realiseer mij dat het toegankelijk maken van alle haltes tijd en middelen vergt. Tegelijkertijd is toegankelijk openbaar vervoer een basisvoorwaarde voor de zelfstandigheid en maatschappelijke deelname van een grote groep inwoners. Elke halte die wordt verbeterd maakt een verschil.\n\n' +
    'De gegevens in deze brief zijn afkomstig uit het Centraal Haltebestand en zijn te raadplegen via halteviewer.ov-data.nl.\n\n' +
    'Ik zie uw reactie met belangstelling tegemoet.\n\n' +
    'Met vriendelijke groet,\n\n' +
    '[Uw naam]\n' +
    '[Uw adres]';
}

function buildMailtoUrl(email, subject, body) {
  // Truncate body for mailto URL length limits
  var lines = body.split('\n');
  var truncatedBody = body;
  var stopListStart = lines.findIndex(function (l) { return l.startsWith('  - '); });
  if (stopListStart >= 0) {
    var stopLines = lines.filter(function (l) { return l.startsWith('  - '); });
    if (stopLines.length > MAX_STOPS_MAILTO) {
      var beforeStops = lines.slice(0, stopListStart);
      var afterStops = lines.slice(lines.lastIndexOf(stopLines[stopLines.length - 1]) + 1);
      var truncatedStops = stopLines.slice(0, MAX_STOPS_MAILTO);
      truncatedStops.push('  ... en nog ' + (stopLines.length - MAX_STOPS_MAILTO) + ' andere haltes');
      truncatedBody = [].concat(beforeStops, truncatedStops, afterStops).join('\n');
    }
  }

  return 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(truncatedBody);
}

// Email modal control, mailto + clipboard (browser-only IIFE)
var Email = (function () {
  function copyText(text, label) {
    navigator.clipboard.writeText(text).then(function () {
      showToast(label + ' gekopieerd');
    }).catch(function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(label + ' gekopieerd');
    });
  }

  function showModal(authority, stops, concessionProviders) {
    lastFocused = document.activeElement;
    var email = authority.email || '';
    var subject = generateSubject(authority);
    var body = generateBody(authority, stops, concessionProviders);

    document.getElementById('email-to').value = email || 'E-mailadres niet beschikbaar';
    document.getElementById('email-subject').value = subject;
    document.getElementById('email-body').value = body;

    // Update mailto link
    var mailtoLink = document.getElementById('mailto-link');
    if (email) {
      mailtoLink.href = buildMailtoUrl(email, subject, body);
      mailtoLink.classList.remove('btn-disabled');
    } else {
      mailtoLink.removeAttribute('href');
      mailtoLink.classList.add('btn-disabled');
    }

    document.getElementById('email-modal').classList.remove('hidden');
    document.getElementById('modal-close').focus();
  }

  var lastFocused = null;

  function hideModal() {
    document.getElementById('email-modal').classList.add('hidden');
    if (lastFocused) { lastFocused.focus(); lastFocused = null; }
  }

  function showToast(message) {
    var toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2000);
  }

  function trapFocus(modal, e) {
    var focusable = modal.querySelectorAll('button, [href]:not(.btn-disabled), input, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function init() {
    var modal = document.getElementById('email-modal');
    document.getElementById('modal-close').addEventListener('click', hideModal);

    // Close on backdrop click
    modal.addEventListener('click', function (e) {
      if (e.target === e.currentTarget) hideModal();
    });

    // Close on Escape, trap Tab focus
    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideModal();
      if (e.key === 'Tab') trapFocus(modal, e);
    });

    // Per-field copy buttons
    document.querySelectorAll('.copy-field-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.dataset.target);
        if (!target) return;
        var labels = { 'email-to': 'E-mailadres', 'email-subject': 'Onderwerp', 'email-body': 'Bericht' };
        copyText(target.value, labels[btn.dataset.target] || 'Tekst');
      });
    });

    // Update mailto link when fields change
    var updateMailto = function () {
      var link = document.getElementById('mailto-link');
      var email = document.getElementById('email-to').value;
      if (email && !email.startsWith('E-mail')) {
        var subject = document.getElementById('email-subject').value;
        var body = document.getElementById('email-body').value;
        link.href = buildMailtoUrl(email, subject, body);
      }
    };
    document.getElementById('email-subject').addEventListener('input', updateMailto);
    document.getElementById('email-body').addEventListener('input', updateMailto);
  }

  return { init: init, showModal: showModal, hideModal: hideModal };
})();

if (typeof module !== 'undefined') module.exports = { MAX_STOPS_MAILTO: MAX_STOPS_MAILTO, generateSubject: generateSubject, generateBody: generateBody, buildMailtoUrl: buildMailtoUrl };
