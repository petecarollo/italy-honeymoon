// stays.js — uses IndexedDB for persistent storage

document.addEventListener('DOMContentLoaded', async () => {

  const display   = document.getElementById('stays-display');
  const STORE     = 'stays';

  await TripDB.open();
  try { await runMigrations(); } catch(e) { console.warn('Migration error:', e); }
  await renderAll();

  // ── Drop zone ────────────────────────────────────────────────
  // Upload removed — stays are added via manual data entry or patch files

  // ── Delete ───────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (e.target.classList.contains('btn-delete-stay')) {
      const id = parseInt(e.target.dataset.id);
      if (confirm('Remove this stay?')) {
        await TripDB.remove(STORE, id);
        await renderAll();
      }
    }
    const imgCol = e.target.closest('.stay-image-col');
    if (imgCol && !e.target.classList.contains('btn-delete-stay')) {
      const input = imgCol.querySelector('.photo-input');
      if (input) input.click();
    }
  });
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-add-day-event')) return;
    e.stopPropagation();
    const stayId  = parseInt(e.target.dataset.stayid);
    const dateKey = e.target.dataset.date;
    const stay    = await TripDB.getById(STORE, stayId);
    if (!stay) return;

    const label = prompt('What\'s happening?\n(e.g. Dinner at Da Enzo, Colosseum tour, Wine tasting)');
    if (!label || !label.trim()) return;
    const time  = prompt('Time? (e.g. 7:30 PM — leave blank if all day)', '') || '';
    const emoji = prompt('Emoji? (e.g. 🍝 🎭 🚗 🍷 ☀️ — leave blank for 📌)', '') || '📌';

    if (!stay.dayEvents) stay.dayEvents = {};
    if (!stay.dayEvents[dateKey]) stay.dayEvents[dateKey] = [];
    stay.dayEvents[dateKey].push({ label: label.trim(), time: time.trim(), emoji: emoji.trim() || '📌' });

    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Edit day event ───────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-day-event')) return;
    e.stopPropagation();
    const stayId  = parseInt(e.target.dataset.stayid);
    const dateKey = e.target.dataset.date;
    const idx     = parseInt(e.target.dataset.idx);
    const stay    = await TripDB.getById(STORE, stayId);
    if (!stay?.dayEvents?.[dateKey]?.[idx]) return;

    const ev    = stay.dayEvents[dateKey][idx];
    const label = prompt('Edit event:', ev.label);
    if (label === null) return;
    const time  = prompt('Time:', ev.time || '') || '';
    const emoji = prompt('Emoji:', ev.emoji || '📌') || '📌';

    stay.dayEvents[dateKey][idx] = { label: label.trim(), time: time.trim(), emoji: emoji.trim() };
    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Delete day event ─────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-delete-day-event')) return;
    e.stopPropagation();
    const stayId  = parseInt(e.target.dataset.stayid);
    const dateKey = e.target.dataset.date;
    const idx     = parseInt(e.target.dataset.idx);
    const stay    = await TripDB.getById(STORE, stayId);
    if (!stay?.dayEvents?.[dateKey]) return;
    stay.dayEvents[dateKey].splice(idx, 1);
    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Delete ───────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (e.target.classList.contains('btn-delete-stay')) {
      const id = parseInt(e.target.dataset.id);
      if (confirm('Remove this stay?')) {
        await TripDB.remove(STORE, id);
        await renderAll();
      }
    }
    const imgCol = e.target.closest('.stay-image-col');
    if (imgCol && !e.target.classList.contains('btn-delete-stay') && !e.target.closest('.btn-flip')) {
      const input = imgCol.querySelector('.photo-input');
      if (input) input.click();
    }
  });

  // ── Edit field (calendar for dates) ─────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-field')) return;
    const id    = parseInt(e.target.dataset.id);
    const field = e.target.dataset.field;
    const stay  = await TripDB.getById(STORE, id);
    if (!stay) return;
    if (field === 'checkIn' || field === 'checkOut') {
      const timeField = field === 'checkIn' ? 'checkInTime' : 'checkOutTime';
      const result = await DatePicker.open(e.target, stay[field], stay[timeField]);
      if (!result) return;
      stay[field] = result.dateStr;
      if (result.timeStr) stay[timeField] = result.timeStr;
    } else {
      const val = prompt(`Edit ${e.target.dataset.label || field}:`, stay[field] || '');
      if (val === null) return;
      stay[field] = val.trim();
    }
    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Edit title ───────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-title')) return;
    const id   = parseInt(e.target.dataset.id);
    const stay = await TripDB.getById(STORE, id);
    if (!stay) return;
    const name = prompt('Edit property name:', stay.propertyTitle || '');
    if (name === null || !name.trim()) return;
    stay.propertyTitle = name.trim();
    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Edit URL ─────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-url')) return;
    const id   = parseInt(e.target.dataset.id);
    const stay = await TripDB.getById(STORE, id);
    if (!stay) return;
    const url = prompt('Paste the Airbnb (or booking) URL:', stay.url || '');
    if (url === null) return;
    stay.url = url.trim();
    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Edit cost ────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-edit-cost')) return;
    const id   = parseInt(e.target.dataset.id);
    const stay = await TripDB.getById(STORE, id);
    if (!stay) return;
    const input = prompt(`Total cost for "${stay.propertyTitle}" (numbers only, e.g. 710.30)`, stay.cost || '');
    if (input === null) return;
    const val = parseFloat(input.replace(/[^0-9.]/g, ''));
    if (isNaN(val) || val <= 0) { alert('Please enter a valid amount.'); return; }
    stay.cost = val.toFixed(2);
    await TripDB.update(STORE, stay);
    await renderAll();
  });

  // ── Photo upload ─────────────────────────────────────────────
  document.addEventListener('change', async e => {
    if (!e.target.classList.contains('photo-input')) return;
    const file = e.target.files[0];
    if (!file) return;
    const id = parseInt(e.target.dataset.id);
    const reader = new FileReader();
    reader.onload = async ev => {
      const stay = await TripDB.getById(STORE, id);
      if (!stay) return;
      stay.photo = ev.target.result;
      await TripDB.update(STORE, stay);
      await renderAll();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // ── Render all ───────────────────────────────────────────────
  async function renderAll() {
    const data = await TripDB.getAll(STORE);
    if (!data.length) {
      display.innerHTML = '<p class="no-data">No stays added yet.</p>';
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
      return toMs(a.checkIn) - toMs(b.checkIn);
    });
    display.innerHTML = data.map(stay => renderBrief(stay)).join('');
  }

  // ── Render single card — 3-column layout ────────────────────
  function renderBrief(stay) {
    const nights      = calcNights(stay.checkIn, stay.checkOut);
    const costDisplay = stay.cost ? '$' + parseFloat(stay.cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const perNight    = (stay.cost && nights > 0) ? '$' + (parseFloat(stay.cost) / nights).toFixed(0) + '/night' : '';
    const dayRows     = buildDayRows(stay, nights);

    return `
    <div class="stay-card" id="stay-${stay.id}">

      <!-- Header -->
      <div class="stay-brief-header">
        <div class="stay-city-badge">📍 ${esc(stay.city) || 'Italy'}</div>
        <button class="btn-delete-stay" data-id="${stay.id}">✕ Remove</button>
      </div>

      <!-- 3-column body -->
      <div class="stay-card-body">

        <!-- Col 1: Photo -->
        <div class="stay-image-col" data-id="${stay.id}" title="Click to upload a photo">
          ${stay.photo
            ? '<img src="' + stay.photo + '" class="stay-preview-img" alt="Property photo" />'
            : '<div class="stay-image-placeholder"><span>📷</span><p>Click to add photo</p></div>'
          }
          <input type="file" class="photo-input" accept="image/*" data-id="${stay.id}" hidden />
        </div>

        <!-- Col 2: Details -->
        <div class="stay-details-col">
          <h3 class="stay-title">
            ${stay.url
              ? '<a href="' + esc(stay.url) + '" target="_blank" rel="noopener" class="stay-title-link">' + esc(stay.propertyTitle) + '</a>'
              : esc(stay.propertyTitle)
            }
            <button class="btn-edit-title" data-id="${stay.id}" title="Edit name">✏️</button>
            <button class="btn-edit-url" data-id="${stay.id}" title="${stay.url ? 'Change link' : 'Add link'}">${stay.url ? '🔗' : '＋🔗'}</button>
          </h3>
          ${stay.host ? '<p class="stay-host">Hosted by <strong>' + esc(stay.host) + '</strong></p>' : ''}
          <table class="stay-table"><tbody>
            <tr>
              <td class="st-label">📅 Check-in</td>
              <td><strong>${esc(stay.checkIn) || '—'}</strong>${stay.checkInTime ? ' &nbsp;at ' + esc(stay.checkInTime) : ''}
                <button class="btn-edit-field" data-id="${stay.id}" data-field="checkIn" title="Pick date & time">📅</button></td>
            </tr>
            <tr>
              <td class="st-label">📅 Check-out</td>
              <td><strong>${esc(stay.checkOut) || '—'}</strong>${stay.checkOutTime ? ' &nbsp;at ' + esc(stay.checkOutTime) : ''}
                <button class="btn-edit-field" data-id="${stay.id}" data-field="checkOut" title="Pick date & time">📅</button></td>
            </tr>
            ${nights > 0 ? '<tr><td class="st-label">🌙 Nights</td><td>' + nights + ' night' + (nights !== 1 ? 's' : '') + '</td></tr>' : ''}
            <tr>
              <td class="st-label">📍 Address</td>
              <td>${esc(stay.address) || '—'}${stay.address ? ' <a class="map-link" href="https://maps.google.com/?q=' + encodeURIComponent(stay.address) + '" target="_blank" rel="noopener">↗ Map</a>' : ''}</td>
            </tr>
            <tr><td class="st-label">👥 Guests</td><td>${esc(stay.guests) || '—'}</td></tr>
            <tr><td class="st-label">🔖 Confirmation</td><td><code class="conf-code">${esc(stay.confirmation) || '—'}</code></td></tr>
            <tr><td class="st-label">🏷 Platform</td><td>${esc(stay.platform)}</td></tr>
            ${stay.cost
              ? '<tr class="cost-row"><td class="st-label">💰 Total Cost</td><td><strong class="cost-amount">' + costDisplay + '</strong>' + (perNight ? ' <span class="per-night">(' + perNight + ')</span>' : '') + ' <button class="btn-edit-cost" data-id="' + stay.id + '" title="Edit cost">✏️</button></td></tr>'
              : '<tr class="cost-row"><td class="st-label">💰 Total Cost</td><td><span class="cost-missing">Not set — </span><button class="btn-edit-cost" data-id="' + stay.id + '">➕ Add cost</button></td></tr>'
            }
          </tbody></table>
        </div>

        <!-- Col 3: Days -->
        <div class="stay-days-col">
          <div class="stay-days-header">Your Days</div>
          <div class="stay-days-body">
            ${dayRows}
          </div>
        </div>

      </div>
    </div>`;
  }

  // ── Build day rows for back of card ─────────────────────────
  function buildDayRows(stay, nights) {
    if (!stay.checkIn) return '<p class="no-data" style="padding:1.5rem 2rem;">Set your check-in date to see your days.</p>';
    const startDate = parseCheckInDate(stay.checkIn);
    if (!startDate) return '<p class="no-data" style="padding:1.5rem 2rem;">Could not parse check-in date.</p>';

    const totalDays = Math.max(Math.round(nights) + 1, 2);
    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MON_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const events    = stay.dayEvents || {};  // { "2026-08-24": [{type, label, time, note}] }

    return Array.from({ length: totalDays }, (_, i) => {
      const d      = new Date(startDate);
      d.setDate(d.getDate() + i);
      const isIn   = i === 0;
      const isOut  = i === totalDays - 1;
      const dateKey = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const dayEvts = events[dateKey] || [];

      const eventTags = dayEvts.map((ev, ei) => `
        <span class="day-tag day-tag-${ev.type || 'custom'}">
          ${ev.emoji || '📌'} ${esc(ev.label)}${ev.time ? ' <span class="day-tag-time">· ' + esc(ev.time) + '</span>' : ''}
          <button class="btn-edit-day-event" data-stayid="${stay.id}" data-date="${dateKey}" data-idx="${ei}" title="Edit">✏️</button>
          <button class="btn-delete-day-event" data-stayid="${stay.id}" data-date="${dateKey}" data-idx="${ei}" title="Remove">✕</button>
        </span>`).join('');

      return `
        <div class="back-day-row">
          <div class="back-day-label">
            <span class="back-day-name">${DAY_NAMES[d.getDay()]}</span>
            <span class="back-day-date">${MON_NAMES[d.getMonth()]} ${d.getDate()}</span>
          </div>
          <div class="back-day-events">
            ${isIn  ? '<span class="day-tag day-tag-checkin">🏡 Check-in' + (stay.checkInTime  ? ' at ' + esc(stay.checkInTime)  : '') + '</span>' : ''}
            ${isOut ? '<span class="day-tag day-tag-checkout">🧳 Check-out' + (stay.checkOutTime ? ' at ' + esc(stay.checkOutTime) : '') + '</span>' : ''}
            ${eventTags}
            <button class="btn-add-day-event day-tag-add" data-stayid="${stay.id}" data-date="${dateKey}" title="Add event">＋ Add</button>
          </div>
        </div>`;
    }).join('');
  }

  function parseCheckInDate(str) {
    if (!str) return null;
    const clean = str.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/i, '') + ' 2026';
    const d = new Date(clean);
    return isNaN(d) ? null : d;
  }

  // ── Helpers ──────────────────────────────────────────────────
  function calcNights(inStr, outStr) {
    if (!inStr || !outStr) return 0;
    const clean = s => s.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/i, '') + ', 2026';
    try { const diff = (new Date(clean(outStr)) - new Date(clean(inStr))) / 86400000; return (!isNaN(diff) && diff > 0) ? diff : 0; }
    catch { return 0; }
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Migrations ───────────────────────────────────────────────
  async function runMigrations() {
    const all = await TripDB.getAll(STORE);
    for (const stay of all) {
      let dirty = false;

      // Fix: restore the Rome Airbnb (Aug 24) back to Rome
      // Identified by confirmation 2519510602 AND checkIn Aug 24
      if (stay.confirmation === '2519510602' && /Aug\s*24/i.test(stay.checkIn) && stay.city !== 'Rome') {
        stay.city          = 'Rome';
        stay.propertyTitle = 'Home in Rome';
        stay.host          = 'Bianca';
        stay.address       = 'Via Francesco Crispi, 20, Rome, Lazio 00187, Italy';
        dirty = true;
      }

      // Fix: correct address for Hotel Villa Paradiso Taormina (Aug 31 check-in)
      if (/taormin/i.test(stay.city) && /Aug\s*31/i.test(stay.checkIn) && stay.address !== 'Via Roma 2, 98039 Taormina (ME), Italy') {
        stay.address = 'Via Roma 2, 98039 Taormina (ME), Italy';
        dirty = true;
      }

      if (dirty) await TripDB.update(STORE, stay);
    }
  }

});
