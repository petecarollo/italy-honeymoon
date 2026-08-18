// calendar.js — inline date + time picker
// Renders inside the stay card, directly after the clicked button.

const DatePicker = (() => {

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let _year, _month, _selectedDate, _resolve, _popup, _anchor;

  // ── Open ─────────────────────────────────────────────────────
  function open(anchorEl, currentDateStr, currentTimeStr) {
    // Remove any existing popup first
    closePopup();

    // Parse existing date — default to TODAY's month/year, not Jan
    let init = parseDate(currentDateStr);
    const now = new Date();
    _year  = init ? init.getFullYear() : now.getFullYear();
    _month = init ? init.getMonth()    : now.getMonth();
    _selectedDate = init || null;
    _anchor = anchorEl;

    // Build popup element
    _popup = document.createElement('div');
    _popup.className = 'dp-popup';
    _popup.innerHTML = `
      <div class="dp-header">
        <button class="dp-nav" id="dp-prev">‹</button>
        <span id="dp-month-label"></span>
        <button class="dp-nav" id="dp-next">›</button>
      </div>
      <div class="dp-grid" id="dp-grid"></div>
      <div class="dp-time-row">
        <label>Time <small>(optional)</small></label>
        <input type="time" id="dp-time" />
      </div>
      <div class="dp-footer">
        <button class="dp-btn-cancel">Cancel</button>
        <button class="dp-btn-ok">Set Date</button>
      </div>`;

    // Insert directly after the anchor button, inside the same table cell
    anchorEl.insertAdjacentElement('afterend', _popup);

    // Pre-fill time
    _popup.querySelector('#dp-time').value = timeStrTo24(currentTimeStr) || '';

    // Wire buttons
    _popup.querySelector('#dp-prev').addEventListener('click', e => { e.stopPropagation(); shift(-1); });
    _popup.querySelector('#dp-next').addEventListener('click', e => { e.stopPropagation(); shift(+1); });
    _popup.querySelector('.dp-btn-cancel').addEventListener('click', e => { e.stopPropagation(); closePopup(); _resolve && _resolve(null); });
    _popup.querySelector('.dp-btn-ok').addEventListener('click', e => { e.stopPropagation(); confirm(); });

    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', outsideClick);
    }, 0);

    renderMonth();

    return new Promise(res => { _resolve = res; });
  }

  function outsideClick(e) {
    if (_popup && !_popup.contains(e.target) && e.target !== _anchor) {
      closePopup();
      _resolve && _resolve(null);
    }
  }

  function closePopup() {
    if (_popup) {
      _popup.remove();
      _popup = null;
    }
    document.removeEventListener('click', outsideClick);
  }

  // ── Render calendar grid ──────────────────────────────────────
  function renderMonth() {
    _popup.querySelector('#dp-month-label').textContent = `${MONTHS[_month]} ${_year}`;

    const grid = _popup.querySelector('#dp-grid');
    grid.innerHTML = '';

    DAYS.forEach(d => {
      const h = document.createElement('div');
      h.className = 'dp-day-hdr';
      h.textContent = d;
      grid.appendChild(h);
    });

    const firstDay    = new Date(_year, _month, 1).getDay();
    const daysInMonth = new Date(_year, _month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'dp-cell dp-blank';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell  = document.createElement('button');
      cell.className  = 'dp-cell dp-date';
      cell.textContent = d;
      cell.type = 'button';

      if (_selectedDate && sameDay(new Date(_year, _month, d), _selectedDate)) {
        cell.classList.add('dp-selected');
      }

      cell.addEventListener('click', e => {
        e.stopPropagation();
        _selectedDate = new Date(_year, _month, d);
        renderMonth();
      });
      grid.appendChild(cell);
    }
  }

  function shift(dir) {
    _month += dir;
    if (_month > 11) { _month = 0;  _year++; }
    if (_month < 0)  { _month = 11; _year--; }
    renderMonth();
  }

  function confirm() {
    if (!_selectedDate) { closePopup(); _resolve && _resolve(null); return; }

    const dateStr = formatDate(_selectedDate);
    const raw24   = _popup.querySelector('#dp-time').value;
    const timeStr = raw24 ? time24to12(raw24) : '';

    closePopup();
    _resolve && _resolve({ dateStr, timeStr });
  }

  // ── Helpers ──────────────────────────────────────────────────
  function parseDate(str) {
    if (!str) return null;
    const withYear = str.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/i, '');
    // Add year if missing
    const hasYear = /\d{4}/.test(withYear);
    const d = new Date(hasYear ? withYear : withYear + ' 2026');
    return isValidDate(d) ? d : null;
  }

  function isValidDate(d) { return d instanceof Date && !isNaN(d); }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  function formatDate(d) {
    const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }

  function timeStrTo24(str) {
    if (!str) return '';
    const m = str.match(/(\d{1,2}):(\d{2})\s*([APap][Mm])/);
    if (!m) return '';
    let h = parseInt(m[1]);
    const min = m[2], ap = m[3].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${min}`;
  }

  function time24to12(str) {
    const [hStr, min] = str.split(':');
    let h = parseInt(hStr);
    const ap = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${min} ${ap}`;
  }

  return { open };
})();
