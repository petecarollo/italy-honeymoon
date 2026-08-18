// overview.js — itinerary stored in IndexedDB

document.addEventListener('DOMContentLoaded', async () => {

  const input     = document.getElementById('itinerary-input');
  const saveBtn   = document.getElementById('save-itinerary-btn');
  const clearBtn  = document.getElementById('clear-itinerary-btn');
  const statusEl  = document.getElementById('itinerary-save-status');
  const display   = document.getElementById('itinerary-display');
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const ocrStatus = document.getElementById('ocr-status');

  const STORE = 'itinerary';

  await TripDB.open();

  // ── Load saved itinerary ──────────────────────────────────────
  const saved = await TripDB.getAll(STORE);
  if (saved.length && saved[0].text) {
    input.value = saved[0].text;
    renderItinerary(saved[0].text);
  }

  // ── Save ──────────────────────────────────────────────────────
  saveBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) { statusEl.textContent = '⚠️ Nothing to save.'; return; }

    await TripDB.replaceAll(STORE, [{ text }]);
    statusEl.textContent = '✅ Itinerary saved!';
    renderItinerary(text);
    setTimeout(() => statusEl.textContent = '', 3000);
  });

  // ── Clear ─────────────────────────────────────────────────────
  clearBtn.addEventListener('click', async () => {
    if (!confirm('Clear the saved itinerary?')) return;
    await TripDB.clearStore(STORE);
    input.value = '';
    display.innerHTML = '<p class="no-data">No itinerary saved yet — paste or upload one above.</p>';
    statusEl.textContent = 'Cleared.';
    setTimeout(() => statusEl.textContent = '', 2000);
  });

  // ── Drop zone ─────────────────────────────────────────────────
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

  async function processFile(file) {
    ocrStatus.textContent = '⏳ Loading…';
    try {
      const { text } = await FileTextReader.extract(file, msg => {
        ocrStatus.textContent = msg;
      });
      ocrStatus.textContent = '✅ Text extracted — review and click Save.';
      input.value = text;
      input.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      ocrStatus.textContent = '❌ Could not read file: ' + err.message;
    }
  }

  // ── Render itinerary timeline ─────────────────────────────────
  function renderItinerary(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const days  = [];
    let current = null;

    const dayPattern = /^(day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\w+\s+\d{1,2}(st|nd|rd|th)?[,\s])/i;

    lines.forEach(line => {
      if (dayPattern.test(line)) {
        if (current) days.push(current);
        current = { title: line, items: [] };
      } else if (current) {
        current.items.push(line);
      } else {
        if (!days.length) { current = { title: '📌 Overview', items: [] }; }
        if (current) current.items.push(line);
      }
    });
    if (current) days.push(current);

    if (!days.length) {
      display.innerHTML = `<pre class="raw-text" style="display:block">${escHtml(text)}</pre>`;
      return;
    }

    display.innerHTML = `<div class="timeline itinerary-timeline">
      ${days.map(day => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <h3>${escHtml(day.title)}</h3>
            <ul class="itinerary-items">
              ${day.items.map(item => `<li>${escHtml(item)}</li>`).join('')}
            </ul>
          </div>
        </div>`).join('')}
    </div>`;
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

});
