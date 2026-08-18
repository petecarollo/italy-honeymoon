// uploader.js — shared upload logic using IndexedDB for persistence

const Uploader = (() => {

  // ── Domain-specific parsers ───────────────────────────────────
  function parseTransport(text) {
    const ls = text.split('\n').map(l => l.trim()).filter(Boolean);
    return {
      type: /train|trenitalia|italo|rail/i.test(text) ? 'Train'
          : /taxi|transfer|car|uber/i.test(text)      ? 'Transfer'
          : 'Flight',
      from:         ls.find(l => /depart|from|origin/i.test(l))?.replace(/depart(ure)?|from|origin/i,'').trim() || '',
      to:           ls.find(l => /arriv|to |dest/i.test(l))?.replace(/arriv(al)?|to |dest(ination)?/i,'').trim() || '',
      date:         findDate(text),
      time:         findTime(text),
      confirmation: findConfirmation(text),
      carrier:      ls.find(l => /airline|airways|air |flight|italo|trenitalia/i.test(l)) || '',
      addedAt:      new Date().toISOString(),
    };
  }

  function parseRestaurant(text) {
    const ls = text.split('\n').map(l => l.trim()).filter(Boolean);
    return {
      name:         ls[0] || '',
      date:         findDate(text),
      time:         findTime(text),
      address:      ls.find(l => /via |piazza |street|road|\d{1,5}\s+\w/i.test(l)) || '',
      confirmation: findConfirmation(text),
      phone:        findPhone(text),
      guests:       text.match(/(\d+)\s*(?:guest|person|people|pax|cover)/i)?.[1] || '',
      addedAt:      new Date().toISOString(),
    };
  }

  function parseExcursion(text) {
    const ls = text.split('\n').map(l => l.trim()).filter(Boolean);
    return {
      name:         ls[0] || '',
      date:         findDate(text),
      time:         findTime(text),
      location:     ls.find(l => /via |piazza |meet|departure|at |point/i.test(l)) || '',
      confirmation: findConfirmation(text),
      duration:     text.match(/(\d+(?:\.\d+)?\s*(?:hour|hr|h|day|night)s?)/i)?.[0] || '',
      provider:     ls.find(l => /tour|experience|excursion|guide/i.test(l)) || '',
      addedAt:      new Date().toISOString(),
    };
  }

  // ── Field extractors ─────────────────────────────────────────
  function findDate(text) {
    const patterns = [
      /\b(\w+ \d{1,2},?\s*\d{4})\b/,
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}\b/i,
    ];
    for (const p of patterns) { const m = text.match(p); if (m) return m[0]; }
    return '';
  }
  function findTime(text) {
    const m = text.match(/\b(\d{1,2}:\d{2}(?:\s?[APap][Mm])?)\b/);
    return m ? m[0] : '';
  }
  function findPhone(text) {
    const m = text.match(/(\+?[\d\s\-().]{7,17})/);
    return m ? m[0].trim() : '';
  }
  function findConfirmation(text) {
    const m = text.match(/(?:confirmation|booking|reservation|ref(?:erence)?|order)[^\w]*[#:]?\s*([A-Z0-9\-]{4,20})/i);
    return m ? m[1] : '';
  }

  // ── Table renderers ──────────────────────────────────────────
  function renderTransportTable(container, data) {
    container.innerHTML = `
      <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Type</th><th>From</th><th>To</th><th>Date</th><th>Time</th>
          <th>Carrier</th><th>Confirmation</th><th></th>
        </tr></thead>
        <tbody>
          ${data.map(r => `<tr>
            <td><span class="tag">${r.type}</span></td>
            <td>${esc(r.from) || '—'}</td>
            <td>${esc(r.to) || '—'}</td>
            <td>${esc(r.date) || '—'}</td>
            <td>${esc(r.time) || '—'}</td>
            <td>${esc(r.carrier) || '—'}</td>
            <td>${r.confirmation ? `<code class="conf-code">${esc(r.confirmation)}</code>` : '—'}</td>
            <td><button class="btn-delete btn-delete-row" data-id="${r.id}" data-store="transport">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>`;
  }

  function renderRestaurantTable(container, data) {
    container.innerHTML = `
      <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Restaurant</th><th>Date</th><th>Time</th><th>Guests</th>
          <th>Address</th><th>Confirmation</th><th>Phone</th><th></th>
        </tr></thead>
        <tbody>
          ${data.map(r => `<tr>
            <td><strong>${esc(r.name) || '—'}</strong></td>
            <td>${esc(r.date) || '—'}</td>
            <td>${esc(r.time) || '—'}</td>
            <td>${esc(r.guests) || '—'}</td>
            <td>${esc(r.address) || '—'}</td>
            <td>${r.confirmation ? `<code class="conf-code">${esc(r.confirmation)}</code>` : '—'}</td>
            <td>${esc(r.phone) || '—'}</td>
            <td><button class="btn-delete btn-delete-row" data-id="${r.id}" data-store="restaurants">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>`;
  }

  function renderExcursionTable(container, data) {
    container.innerHTML = `
      <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Excursion</th><th>Date</th><th>Time</th><th>Duration</th>
          <th>Location</th><th>Provider</th><th>Confirmation</th><th></th>
        </tr></thead>
        <tbody>
          ${data.map(r => `<tr>
            <td><strong>${esc(r.name) || '—'}</strong></td>
            <td>${esc(r.date) || '—'}</td>
            <td>${esc(r.time) || '—'}</td>
            <td>${esc(r.duration) || '—'}</td>
            <td>${esc(r.location) || '—'}</td>
            <td>${esc(r.provider) || '—'}</td>
            <td>${r.confirmation ? `<code class="conf-code">${esc(r.confirmation)}</code>` : '—'}</td>
            <td><button class="btn-delete btn-delete-row" data-id="${r.id}" data-store="excursions">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>`;
  }

  const renderers = { transport: renderTransportTable, restaurants: renderRestaurantTable, excursions: renderExcursionTable };
  const parsers   = { transport: parseTransport,       restaurants: parseRestaurant,       excursions: parseExcursion };

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Init ─────────────────────────────────────────────────────
  async function init(storeKey) {
    const dropZone  = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusEl  = document.getElementById('ocr-status');
    const tableWrap = document.getElementById('table-wrap');
    const rawWrap   = document.getElementById('raw-wrap');
    const rawPre    = document.getElementById('raw-text');

    if (!dropZone) return;

    await TripDB.open();
    await refresh();

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag & drop
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) processFile(fileInput.files[0]);
      fileInput.value = '';
    });

    // Delete row
    document.addEventListener('click', async e => {
      if (e.target.classList.contains('btn-delete-row')) {
        const id    = parseInt(e.target.dataset.id);
        const store = e.target.dataset.store;
        if (store === storeKey) {
          await TripDB.remove(store, id);
          await refresh();
        }
      }
    });

    async function processFile(file) {
      statusEl.textContent = '⏳ Loading…';

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => { dropZone.style.backgroundImage = `url(${reader.result})`; };
        reader.readAsDataURL(file);
      } else {
        dropZone.style.background = '#f5ede0';
        const iconEl  = dropZone.querySelector('.upload-icon');
        const labelEl = dropZone.querySelector('.upload-label');
        if (iconEl)  iconEl.textContent  = '📄';
        if (labelEl) labelEl.textContent = file.name;
      }

      try {
        const { text, preview } = await FileTextReader.extract(file, msg => {
          statusEl.textContent = msg;
        });

        if (rawPre) {
          rawPre.textContent    = text;
          rawWrap.style.display = 'block';
        }

        const parsed = parsers[storeKey](text);
        await TripDB.add(storeKey, parsed);
        await refresh();
        statusEl.textContent = '✅ Saved!';

      } catch (err) {
        console.error(err);
        statusEl.textContent = '❌ Failed: ' + err.message;
      }
    }

    async function refresh() {
      const data = await TripDB.getAll(storeKey);
      tableWrap.innerHTML = '';
      if (data.length) {
        renderers[storeKey](tableWrap, data);
      } else {
        tableWrap.innerHTML = '<p class="no-data">No entries yet — upload a file above.</p>';
      }
    }
  }

  return { init };
})();
