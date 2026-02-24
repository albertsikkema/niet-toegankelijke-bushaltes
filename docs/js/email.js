// Email template generation, modal control, mailto + clipboard
const Email = (() => {
  const MAX_STOPS_MAILTO = 20; // URL length limit for mailto

  function generateSubject(authority) {
    const name = authority.name || authority.type;
    return `Verzoek verbetering toegankelijkheid bushaltes in ${name}`;
  }

  function generateBody(authority, stops, concessionProviders) {
    const isProvincie = authority.type === 'provincie';
    const isWaterschap = authority.type === 'waterschap';
    const name = authority.name;
    const count = stops.length;
    const total = authority.totalBusQuays;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    let aanhef;
    if (isProvincie) {
      aanhef = `Geacht college van Gedeputeerde Staten van ${name}`;
    } else if (isWaterschap) {
      aanhef = `Geacht dagelijks bestuur van ${name}`;
    } else {
      aanhef = `Geacht college van burgemeester en wethouders van ${name}`;
    }

    // Build stop list
    const stopLines = stops
      .map(s => `  - ${s.name}, ${s.town}${s.street ? ' (' + s.street + ')' : ''} [${s.code}]`)
      .join('\n');

    // Find primary concession provider
    const providerCounts = {};
    for (const s of stops) {
      if (s.concessionProvider) {
        providerCounts[s.concessionProvider] = (providerCounts[s.concessionProvider] || 0) + 1;
      }
    }
    const primaryProvider = Object.keys(providerCounts).sort((a, b) => providerCounts[b] - providerCounts[a])[0];
    const providerInfo = primaryProvider && concessionProviders[primaryProvider];
    const providerName = providerInfo ? providerInfo.name : 'de OV-autoriteit';

    // Human intro varies by type
    let introZin;
    if (isProvincie) {
      introZin = 'Als inwoner van deze provincie en regelmatig gebruiker van het openbaar vervoer';
    } else if (isWaterschap) {
      introZin = 'Als inwoner en gebruiker van het openbaar vervoer in uw beheergebied';
    } else {
      introZin = 'Als inwoner van uw gemeente en gebruiker van het openbaar vervoer';
    }

    return `${aanhef},

${introZin} schrijf ik u omdat ik mij zorgen maak over de toegankelijkheid van bushaltes voor mensen met een beperking.

Uit het Centraal Haltebestand (CHB, beheerd door DOVA) blijkt dat ${count} van de ${total} bushaltes (${pct}%) onder uw beheer niet voldoen aan de toegankelijkheidsnormen van de CROW Richtlijn Toegankelijkheid. Dit betekent dat deze haltes niet bruikbaar zijn voor mensen die gebruik maken van een rolstoel, rollator of andere hulpmiddelen. Denk hierbij aan te lage perronhoogtes (norm: minimaal 18 cm), te smalle platforms (norm: minimaal 1,50 m), ontbrekende geleide- en waarschuwingslijnen, of het ontbreken van een obstakelvrije toegangsroute.

Het gaat om de volgende haltes:
${stopLines}

Wettelijk kader
Nederland heeft het VN-verdrag inzake de rechten van personen met een handicap geratificeerd. Artikel 9 (Toegankelijkheid) verplicht overheden om passende maatregelen te nemen zodat mensen met een beperking op voet van gelijkheid toegang hebben tot vervoer. Artikel 20 (Persoonlijke mobiliteit) vraagt om het faciliteren van persoonlijke mobiliteit tegen betaalbare kosten.

De Wet gelijke behandeling op grond van handicap of chronische ziekte (Wgbh/cz) verbiedt in artikel 3 onderscheid bij de toegang tot openbaar vervoer. Op grond van artikel 2 van deze wet is de beheerder van de fysieke infrastructuur verplicht om geleidelijk doeltreffende aanpassingen te verrichten, tenzij dit een onevenredige belasting vormt.

Daarnaast hebben Rijk, provincies, vervoerregio's, gemeenten en vervoerders in het Bestuursakkoord Toegankelijkheid OV 2022-2032 afgesproken om de toegankelijkheid van haltes te verbeteren volgens de CROW-normen.

Verzoek
Ik verzoek u vriendelijk om:
  1. Een overzicht te geven van de planning voor het toegankelijk maken van bovengenoemde haltes;
  2. Bij toekomstige reconstructies van wegen en haltes de CROW-normen als uitgangspunt te nemen;
  3. Gebruik te maken van de beschikbare subsidies van de OV-autoriteit (${providerName}) voor het versnellen van deze aanpassingen.

Ik realiseer mij dat het toegankelijk maken van alle haltes tijd en middelen vergt. Tegelijkertijd is toegankelijk openbaar vervoer een basisvoorwaarde voor de zelfstandigheid en maatschappelijke deelname van een grote groep inwoners. Elke halte die wordt verbeterd maakt een verschil.

De gegevens in deze brief zijn afkomstig uit het Centraal Haltebestand en zijn te raadplegen via halteviewer.ov-data.nl.

Ik zie uw reactie met belangstelling tegemoet.

Met vriendelijke groet,

[Uw naam]
[Uw adres]`;
  }

  function buildMailtoUrl(email, subject, body) {
    // Truncate body for mailto URL length limits
    const lines = body.split('\n');
    let truncatedBody = body;
    const stopListStart = lines.findIndex(l => l.startsWith('  - '));
    if (stopListStart >= 0) {
      const stopLines = lines.filter(l => l.startsWith('  - '));
      if (stopLines.length > MAX_STOPS_MAILTO) {
        const beforeStops = lines.slice(0, stopListStart);
        const afterStops = lines.slice(lines.lastIndexOf(stopLines[stopLines.length - 1]) + 1);
        const truncatedStops = stopLines.slice(0, MAX_STOPS_MAILTO);
        truncatedStops.push(`  ... en nog ${stopLines.length - MAX_STOPS_MAILTO} andere haltes`);
        truncatedBody = [...beforeStops, ...truncatedStops, ...afterStops].join('\n');
      }
    }

    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(truncatedBody)}`;
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} gekopieerd`);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`${label} gekopieerd`);
    });
  }

  function showModal(authority, stops, concessionProviders) {
    lastFocused = document.activeElement;
    const email = authority.email || '';
    const subject = generateSubject(authority);
    const body = generateBody(authority, stops, concessionProviders);

    document.getElementById('email-to').value = email || 'E-mailadres niet beschikbaar';
    document.getElementById('email-subject').value = subject;
    document.getElementById('email-body').value = body;

    // Update mailto link
    const mailtoLink = document.getElementById('mailto-link');
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

  let lastFocused = null;

  function hideModal() {
    document.getElementById('email-modal').classList.add('hidden');
    if (lastFocused) { lastFocused.focus(); lastFocused = null; }
  }

  function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
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
    modal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideModal();
    });

    // Close on Escape, trap Tab focus
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal();
      if (e.key === 'Tab') trapFocus(modal, e);
    });

    // Per-field copy buttons
    document.querySelectorAll('.copy-field-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const labels = { 'email-to': 'E-mailadres', 'email-subject': 'Onderwerp', 'email-body': 'Bericht' };
        copyText(target.value, labels[btn.dataset.target] || 'Tekst');
      });
    });

    // Update mailto link when fields change
    const updateMailto = () => {
      const link = document.getElementById('mailto-link');
      const email = document.getElementById('email-to').value;
      if (email && !email.startsWith('E-mail')) {
        const subject = document.getElementById('email-subject').value;
        const body = document.getElementById('email-body').value;
        link.href = buildMailtoUrl(email, subject, body);
      }
    };
    document.getElementById('email-subject').addEventListener('input', updateMailto);
    document.getElementById('email-body').addEventListener('input', updateMailto);
  }

  return { init, showModal, hideModal };
})();
