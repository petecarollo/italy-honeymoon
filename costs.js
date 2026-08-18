// costs.js — city × category cost matrix

document.addEventListener('DOMContentLoaded', async () => {

  await TripDB.open();

  // ── Config — defined first so all functions can use them ─────
  const SOURCES = [
    { key: 'stays',     label: 'Stays',     icon: '🏡', cityField: 'city', costField: 'cost' },
    { key: 'transport', label: 'Transfers', icon: '✈️', cityField: 'from', costField: 'cost' },
  ];

  const TRIP_CITIES = ['Rome', 'Positano', 'Taormina', 'Florence'];

  const CAT_CONFIG = {
    'Stays':       { icon: '🏡', color: '#8b5e3c' },
    'Transfers':   { icon: '✈️', color: '#4a6fa5' },
    'Shopping':    { icon: '🛍', color: '#27ae60' },
    'Insurance':   { icon: '🔒', color: '#7f8c8d' },
    'Other':       { icon: '📌', color: '#555'    },
  };

  // ── Helpers ──────────────────────────────────────────────────
  function mapCity(raw) {
    if (!raw) return 'General';
    const c = raw.trim();
    if (/^rom/i.test(c) || /rome|roma/i.test(c))                     return 'Rome';
    if (/positano|amalfi|sorrento|naples|napoli/i.test(c))           return 'Positano';
    if (/taormin|sicil|catania|palermo/i.test(c))                    return 'Taormina';
    if (/florence|firenze/i.test(c))                                  return 'Florence';
    for (const city of TRIP_CITIES) {
      if (c.toLowerCase() === city.toLowerCase()) return city;
    }
    return 'General';
  }

  function orderCategories(cats) {
    const preferred = ['Stays','Transfers','Shopping','Insurance','Other'];
    return [
      ...preferred.filter(c => cats.includes(c)),
      ...cats.filter(c => !preferred.includes(c)),
    ];
  }

  function fmt(n) {
    if (!n || isNaN(n)) return '—';
    return '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function calcNights(inStr, outStr) {
    if (!inStr || !outStr) return 0;
    const clean = s => s.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/i, '') + ', 2026';
    try {
      const diff = (new Date(clean(outStr)) - new Date(clean(inStr))) / 86400000;
      return (!isNaN(diff) && diff > 0) ? Math.round(diff) : 0;
    } catch { return 0; }
  }

  function sortByDate(arr, field) {
    return [...arr].sort((a, b) => {
      const d = s => {
        if (!s) return Infinity;
        const dt = new Date(s.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s*/i, '') + ' 2026');
        return isNaN(dt) ? Infinity : dt.getTime();
      };
      return d(a[field]) - d(b[field]);
    });
  }

  // ── Manual entry button ──────────────────────────────────────
  document.getElementById('add-manual-btn').addEventListener('click', async () => {
    const cat    = document.getElementById('m-category').value;
    const desc   = document.getElementById('m-description').value.trim();
    const city   = document.getElementById('m-city').value.trim();
    const amt    = parseFloat(document.getElementById('m-amount').value);
    const status = document.getElementById('manual-status');
    if (!desc || isNaN(amt) || amt <= 0) {
      status.textContent = '⚠️ Enter a description and valid amount.';
      setTimeout(() => status.textContent = '', 3000);
      return;
    }
    await TripDB.add('costs-manual', { category: cat, description: desc, city: city || 'General', cost: amt.toFixed(2) });
    await render();
    document.getElementById('m-description').value = '';
    document.getElementById('m-city').value        = '';
    document.getElementById('m-amount').value      = '';
    status.textContent = '✅ Added!';
    setTimeout(() => status.textContent = '', 2500);
  });

  document.addEventListener('click', async e => {
    if (!e.target.classList.contains('btn-delete-cost')) return;
    await TripDB.remove('costs-manual', parseInt(e.target.dataset.id));
    await render();
  });

  // ── Build matrix ─────────────────────────────────────────────
  async function buildMatrix() {
    const matrix = {};
    const catSet = new Set();
    TRIP_CITIES.forEach(c => { matrix[c] = {}; });

    for (const src of SOURCES) {
      let records = [];
      try { records = await TripDB.getAll(src.key); } catch {}
      for (const r of records) {
        const cost = parseFloat(r[src.costField] || 0);
        if (!cost || cost <= 0) continue;
        const city = mapCity(r[src.cityField]);
        catSet.add(src.label);
        if (!matrix[city]) matrix[city] = {};
        matrix[city][src.label] = (matrix[city][src.label] || 0) + cost;
      }
    }

    let manuals = [];
    try { manuals = await TripDB.getAll('costs-manual'); } catch {}
    for (const m of manuals) {
      const cost = parseFloat(m.cost || 0);
      if (!cost || cost <= 0) continue;
      const city = mapCity(m.city);
      const cat  = m.category || 'Other';
      catSet.add(cat);
      if (!matrix[city]) matrix[city] = {};
      matrix[city][cat] = (matrix[city][cat] || 0) + cost;
    }

    const cities = [...TRIP_CITIES];
    if (matrix['General'] && Object.keys(matrix['General']).length) cities.push('General');

    return { matrix, cities, categories: orderCategories([...catSet]) };
  }

  // ── Grand total ───────────────────────────────────────────────
  function renderGrandTotal({ matrix, cities, categories }) {
    const banner = document.getElementById('grand-total-banner');
    const total  = cities.reduce((s, city) => s + categories.reduce((s2, cat) => s2 + (matrix[city]?.[cat] || 0), 0), 0);
    if (!total) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    banner.innerHTML = '<div class="grand-label">🇮🇹 Total Trip Cost</div><div class="grand-amount">' + fmt(total) + '</div>';
  }

  // ── Matrix table ─────────────────────────────────────────────
  function renderMatrix({ matrix, cities, categories }) {
    const wrap = document.getElementById('cost-matrix-wrap');
    if (!categories.length) {
      wrap.innerHTML = '<p class="no-data">No cost data yet.</p>';
      return;
    }

    const cityTotals = {};
    cities.forEach(city => { cityTotals[city] = categories.reduce((s, cat) => s + (matrix[city]?.[cat] || 0), 0); });
    const catTotals  = {};
    categories.forEach(cat => { catTotals[cat] = cities.reduce((s, city) => s + (matrix[city]?.[cat] || 0), 0); });
    const grandTotal = cities.reduce((s, city) => s + cityTotals[city], 0);

    wrap.innerHTML = `
      <table class="data-table cost-matrix">
        <thead><tr>
          <th class="cm-label-col">Category</th>
          ${cities.map(c => '<th class="cm-city-col">' + c + '</th>').join('')}
          <th class="cm-total-col">Total</th>
        </tr></thead>
        <tbody>
          ${categories.map(cat => {
            const cfg = CAT_CONFIG[cat] || { icon: '📌', color: '#555' };
            return '<tr>' +
              '<td class="cm-cat-label" style="border-left:4px solid ' + cfg.color + '">' + cfg.icon + ' ' + cat + '</td>' +
              cities.map(city => {
                const v = matrix[city]?.[cat] || 0;
                return v > 0 ? '<td class="cm-cell cm-has-value">' + fmt(v) + '</td>' : '<td class="cm-cell cm-empty">—</td>';
              }).join('') +
              '<td class="cm-cell cm-row-total">' + (catTotals[cat] > 0 ? fmt(catTotals[cat]) : '—') + '</td>' +
            '</tr>';
          }).join('')}
        </tbody>
        <tfoot><tr class="cm-col-total-row">
          <td class="cm-cat-label"><strong>City Total</strong></td>
          ${cities.map(c => '<td class="cm-cell cm-col-total">' + (cityTotals[c] > 0 ? fmt(cityTotals[c]) : '—') + '</td>').join('')}
          <td class="cm-cell cm-grand-total">${fmt(grandTotal)}</td>
        </tr></tfoot>
      </table>`;
  }

  // ── Transfers detail ─────────────────────────────────────────
  async function renderTransfersDetail() {
    const section  = document.getElementById('transfers-cost-section');
    const wrap     = document.getElementById('transfers-cost-wrap');
    const all      = await TripDB.getAll('transport');
    const withCost = sortByDate(all.filter(t => parseFloat(t.cost) > 0), 'date');
    if (!withCost.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    const total = withCost.reduce((s, t) => s + parseFloat(t.cost), 0);
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Type</th><th>Route</th><th>Carrier</th><th>Date</th><th>Confirmation</th><th>Class</th><th style="text-align:right">Cost</th></tr></thead>
        <tbody>${withCost.map(t => `
          <tr>
            <td><span class="tag">${esc(t.type||'Flight')}</span></td>
            <td>${t.from&&t.to ? '<strong>'+esc(t.from)+'</strong> → <strong>'+esc(t.to)+'</strong>' : esc(t.from||t.to||'—')}</td>
            <td>${esc(t.carrier)||'—'}${t.flightNo?' <code class="conf-code">'+esc(t.flightNo)+'</code>':''}</td>
            <td>${esc(t.date)||'—'}${t.departTime?' · '+esc(t.departTime):''}</td>
            <td>${t.confirmation?'<code class="conf-code">'+esc(t.confirmation)+'</code>':'—'}</td>
            <td>${esc(t.seatClass)||'—'}</td>
            <td style="text-align:right"><strong class="cost-amount">${fmt(parseFloat(t.cost))}</strong></td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr class="cm-col-total-row">
          <td colspan="6"><strong>Total Transfers</strong></td>
          <td style="text-align:right" class="cm-grand-total"><strong>${fmt(total)}</strong></td>
        </tr></tfoot>
      </table>`;
  }

  // ── Stays detail ─────────────────────────────────────────────
  async function renderStaysDetail() {
    const section  = document.getElementById('stays-cost-section');
    const wrap     = document.getElementById('stays-cost-wrap');
    const all      = await TripDB.getAll('stays');
    const withCost = sortByDate(all.filter(s => parseFloat(s.cost) > 0), 'checkIn');
    if (!withCost.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    const total = withCost.reduce((s, st) => s + parseFloat(st.cost), 0);
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Property</th><th>City</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Confirmation</th><th style="text-align:right">Cost</th></tr></thead>
        <tbody>${withCost.map(s => {
          const n = calcNights(s.checkIn, s.checkOut);
          const pn = n > 0 ? ' <span class="per-night">('+fmt(parseFloat(s.cost)/n)+'/night)</span>' : '';
          return `<tr>
            <td><strong>${esc(s.propertyTitle)}</strong></td>
            <td>${esc(s.city)||'—'}</td>
            <td>${esc(s.checkIn)||'—'}</td>
            <td>${esc(s.checkOut)||'—'}</td>
            <td>${n||'—'}</td>
            <td>${s.confirmation?'<code class="conf-code">'+esc(s.confirmation)+'</code>':'—'}</td>
            <td style="text-align:right"><strong class="cost-amount">${fmt(parseFloat(s.cost))}</strong>${pn}</td>
          </tr>`;
        }).join('')}
        </tbody>
        <tfoot><tr class="cm-col-total-row">
          <td colspan="6"><strong>Total Stays</strong></td>
          <td style="text-align:right" class="cm-grand-total"><strong>${fmt(total)}</strong></td>
        </tr></tfoot>
      </table>`;
  }

  // ── Manual entries list ───────────────────────────────────────
  async function renderManualEntries() {
    const section = document.getElementById('manual-entries-section');
    const wrap    = document.getElementById('manual-entries-wrap');
    let entries   = [];
    try { entries = await TripDB.getAll('costs-manual'); } catch {}
    if (!entries.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Category</th><th>Description</th><th>City</th><th>Amount</th><th></th></tr></thead>
        <tbody>${entries.map(e => `
          <tr>
            <td>${esc(e.category)}</td>
            <td>${esc(e.description)}</td>
            <td>${esc(e.city||'—')}</td>
            <td><strong>${fmt(parseFloat(e.cost))}</strong></td>
            <td><button class="btn-delete btn-delete-cost" data-id="${e.id}">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ── Main render ──────────────────────────────────────────────
  async function render() {
    const matrix = await buildMatrix();
    renderGrandTotal(matrix);
    renderMatrix(matrix);
    await renderTransfersDetail();
    await renderStaysDetail();
    await renderManualEntries();
  }

  await render();

});
