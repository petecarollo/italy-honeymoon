// transfers.js — manual entry only, no upload

document.addEventListener('DOMContentLoaded', async () => {

  const display = document.getElementById('transfers-display');
  const STORE   = 'transport';

  await TripDB.open();
  await runMigrations();
  await renderAll();

  // ── Toggle upload section ────────────────────────────────────
  const toggleUploadBtn = document.getElementById('toggle-upload-btn');
  const uploadSection   = document.getElementById('upload-section');
  toggleUploadBtn.addEventListener('click', () => {
    const open = uploadSection.style.display === 'none';
    uploadSection.style.display = open ? 'block' : 'none';
    toggleUploadBtn.querySelector('span:last-child').textContent = open ? 'Hide Upload' : 'Upload PDF / Image';
  });

  // ── Upload / OCR ─────────────────────────────────────────────
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const statusEl  = document.getElementById('ocr-status');
  const rawWrap   = document.getElementById('raw-wrap');
  const rawPre    = document.getElementById('raw-text');

  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
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
  }

  async function processFile(file) {
    statusEl.textContent = '⏳ Loading…';
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => {
        dropZone.style.backgroundImage    = 'url(' + ev.target.result + ')';
        dropZone.style.backgroundSize     = 'cover';
        dropZone.style.backgroundPosition = 'center';
      };
      reader.readAsDataURL(file);
    } else {
      dropZone.style.background = '#f5ede0';
      const iconEl  = dropZone.querySelector('.upload-icon');
      const labelEl = dropZone.querySelector('.upload-label');
      if (iconEl)  iconEl.textContent  = '📄';
      if (labelEl) labelEl.textContent = file.name;
    }
    try {
      const { text } = await FileTextReader.extract(file, msg => { statusEl.textContent = msg; });
      rawPre.textContent    = text;
      rawWrap.style.display = 'block';
      const parsed = parseTransfer(text);
      await TripDB.add(STORE, parsed);
      await renderAll();
      statusEl.textContent = '✅ Saved — edit any fields below.';
      // Scroll to new card
      setTimeout(() => display.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    } catch (err) {
      console.error(err);
      statusEl.textContent = '❌ Could not read file: ' + err.message;
    }
  }

  // ── Parse transfer from text ─────────────────────────────────
  function parseTransfer(text) {
    const t     = text.replace(/\s+/g, ' ');
    const type  = /train|trenitalia|italo|rail|freccia/i.test(t) ? 'Train'
                : /taxi|transfer|private\s+car|shuttle|driver/i.test(t) ? 'Transfer'
                : 'Flight';
    const typeIcon = type === 'Train' ? '🚂' : type === 'Transfer' ? '🚕' : '✈️';

    const carrierPatterns = [
      /\b(ITA\s*Airways|Alitalia|Ryanair|EasyJet|Vueling|Wizz\s*Air|Neos|Air\s*Dolomiti)\b/i,
      /\b(Delta|United|American|Southwest|JetBlue|Spirit|Alaska)\b/i,
      /\b(Lufthansa|British\s*Airways|Air\s*France|KLM|Swiss|Austrian|Iberia|TAP|Aer\s*Lingus)\b/i,
      /\b(Emirates|Qatar\s*Airways|Etihad|Turkish\s*Airlines)\b/i,
      /\b(Trenitalia|Italo|Frecciarossa|Frecciargento|Intercity)\b/i,
    ];
    let carrier = '';
    for (const p of carrierPatterns) { const m = t.match(p); if (m) { carrier = m[1].replace(/\s+/g,' ').trim(); break; } }

    const flightMatch = t.match(/\b([A-Z]{2,3}\s*\d{3,4})\b/) || t.match(/flight\s*(?:#|no\.?)?\s*([A-Z0-9]{4,7})/i);
    const flightNo    = flightMatch ? flightMatch[1].replace(/\s/g,'') : '';

    const airports   = [...t.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]);
    const fromCode   = airports[0] || '';
    const toCode     = airports[1] || '';

    const CITIES = 'Rome|Roma|Florence|Firenze|Venice|Venezia|Milan|Milano|Naples|Napoli|Sorrento|Positano|Amalfi|Taormina|Palermo|Catania|New York|Newark|Boston|Chicago|Los Angeles|London|Paris|Frankfurt|Amsterdam';
    const cityMatches = [...t.matchAll(new RegExp('\\b(' + CITIES + ')\\b', 'gi'))].map(m => m[1]);

    const DATE_RE      = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+\w+\s+\d{1,2}(?:,?\s*\d{4})?|\w+\s+\d{1,2},?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i;
    const departBlock  = t.match(/depart(?:ure)?\b([\s\S]{0,80})/i)?.[1] || t;
    const arrivalBlock = t.match(/arriv(?:al|es)?\b([\s\S]{0,80})/i)?.[1] || '';
    const date         = departBlock.match(DATE_RE)?.[0]?.trim() || t.match(DATE_RE)?.[0]?.trim() || '';
    const arrivalDate  = arrivalBlock.match(DATE_RE)?.[0]?.trim() || '';

    const TIME_RE    = /\d{1,2}:\d{2}\s*(?:[APap][Mm])?/g;
    const allTimes   = [...t.matchAll(TIME_RE)].map(m => m[0].trim());
    const departTime = allTimes[0] || '';
    const arriveTime = allTimes[1] || '';

    const durMatch  = t.match(/(\d+h\s*\d*m?|\d+\s*hr?s?\s*\d*\s*min?)/i);
    const duration  = durMatch ? durMatch[0].trim() : '';
    const confMatch = t.match(/(?:confirmation|booking|record\s+locator|pnr|ref)[^\w]*[#:]?\s*([A-Z0-9]{4,12})/i) || t.match(/\b([A-Z]{2}[A-Z0-9]{4,8})\b/);
    const confirmation = confMatch ? confMatch[1] : '';
    const costMatch = t.match(/total[:\s]*\$?\s*([\d,]+\.\d{2})/i) || t.match(/\$\s*([\d]{2,6}\.\d{2})/);
    const cost      = costMatch ? costMatch[1].replace(/,/g,'') : '';
    const classMatch = t.match(/\b(economy|coach|business|first\s*class|premium\s*economy)\b/i);
    const seatClass  = classMatch ? classMatch[1] : '';

    return {
      type, typeIcon, carrier, flightNo,
      from: cityMatches[0] || '', to: cityMatches[1] || '',
      fromCode, toCode,
      date, departTime, arrivalDate, arriveTime,
      duration, confirmation, cost,
      passengers: '2', seatClass,
      addedAt: new Date().toISOString(),
    };
  }

  // ── Add blank card buttons ────────────────────────────────────
  document.querySelectorAll('.add-type-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type     = btn.dataset.type;
      const typeIcon = btn.dataset.icon;
      const blank = {
        type, typeIcon,
        carrier: '', flightNo: '',
        from: '', to: '', fromCode: '', toCode: '',
        date: '', departTime: '', arrivalDate: '', arriveTime: '',
        duration: '', confirmation: '', cost: '',
        passengers: '2', seatClass: '',
        addedAt: new Date().toISOString(),
      };
      await TripDB.add(STORE, blank);
      await renderAll();
      // Scroll to the new card
      setTimeout(() => display.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    });
  });

  // ── Flip ─────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-flip');
    if (!btn) return;
    const wrap = document.getElementById(btn.dataset.target);
    if (wrap) wrap.classList.toggle('flipped');
  });

  // ── Delete ───────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-delete-transfer')) return;
    const id = parseInt(e.target.dataset.id);
    if (confirm('Remove this entry?')) {
      await TripDB.remove(STORE, id);
      await renderAll();
    }
  });

  // ── Photo upload ─────────────────────────────────────────────
  document.addEventListener('click', e => {
    const imgCol = e.target.closest('.stay-image-col');
    if (imgCol && !e.target.closest('.btn-flip') && !e.target.closest('.btn-delete-transfer')) {
      const input = imgCol.querySelector('.photo-input-transfer');
      if (input) input.click();
    }
  });
  document.addEventListener('change', async e => {
    if (!e.target.classList.contains('photo-input-transfer')) return;
    const file = e.target.files[0];
    if (!file) return;
    const id = parseInt(e.target.dataset.id);
    const reader = new FileReader();
    reader.onload = async ev => {
      const rec = await TripDB.getById(STORE, id);
      if (!rec) return;
      rec.photo = ev.target.result;
      await TripDB.update(STORE, rec);
      await renderAll();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // ── Edit fields ──────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-transfer')) return;
    const id    = parseInt(e.target.dataset.id);
    const field = e.target.dataset.field;
    const rec   = await TripDB.getById(STORE, id);
    if (!rec) return;

    if (field === 'type') {
      const val = prompt('Type (Flight, Train, or Transfer):', rec.type || '');
      if (val === null) return;
      rec.type     = val.trim();
      rec.typeIcon = /train/i.test(val) ? '🚂' : /transfer|taxi|shuttle/i.test(val) ? '🚕' : /hopper/i.test(val) ? '🛫' : '✈️';
    } else if (field === 'date') {
      const result = await DatePicker.open(e.target, rec.date, rec.departTime);
      if (!result) return;
      rec.date = result.dateStr;
      if (result.timeStr) rec.departTime = result.timeStr;
    } else if (field === 'arrivalDate') {
      const result = await DatePicker.open(e.target, rec.arrivalDate, rec.arriveTime);
      if (!result) return;
      rec.arrivalDate = result.dateStr;
      if (result.timeStr) rec.arriveTime = result.timeStr;
    } else {
      const val = prompt('Edit ' + (e.target.dataset.label || field) + ':', rec[field] || '');
      if (val === null) return;
      rec[field] = val.trim();
    }

    await TripDB.update(STORE, rec);
    await renderAll();
  });

  // ── Add / remove layover ────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-add-layover')) return;
    e.stopPropagation();
    const id  = parseInt(e.target.dataset.id);
    const rec = await TripDB.getById(STORE, id);
    if (!rec) return;
    if (!rec.layovers) rec.layovers = [];
    rec.layovers.push({ airport: '', city: '', carrier: '', arriveTime: '', departTime: '', duration: '' });
    await TripDB.update(STORE, rec);
    await renderAll();
  });

  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-remove-layover')) return;
    const id  = parseInt(e.target.dataset.id);
    const idx = parseInt(e.target.dataset.idx);
    const rec = await TripDB.getById(STORE, id);
    if (!rec || !rec.layovers) return;
    rec.layovers.splice(idx, 1);
    await TripDB.update(STORE, rec);
    await renderAll();
  });

  // ── Edit layover field ───────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-layover')) return;
    const id    = parseInt(e.target.dataset.id);
    const idx   = parseInt(e.target.dataset.idx);
    const field = e.target.dataset.field;
    const label = e.target.dataset.label || field;
    const rec   = await TripDB.getById(STORE, id);
    if (!rec || !rec.layovers?.[idx]) return;

    if (field === 'arriveTime' || field === 'departTime') {
      const result = await DatePicker.open(e.target, rec.layovers[idx].arriveDate || rec.date, rec.layovers[idx][field]);
      if (!result) return;
      if (result.timeStr) rec.layovers[idx][field] = result.timeStr;
    } else {
      const val = prompt('Edit ' + label + ':', rec.layovers[idx][field] || '');
      if (val === null) return;
      rec.layovers[idx][field] = val.trim();
    }

    await TripDB.update(STORE, rec);
    await renderAll();
  });

  // ── Edit cost ────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-transfer-cost')) return;
    const id  = parseInt(e.target.dataset.id);
    const rec = await TripDB.getById(STORE, id);
    if (!rec) return;
    const input = prompt('Total cost (e.g. 450.00):', rec.cost || '');
    if (input === null) return;
    const val = parseFloat(input.replace(/[^0-9.]/g, ''));
    if (isNaN(val) || val <= 0) { alert('Enter a valid amount.'); return; }
    rec.cost = val.toFixed(2);
    await TripDB.update(STORE, rec);
    await renderAll();
  });

  // ── Render all ───────────────────────────────────────────────
  async function renderAll() {
    const data = await TripDB.getAll(STORE);
    if (!data.length) {
      display.innerHTML = '<p class="no-data">No entries yet — use the buttons above to add a flight, train, or transfer.</p>';
      return;
    }

    data.sort((a, b) => {
      const toMs = s => {
        if (!s) return Infinity;
        let clean = s.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s*/i, '').trim();
        if (!/\d{4}/.test(clean)) clean += ' 2026';
        const d = new Date(clean.replace(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/, '$3-$2-$1'));
        return isNaN(d) ? Infinity : d.getTime();
      };

      // Parse a time string like "6:25 AM" or "11:30am" into minutes since midnight
      const timeToMins = t => {
        if (!t) return 0;
        const m = t.match(/(\d{1,2}):(\d{2})\s*([APap][Mm])?/);
        if (!m) return 0;
        let h = parseInt(m[1]), min = parseInt(m[2]);
        const ap = (m[3] || '').toUpperCase();
        if (ap === 'PM' && h < 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return h * 60 + min;
      };

      const dateA = toMs(a.date), dateB = toMs(b.date);
      if (dateA !== dateB) return dateA - dateB;
      // Same date — sort by departure time
      return timeToMins(a.departTime) - timeToMins(b.departTime);
    });

    display.innerHTML = '<div class="transfers-grid">' + data.map(r => renderCard(r)).join('') + '</div>';
  }

  // ── Render card ──────────────────────────────────────────────
  function renderCard(rec) {
    const costDisplay = rec.cost
      ? '$' + parseFloat(rec.cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null;

    const icon = rec.typeIcon || (rec.type === 'Train' ? '🚂' : rec.type === 'Transfer' ? '🚕' : '✈️');

    // Color per type
    const colBg    = rec.type === 'Train'    ? 'linear-gradient(135deg,#edf5e8,#c8e6b8)'
                   : rec.type === 'Transfer' ? 'linear-gradient(135deg,#fdf8e8,#f5e9b8)'
                   : rec.type === 'Hopper'   ? 'linear-gradient(135deg,#f0e8f5,#ddc8ee)'
                   : 'linear-gradient(135deg,#e8f0fc,#c8d8f8)';   // Flight = blue
    const colText  = rec.type === 'Train'    ? '#2e6b2e'
                   : rec.type === 'Transfer' ? '#8b6914'
                   : rec.type === 'Hopper'   ? '#6b3a8b'
                   : '#4a6fa5';

    const front = `
      <div class="stay-brief stay-face stay-front">
        <div class="stay-brief-header">
          <div class="stay-city-badge" style="display:flex;align-items:center;gap:0.5rem;">
            <span>${icon} ${esc(rec.type || 'Flight')}</span>
            <button class="btn-edit-transfer" data-id="${rec.id}" data-field="type" data-label="Type (Flight / Train / Transfer)" style="background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#e8d5b0;font-size:0.7rem;padding:0.1rem 0.4rem;cursor:pointer;opacity:0.5;">✏️</button>
          </div>
          <button class="btn-delete-transfer" data-id="${rec.id}">✕ Remove</button>
        </div>

        <div class="stay-brief-body">
          <!-- Left col -->
          <div class="stay-image-col transfer-icon-col" title="Click to upload image">
            ${rec.photo
              ? '<img src="' + rec.photo + '" class="stay-preview-img" alt="Transfer" />'
              : '<div class="stay-image-placeholder transfer-placeholder" style="background:' + colBg + '"><span>' + icon + '</span><p style="color:' + colText + '">' + esc(rec.carrier || rec.type || 'Flight') + '</p></div>'
            }
            <input type="file" class="photo-input-transfer" accept="image/*" data-id="${rec.id}" hidden />
          </div>

          <!-- Details -->
          <div class="stay-details-col">

            <!-- Route headline -->
            <div class="transfer-route">
              <div class="transfer-endpoint">
                <span class="transfer-code">
                  ${rec.fromCode
                    ? esc(rec.fromCode)
                    : '<span style="font-size:1rem;color:#bbb;">FROM</span>'
                  }
                </span>
                <span class="transfer-city">
                  ${esc(rec.from) || '<em style="color:#ccc">City</em>'}
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="from" data-label="Departure city">✏️</button>
                </span>
              </div>
              <div class="transfer-arrow">
                <span>${icon}</span>
                ${rec.duration ? '<span class="transfer-duration">' + esc(rec.duration) + '</span>' : ''}
              </div>
              <div class="transfer-endpoint transfer-endpoint-right">
                <span class="transfer-code">
                  ${rec.toCode
                    ? esc(rec.toCode)
                    : '<span style="font-size:1rem;color:#bbb;">TO</span>'
                  }
                </span>
                <span class="transfer-city">
                  ${esc(rec.to) || '<em style="color:#ccc">City</em>'}
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="to" data-label="Arrival city">✏️</button>
                </span>
              </div>
            </div>

            <table class="stay-table"><tbody>

              <tr>
                <td class="st-label">✈️ Carrier</td>
                <td>
                  ${rec.carrier ? esc(rec.carrier) : '<em class="cost-missing">—</em>'}
                  ${rec.flightNo ? ' <code class="conf-code">' + esc(rec.flightNo) + '</code>' : ''}
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="carrier" data-label="Airline / carrier name">✏️</button>
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="flightNo" data-label="Flight or train number">＋#</button>
                </td>
              </tr>

              <tr>
                <td class="st-label">🛫 Departure</td>
                <td>
                  ${rec.date ? '<strong>' + esc(rec.date) + '</strong>' : '<em class="cost-missing">Date not set</em>'}
                  ${rec.departTime ? ' at ' + esc(rec.departTime) : ''}
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="date" title="Pick date & time">📅</button>
                </td>
              </tr>

              <tr>
                <td class="st-label">🛬 Arrival</td>
                <td>
                  ${rec.arrivalDate ? '<strong>' + esc(rec.arrivalDate) + '</strong>' : (rec.date ? '<em class="cost-missing">Date not set</em>' : '<em class="cost-missing">Date not set</em>')}
                  ${rec.arriveTime ? ' at ' + esc(rec.arriveTime) : ''}
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="arrivalDate" title="Pick date & time">📅</button>
                </td>
              </tr>

              ${rec.seatClass ? '<tr><td class="st-label">💺 Class</td><td>' + esc(rec.seatClass) + ' <button class="btn-edit-transfer" data-id="' + rec.id + '" data-field="seatClass" data-label="Seat class">✏️</button></td></tr>'
                              : '<tr><td class="st-label">💺 Class</td><td><em class="cost-missing">—</em> <button class="btn-edit-transfer" data-id="' + rec.id + '" data-field="seatClass" data-label="Seat class (e.g. Economy)">✏️</button></td></tr>'}

              <tr>
                <td class="st-label">🔖 Confirmation</td>
                <td>
                  ${rec.confirmation ? '<code class="conf-code">' + esc(rec.confirmation) + '</code>' : '<em class="cost-missing">—</em>'}
                  <button class="btn-edit-transfer" data-id="${rec.id}" data-field="confirmation" data-label="Confirmation / PNR">✏️</button>
                </td>
              </tr>

              <tr class="cost-row">
                <td class="st-label">💰 Cost</td>
                <td>
                  ${costDisplay ? '<strong class="cost-amount">' + costDisplay + '</strong>' : '<em class="cost-missing">Not set</em>'}
                  <button class="btn-edit-transfer-cost" data-id="${rec.id}" title="Edit cost">${costDisplay ? '✏️' : '➕'}</button>
                </td>
              </tr>

              <!-- Layover rows -->
              ${(rec.layovers || []).map((lay, idx) => `
              <tr class="layover-row">
                <td class="st-label layover-label">🔁 Layover ${(rec.layovers.length > 1 ? idx + 1 : '')}</td>
                <td class="layover-fields">
                  <span class="layover-item">
                    <span class="layover-field-label">Airport</span>
                    <span>${esc(lay.airport) || '<em class="cost-missing">—</em>'}
                      <button class="btn-edit-layover" data-id="${rec.id}" data-idx="${idx}" data-field="airport" data-label="Layover airport / city">✏️</button>
                    </span>
                  </span>
                  <span class="layover-item">
                    <span class="layover-field-label">Carrier</span>
                    <span>${esc(lay.carrier) || '<em class="cost-missing">—</em>'}
                      <button class="btn-edit-layover" data-id="${rec.id}" data-idx="${idx}" data-field="carrier" data-label="Carrier / airline">✏️</button>
                    </span>
                  </span>
                  <span class="layover-item">
                    <span class="layover-field-label">Arrive</span>
                    <span>${esc(lay.arriveTime) || '<em class="cost-missing">—</em>'}
                      <button class="btn-edit-layover" data-id="${rec.id}" data-idx="${idx}" data-field="arriveTime" data-label="Layover arrival time">📅</button>
                    </span>
                  </span>
                  <span class="layover-item">
                    <span class="layover-field-label">Depart</span>
                    <span>${esc(lay.departTime) || '<em class="cost-missing">—</em>'}
                      <button class="btn-edit-layover" data-id="${rec.id}" data-idx="${idx}" data-field="departTime" data-label="Layover departure time">📅</button>
                    </span>
                  </span>
                  <span class="layover-item">
                    <span class="layover-field-label">Wait</span>
                    <span>${esc(lay.duration) || '<em class="cost-missing">—</em>'}
                      <button class="btn-edit-layover" data-id="${rec.id}" data-idx="${idx}" data-field="duration" data-label="Layover duration (e.g. 1h 30m)">✏️</button>
                    </span>
                  </span>
                  <button class="btn-remove-layover" data-id="${rec.id}" data-idx="${idx}" title="Remove layover">✕</button>
                </td>
              </tr>`).join('')}

              <tr>
                <td colspan="2" style="padding-top:0.5rem;">
                  <button class="btn-add-layover" data-id="${rec.id}">＋ Add Layover</button>
                </td>
              </tr>

            </tbody></table>
          </div>
        </div>
        <button class="btn-flip" data-target="tflip-${rec.id}" title="Flip">♥</button>
      </div>`;

    const back = `
      <div class="stay-brief stay-face stay-back">
        <div class="stay-brief-header">
          <div class="stay-city-badge">${icon} ${esc(rec.from) || '?'} → ${esc(rec.to) || '?'}</div>
          <button class="btn-delete-transfer" data-id="${rec.id}">✕ Remove</button>
        </div>
        <div class="stay-back-body transfer-back-body">
          <div class="transfer-back-detail">
            <div class="transfer-back-section">
              <h4>🛫 Departure</h4>
              <p class="tbd">${esc(rec.from) || '—'} ${rec.fromCode ? '(' + esc(rec.fromCode) + ')' : ''}</p>
              <p>${esc(rec.date) || '—'} ${rec.departTime ? '· ' + esc(rec.departTime) : ''}</p>
            </div>
            <div class="transfer-back-divider">${icon}<br/>${rec.duration ? '<small>' + esc(rec.duration) + '</small>' : ''}</div>
            <div class="transfer-back-section" style="text-align:right;">
              <h4>🛬 Arrival</h4>
              <p class="tbd">${esc(rec.to) || '—'} ${rec.toCode ? '(' + esc(rec.toCode) + ')' : ''}</p>
              <p>${esc(rec.arrivalDate || rec.date) || '—'} ${rec.arriveTime ? '· ' + esc(rec.arriveTime) : ''}</p>
            </div>
          </div>
          ${rec.carrier || rec.flightNo ? '<p class="transfer-back-meta">' + esc(rec.carrier) + (rec.flightNo ? ' · ' + esc(rec.flightNo) : '') + (rec.seatClass ? ' · ' + esc(rec.seatClass) : '') + '</p>' : ''}
          ${rec.confirmation ? '<p class="transfer-back-meta">Confirmation: <code class="conf-code">' + esc(rec.confirmation) + '</code></p>' : ''}
          <p class="stay-back-hint">More details coming as you fill out other tabs.</p>
        </div>
        <button class="btn-flip btn-flip-back" data-target="tflip-${rec.id}" title="Flip back">♥</button>
      </div>`;

    return '<div class="stay-flip-wrap" id="tflip-' + rec.id + '"><div class="stay-flip-inner">' + front + back + '</div></div>';
  }

  // ── Migrations ───────────────────────────────────────────────
  async function runMigrations() {
    const all = await TripDB.getAll(STORE);
    for (const rec of all) {
      let dirty = false;

      // Remove "price" that got scraped as a flight number
      if (rec.flightNo === 'price') {
        rec.flightNo = '';
        dirty = true;
      }

      // Fix type/icon for records missing them
      if (!rec.type) {
        const hasAirportCodes = /\b[A-Z]{3}\b/.test((rec.fromCode || '') + (rec.toCode || ''));
        rec.type     = hasAirportCodes ? 'Flight' : 'Transfer';
        rec.typeIcon = rec.type === 'Flight' ? '✈️' : '🚕';
        dirty = true;
      }

      // Delete blank empty records (no from, no to, no date, no confirmation)
      const isEmpty = !rec.from && !rec.to && !rec.date && !rec.confirmation && !rec.carrier;
      if (isEmpty) {
        await TripDB.remove(STORE, rec.id);
        continue;
      }

      if (dirty) await TripDB.update(STORE, rec);
    }
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

});
