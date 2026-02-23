'use strict';

// =============================================
// TRAVEL ASSIST — app.js v2
// =============================================

let tripData = {
  city: '', departureDate: '', departureTime: '',
  returnDate: '', returnTime: '', transport: '',
  hotelAddress: '', hotelMaps: '',
  days: [], globalTickets: [],
  transportTickets: { andata: null, ritorno: null }
};

let currentPosition = null;
let dropdownTarget = null; // quale input slot sta usando il dropdown
let dropdownDayIdx = null;
let dropdownSlotIdx = null;
let searchTimeout = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  registerSW();
  loadData();
  createToastContainer();

  // Default date = oggi
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0,5);
  safeSet('departure-date', today);
  safeSet('departure-time', now);
  safeSet('return-date', today);
  safeSet('return-time', now);

  document.getElementById('setup-form').addEventListener('submit', handleSetup);

  if (tripData.city) {
    renderDashboard();
    showSection('dashboard');
  } else {
    showSection('setup');
  }

  // Chiudi dropdown cliccando fuori
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('places-dropdown');
    if (!dd.contains(e.target) && e.target.id !== 'place-input-' + dropdownDayIdx + '-' + dropdownSlotIdx) {
      closeDropdown();
    }
  });
});

function safeSet(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ---- SERVICE WORKER ----
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ---- STORAGE ----
function saveData() {
  try { localStorage.setItem('travelAssist_v2', JSON.stringify(tripData)); } catch(e) {}
}
function loadData() {
  try {
    const s = localStorage.getItem('travelAssist_v2');
    if (s) tripData = { ...tripData, ...JSON.parse(s) };
  } catch(e) {}
}

// ---- SEZIONI ----
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-' + name)?.classList.remove('hidden');
  announce('Sezione ' + name);
}

// ---- SETUP ----
function handleSetup(e) {
  e.preventDefault();
  const f = e.target;
  const city = f.city.value.trim();
  if (!city) { showToast('Inserisci la città di destinazione', 'error'); f.city.focus(); return; }

  tripData.city          = city;
  tripData.departureDate = f['departure-date'].value;
  tripData.departureTime = f['departure-time'].value;
  tripData.returnDate    = f['return-date'].value;
  tripData.returnTime    = f['return-time'].value;
  tripData.transport     = f.transport.value;
  tripData.hotelAddress  = f['hotel-address'].value.trim();
  tripData.hotelMaps     = f['hotel-maps'].value.trim();
  tripData.days          = generateDays(tripData.departureDate, tripData.returnDate);

  saveData();
  renderDashboard();
  showSection('dashboard');
  announce('Viaggio configurato');
}

// ---- GIORNI ----
function generateDays(start, end) {
  if (!start || !end) return [];
  const days = [];
  // Parse as local date (split by '-') to avoid UTC shift
  const parseParts = s => s.split('-').map(Number);
  const [sy, sm, sd] = parseParts(start);
  const [ey, em, ed] = parseParts(end);
  let cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  let n = 1;
  while (cur <= last) {
    const dateStr = cur.getFullYear() + '-' +
      String(cur.getMonth() + 1).padStart(2, '0') + '-' +
      String(cur.getDate()).padStart(2, '0');
    days.push({ id: 'day' + n, date: dateStr, slots: [], tickets: [] });
    cur.setDate(cur.getDate() + 1);
    n++;
  }
  return days;
}

function addDay() {
  const last = tripData.days[tripData.days.length - 1];
  let nextDateStr;
  if (last) {
    // Incrementa la data dell'ultimo giorno senza usare toISOString (evita sfasamento UTC)
    const parts = last.date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1);
    nextDateStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  } else {
    const today = new Date();
    nextDateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  }
  const d = { id: 'day' + (tripData.days.length + 1), date: nextDateStr, slots: [], tickets: [] };
  tripData.days.push(d);
  saveData();
  const container = document.getElementById('days-list');
  const el = createDayCard(d, tripData.days.length - 1);
  container.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  announce('Giorno aggiunto');
}

function formatDate(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' });
}
function isToday(s) { return s === new Date().toISOString().split('T')[0]; }

// ---- DASHBOARD ----
function renderDashboard() {
  setText('display-city', tripData.city || '—');
  setText('display-departure', tripData.departureDate ? formatDate(tripData.departureDate) + ' ' + tripData.departureTime : '—');
  setText('display-return', tripData.returnDate ? formatDate(tripData.returnDate) + ' ' + tripData.returnTime : '—');

  // Icona e label mezzo di trasporto
  const icons = { autobus:'🚌', auto:'🚗', treno:'🚂', aereo:'✈️' };
  const labels = { autobus:'Biglietti Autobus', auto:'Biglietti Auto', treno:'Biglietti Treno', aereo:'Biglietti Aereo' };
  setText('transport-icon-display', icons[tripData.transport] || '🚆');
  setText('display-transport-label', labels[tripData.transport] || 'Biglietti Trasporto');

  renderTransportTickets();
  renderDaysList();
  renderGlobalTickets();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ---- BIGLIETTI TRASPORTO ----
function renderTransportTickets() {
  ['andata', 'ritorno'].forEach(dir => {
    const ticket = tripData.transportTickets?.[dir];
    const display = document.getElementById('ticket-' + dir + '-display');
    if (!display) return;
    const slot = display.closest('.transport-ticket-slot');
    const zone = slot ? slot.querySelector('.pocket-upload-zone') : null;
    const input = document.getElementById('input-' + dir);
    display.innerHTML = '';
    if (ticket) {
      display.appendChild(buildTransportTicketEl(ticket, dir));
      if (zone) zone.classList.add('hidden');
    } else {
      if (zone) zone.classList.remove('hidden');
      if (input) input.value = '';
    }
  });
}

function buildTransportTicketEl(ticket, dir) {
  const el = document.createElement('div');
  el.className = 'transport-ticket-item';
  const isPdf = ticket.type === 'application/pdf';
  el.innerHTML = `
    <span style="font-size:1.375rem">${isPdf ? '📄' : '🖼'}</span>
    <span class="transport-ticket-name">${esc(ticket.name)}</span>
    <button class="transport-ticket-view" aria-label="Visualizza biglietto ${dir}">Apri</button>
    <button class="transport-ticket-del" aria-label="Elimina biglietto ${dir}">🗑</button>
  `;
  el.querySelector('.transport-ticket-view').addEventListener('click', () => openViewerFromTicket(ticket));
  el.querySelector('.transport-ticket-del').addEventListener('click', () => deleteTransportTicket(dir));
  return el;
}

function handleTransportTicket(event, dir) {
  const file = event.target.files[0];
  if (!file) return;
  readFile(file, ticket => {
    if (!tripData.transportTickets) tripData.transportTickets = {};
    tripData.transportTickets[dir] = ticket;
    saveData();
    const display = document.getElementById('ticket-' + dir + '-display');
    if (display) { display.innerHTML = ''; display.appendChild(buildTransportTicketEl(ticket, dir)); }
    // Hide the upload zone
    const slot = display ? display.closest('.transport-ticket-slot') : null;
    if (slot) {
      const zone = slot.querySelector('.pocket-upload-zone');
      if (zone) zone.classList.add('hidden');
    }
    // Also reset file input so same file can be re-uploaded
    event.target.value = '';
    showToast('Biglietto ' + dir + ' caricato ✓', 'success');
    announce('Biglietto ' + dir + ' caricato');
  });
}

function deleteTransportTicket(dir) {
  tripData.transportTickets[dir] = null;
  saveData();
  const display = document.getElementById('ticket-' + dir + '-display');
  if (display) display.innerHTML = '';
  // Show upload zone via closest slot container
  if (display) {
    const slot = display.closest('.transport-ticket-slot');
    if (slot) {
      const zone = slot.querySelector('.pocket-upload-zone');
      if (zone) zone.classList.remove('hidden');
    }
  }
  // Reset file input
  const input = document.getElementById('input-' + dir);
  if (input) input.value = '';
  showToast('Biglietto eliminato', 'info');
}

// ---- LISTA GIORNI ----
function renderDaysList() {
  const container = document.getElementById('days-list');
  container.innerHTML = '';
  if (!tripData.days.length) {
    container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:2rem;font-size:var(--text-base)">Nessun giorno configurato</p>';
    return;
  }
  tripData.days.forEach((day, idx) => {
    const el = createDayCard(day, idx);
    container.appendChild(el);
    if (isToday(day.date)) { el.classList.add('expanded', 'is-today'); el.querySelector('.day-header').setAttribute('aria-expanded', 'true'); }
  });
}

function createDayCard(day, idx) {
  const card = document.createElement('article');
  card.className = 'day-card';
  card.id = 'card-' + day.id;

  const header = document.createElement('button');
  header.className = 'day-header';
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-controls', 'body-' + day.id);
  header.setAttribute('aria-label', 'Giorno ' + (idx+1) + ': ' + formatDate(day.date));
  header.innerHTML = `
    <div class="day-header-left">
      <span class="day-number">${String(idx+1).padStart(2,'0')}</span>
      <div class="day-info">
        <span class="day-date">${formatDate(day.date)}</span>
        <span class="day-label">${isToday(day.date) ? '📍 Oggi' : 'Giorno ' + (idx+1)}</span>
      </div>
    </div>
    <span class="day-toggle" aria-hidden="true">▼</span>
  `;
  header.addEventListener('click', () => {
    const exp = card.classList.toggle('expanded');
    header.setAttribute('aria-expanded', String(exp));
  });

  const body = document.createElement('div');
  body.className = 'day-body';
  body.id = 'body-' + day.id;
  body.setAttribute('role', 'region');

  // Sezione tappe
  const slotsSec = document.createElement('div');
  slotsSec.innerHTML = '<div class="slots-section-title">📍 Tappe del giorno</div>';
  const slotsList = document.createElement('div');
  slotsList.className = 'slots-list';
  slotsList.id = 'slots-' + day.id;
  (day.slots || []).forEach((slot, si) => slotsList.appendChild(createSlotItem(day, idx, slot, si)));

  const addBtn = document.createElement('button');
  addBtn.className = 'btn--add-slot';
  addBtn.textContent = '+ Aggiungi Tappa';
  addBtn.addEventListener('click', () => addSlot(idx));
  slotsSec.appendChild(slotsList);
  slotsSec.appendChild(addBtn);

  // Tasca biglietti giornalieri
  const pocket = createDayTicketPocket(day, idx);

  body.appendChild(slotsSec);
  body.appendChild(pocket);
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

// ---- SLOT (TAPPA) ----
function createSlotItem(day, dayIdx, slot, slotIdx) {
  const item = document.createElement('div');
  item.className = 'slot-item';
  item.id = 'slot-' + day.id + '-' + slotIdx;

  item.innerHTML = `
    <div class="slot-row">
      <div class="slot-time">
        <label class="sr-only" for="time-${day.id}-${slotIdx}">Orario</label>
        <input type="time" class="slot-input" id="time-${day.id}-${slotIdx}"
          value="${slot.time || ''}" aria-label="Orario tappa ${slotIdx+1}" />
      </div>
      <div class="slot-place">
        <label class="sr-only" for="place-input-${dayIdx}-${slotIdx}">Luogo</label>
        <input type="text" class="slot-input" id="place-input-${dayIdx}-${slotIdx}"
          value="${esc(slot.place || '')}"
          placeholder="Luogo... (es. Colosseo)"
          aria-label="Luogo tappa ${slotIdx+1}"
          autocomplete="off" />
      </div>
    </div>
    <div class="slot-maps-row">
      <input type="url" class="slot-input slot-maps-input" id="maps-input-${dayIdx}-${slotIdx}"
        value="${esc(slot.mapsLink || '')}"
        placeholder="Link Google Maps (incolla o cerca sopra)"
        aria-label="Link Google Maps tappa ${slotIdx+1}" />
      <button class="btn--maps-search" type="button"
        aria-label="Cerca su Google Maps"
        onclick="searchOnMaps(${dayIdx},${slotIdx})">🔍 Maps</button>
    </div>
    <div class="slot-actions">
      <a href="${slot.mapsLink || '#'}" target="_blank" rel="noopener noreferrer"
        class="btn--go" id="go-${dayIdx}-${slotIdx}"
        aria-label="Portami a ${slot.place || 'questa tappa'}"
        ${!slot.mapsLink ? 'style="opacity:0.45;pointer-events:none"' : ''}>
        🧭 Portami Lì
      </a>
      <button class="btn--save-slot" type="button"
        aria-label="Salva tappa"
        id="save-slot-${dayIdx}-${slotIdx}"
        onclick="saveSlotDone(${dayIdx},${slotIdx})">✓ Fatto</button>
      <button class="btn--remove-slot" type="button"
        aria-label="Rimuovi tappa"
        onclick="removeSlot(${dayIdx},${slotIdx})">✕ Rimuovi</button>
    </div>
  `;

  // Salvataggio in tempo reale
  const timeInput  = item.querySelector('#time-' + day.id + '-' + slotIdx);
  const placeInput = item.querySelector('#place-input-' + dayIdx + '-' + slotIdx);
  const mapsInput  = item.querySelector('#maps-input-' + dayIdx + '-' + slotIdx);

  timeInput.addEventListener('change', () => {
    tripData.days[dayIdx].slots[slotIdx].time = timeInput.value;
    saveData();
  });

  placeInput.addEventListener('input', () => {
    tripData.days[dayIdx].slots[slotIdx].place = placeInput.value;
    saveData();
    handlePlaceInput(placeInput, dayIdx, slotIdx);
  });

  placeInput.addEventListener('keydown', (e) => {
    const dd = document.getElementById('places-dropdown');
    if (dd.classList.contains('hidden')) return;
    const items = dd.querySelectorAll('.place-option');
    if (e.key === 'ArrowDown') { e.preventDefault(); items[0]?.focus(); }
    if (e.key === 'Escape') closeDropdown();
  });

  mapsInput.addEventListener('change', () => {
    const val = mapsInput.value.trim();
    tripData.days[dayIdx].slots[slotIdx].mapsLink = val;
    saveData();
    updateGoBtn(dayIdx, slotIdx, val, placeInput.value);
  });

  return item;
}

// ---- AUTOCOMPLETE LUOGHI ----
function handlePlaceInput(inputEl, dayIdx, slotIdx) {
  clearTimeout(searchTimeout);
  const q = inputEl.value.trim();
  if (q.length < 2) { closeDropdown(); return; }

  dropdownDayIdx = dayIdx;
  dropdownSlotIdx = slotIdx;

  showDropdownLoading(inputEl);

  searchTimeout = setTimeout(() => {
    fetchPlaces(q, dayIdx, slotIdx, inputEl);
  }, 400);
}

function showDropdownLoading(inputEl) {
  const dd = document.getElementById('places-dropdown');
  dd.innerHTML = '<div class="place-option-loading"><span>⏳</span> Ricerca in corso...</div>';
  positionDropdown(inputEl);
  dd.classList.remove('hidden');
}

function fetchPlaces(query, dayIdx, slotIdx, inputEl) {
  // Usa Nominatim (OpenStreetMap) — gratuito, nessuna chiave API
  const city = tripData.city || '';
  const search = city ? `${query}, ${city}` : query;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=5&accept-language=it`;

  fetch(url, { headers: { 'Accept-Language': 'it' } })
    .then(r => r.json())
    .then(results => renderDropdown(results, dayIdx, slotIdx, inputEl))
    .catch(() => {
      // Se offline, offri solo la ricerca diretta su Maps
      renderDropdownOffline(query, dayIdx, slotIdx, inputEl);
    });
}

function renderDropdown(results, dayIdx, slotIdx, inputEl) {
  const dd = document.getElementById('places-dropdown');
  dd.innerHTML = '';

  if (!results.length) {
    // Nessun risultato: offri ricerca su Maps
    dd.innerHTML = `
      <div class="place-option" tabindex="0" role="option"
        onclick="openMapsSearch('${esc(inputEl.value)}', ${dayIdx}, ${slotIdx})"
        onkeydown="if(event.key==='Enter')this.click()">
        <span class="place-option-icon">🗺</span>
        <div class="place-option-text">
          <span class="place-option-name">Cerca su Google Maps</span>
          <span class="place-option-detail">${esc(inputEl.value)}</span>
        </div>
      </div>`;
    positionDropdown(inputEl);
    dd.classList.remove('hidden');
    return;
  }

  results.forEach(place => {
    const name = place.display_name.split(',')[0];
    const detail = place.display_name.split(',').slice(1, 3).join(',').trim();
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.display_name)}&ll=${lat},${lng}`;

    const opt = document.createElement('div');
    opt.className = 'place-option';
    opt.setAttribute('role', 'option');
    opt.setAttribute('tabindex', '0');
    opt.setAttribute('aria-label', name + '. ' + detail);
    opt.innerHTML = `
      <span class="place-option-icon">📍</span>
      <div class="place-option-text">
        <span class="place-option-name">${esc(name)}</span>
        <span class="place-option-detail">${esc(detail)}</span>
      </div>
    `;
    opt.addEventListener('click', () => selectPlace(name, mapsLink, lat, lng, dayIdx, slotIdx, inputEl));
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') selectPlace(name, mapsLink, lat, lng, dayIdx, slotIdx, inputEl);
      if (e.key === 'ArrowDown') opt.nextElementSibling?.focus();
      if (e.key === 'ArrowUp') opt.previousElementSibling?.focus() || inputEl.focus();
      if (e.key === 'Escape') { closeDropdown(); inputEl.focus(); }
    });
    dd.appendChild(opt);
  });

  // Opzione: cerca su Maps manualmente
  const mapsOpt = document.createElement('div');
  mapsOpt.className = 'place-option';
  mapsOpt.setAttribute('tabindex', '0');
  mapsOpt.setAttribute('role', 'option');
  mapsOpt.innerHTML = `
    <span class="place-option-icon">🗺</span>
    <div class="place-option-text">
      <span class="place-option-name">Apri Google Maps per cercare</span>
      <span class="place-option-detail">${esc(inputEl.value)}</span>
    </div>
  `;
  mapsOpt.addEventListener('click', () => openMapsSearch(inputEl.value, dayIdx, slotIdx));
  mapsOpt.addEventListener('keydown', (e) => { if (e.key === 'Enter') openMapsSearch(inputEl.value, dayIdx, slotIdx); });
  dd.appendChild(mapsOpt);

  positionDropdown(inputEl);
  dd.classList.remove('hidden');
}

function renderDropdownOffline(query, dayIdx, slotIdx, inputEl) {
  const dd = document.getElementById('places-dropdown');
  dd.innerHTML = `
    <div class="place-option" tabindex="0" role="option"
      onclick="openMapsSearch('${esc(query)}', ${dayIdx}, ${slotIdx})"
      onkeydown="if(event.key==='Enter')this.click()">
      <span class="place-option-icon">🗺</span>
      <div class="place-option-text">
        <span class="place-option-name">Cerca su Google Maps</span>
        <span class="place-option-detail">${esc(query)}</span>
      </div>
    </div>`;
  positionDropdown(inputEl);
  dd.classList.remove('hidden');
}

function selectPlace(name, mapsLink, lat, lng, dayIdx, slotIdx, inputEl) {
  tripData.days[dayIdx].slots[slotIdx].place = name;
  tripData.days[dayIdx].slots[slotIdx].mapsLink = mapsLink;
  tripData.days[dayIdx].slots[slotIdx].lat = lat;
  tripData.days[dayIdx].slots[slotIdx].lng = lng;
  saveData();

  inputEl.value = name;
  const mapsInput = document.getElementById('maps-input-' + dayIdx + '-' + slotIdx);
  if (mapsInput) mapsInput.value = mapsLink;
  updateGoBtn(dayIdx, slotIdx, mapsLink, name);
  closeDropdown();
  announce(name + ' selezionato');
}

function openMapsSearch(query, dayIdx, slotIdx) {
  closeDropdown();
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  showToast('Copia il link da Maps e incollalo nel campo Link Maps', 'info');
}

function searchOnMaps(dayIdx, slotIdx) {
  const placeInput = document.getElementById('place-input-' + dayIdx + '-' + slotIdx);
  const q = placeInput?.value?.trim() || '';
  if (!q) { showToast('Scrivi prima un luogo', 'error'); return; }
  openMapsSearch(q, dayIdx, slotIdx);
}

function positionDropdown(inputEl) {
  const dd = document.getElementById('places-dropdown');
  const rect = inputEl.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  dd.style.width = Math.max(rect.width, 280) + 'px';
}

function closeDropdown() {
  const dd = document.getElementById('places-dropdown');
  if (dd) { dd.classList.add('hidden'); dd.innerHTML = ''; }
}

function updateGoBtn(dayIdx, slotIdx, mapsLink, placeName) {
  const btn = document.getElementById('go-' + dayIdx + '-' + slotIdx);
  if (!btn) return;
  if (mapsLink) {
    btn.href = mapsLink;
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
    btn.setAttribute('aria-label', 'Portami a ' + placeName);
  } else {
    btn.href = '#';
    btn.style.opacity = '0.45';
    btn.style.pointerEvents = 'none';
  }
}

// ---- GESTIONE SLOT ----
function addSlot(dayIdx) {
  if (!tripData.days[dayIdx].slots) tripData.days[dayIdx].slots = [];
  tripData.days[dayIdx].slots.push({ time: '', place: '', mapsLink: '' });
  saveData();
  const day = tripData.days[dayIdx];
  const si = day.slots.length - 1;
  const list = document.getElementById('slots-' + day.id);
  if (list) {
    const el = createSlotItem(day, dayIdx, day.slots[si], si);
    list.appendChild(el);
    setTimeout(() => el.querySelector('[type="time"]')?.focus(), 60);
  }
  announce('Tappa aggiunta');
}

function removeSlot(dayIdx, slotIdx) {
  tripData.days[dayIdx].slots.splice(slotIdx, 1);
  saveData();
  const day = tripData.days[dayIdx];
  const list = document.getElementById('slots-' + day.id);
  if (list) {
    list.innerHTML = '';
    day.slots.forEach((s, si) => list.appendChild(createSlotItem(day, dayIdx, s, si)));
  }
  announce('Tappa rimossa');
}

function saveSlotDone(dayIdx, slotIdx) {
  // Force-save the current field values (in case change events haven't fired)
  const day = tripData.days[dayIdx];
  const timeInput  = document.getElementById('time-' + day.id + '-' + slotIdx);
  const placeInput = document.getElementById('place-input-' + dayIdx + '-' + slotIdx);
  const mapsInput  = document.getElementById('maps-input-' + dayIdx + '-' + slotIdx);
  if (timeInput)  tripData.days[dayIdx].slots[slotIdx].time     = timeInput.value;
  if (placeInput) tripData.days[dayIdx].slots[slotIdx].place    = placeInput.value;
  if (mapsInput)  tripData.days[dayIdx].slots[slotIdx].mapsLink = mapsInput.value;
  saveData();

  // Visual feedback: collapse the slot into a compact saved view
  const item = document.getElementById('slot-' + day.id + '-' + slotIdx);
  if (item) {
    item.classList.add('slot-saved');
    const btn = document.getElementById('save-slot-' + dayIdx + '-' + slotIdx);
    if (btn) {
      btn.textContent = '✏️ Modifica';
      btn.onclick = () => editSlot(dayIdx, slotIdx);
    }
  }
  showToast('Tappa salvata ✓', 'success');
  announce('Tappa salvata');
}

function editSlot(dayIdx, slotIdx) {
  const day = tripData.days[dayIdx];
  const item = document.getElementById('slot-' + day.id + '-' + slotIdx);
  if (item) {
    item.classList.remove('slot-saved');
    const btn = document.getElementById('save-slot-' + dayIdx + '-' + slotIdx);
    if (btn) {
      btn.textContent = '✓ Fatto';
      btn.onclick = () => saveSlotDone(dayIdx, slotIdx);
    }
  }
  announce('Tappa in modifica');
}

// ---- TASCA BIGLIETTI GIORNALIERI ----
function createDayTicketPocket(day, dayIdx) {
  const pocket = document.createElement('div');
  pocket.className = 'ticket-pocket';
  pocket.innerHTML = `
    <div class="ticket-pocket-title"><span aria-hidden="true">🎟</span> Biglietti del giorno</div>
    <div class="pocket-upload-zone" role="button" tabindex="0"
      aria-label="Carica biglietti del giorno ${dayIdx+1}"
      id="day-zone-${day.id}">
      <span aria-hidden="true">📎</span>
      <span>Carica biglietti</span>
      <span class="upload-hint">PDF · JPEG · PNG</span>
    </div>
    <input type="file" id="day-input-${day.id}" accept=".pdf,.jpg,.jpeg,.png" multiple class="hidden"
      aria-label="File biglietti giorno ${dayIdx+1}" />
    <div class="tickets-list" id="day-tickets-${day.id}" aria-live="polite"></div>
  `;
  const zone = pocket.querySelector('#day-zone-' + day.id);
  const inp  = pocket.querySelector('#day-input-' + day.id);
  zone.addEventListener('click', () => inp.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });
  inp.addEventListener('change', e => handleDayFile(e, dayIdx));

  // Render ticket esistenti
  const list = pocket.querySelector('#day-tickets-' + day.id);
  (day.tickets || []).forEach((t, ti) => list.appendChild(createTicketItem(t, ti, 'day', dayIdx)));
  // Se già ci sono biglietti: nascondi zona carica e mostra pulsante aggiungi
  if ((day.tickets || []).length > 0) {
    zone.classList.add('hidden');
    ensureDayAddMoreBtn(day, dayIdx, inp, list);
  }

  return pocket;
}

// ---- UPLOAD FILE ----
function readFile(file, cb) {
  const reader = new FileReader();
  reader.onload = e => cb({ name: file.name, type: file.type, data: e.target.result });
  reader.onerror = () => showToast('Errore lettura file', 'error');
  reader.readAsDataURL(file);
}

function handleGlobalFileUpload(event) {
  Array.from(event.target.files).forEach(file => readFile(file, ticket => {
    if (!tripData.globalTickets) tripData.globalTickets = [];
    tripData.globalTickets.push(ticket);
    saveData();
    renderGlobalTickets();
    showToast(file.name + ' caricato ✓', 'success');
  }));
  event.target.value = '';
}

function handleDayFile(event, dayIdx) {
  Array.from(event.target.files).forEach(file => readFile(file, ticket => {
    if (!tripData.days[dayIdx].tickets) tripData.days[dayIdx].tickets = [];
    tripData.days[dayIdx].tickets.push(ticket);
    saveData();
    const day = tripData.days[dayIdx];
    const list = document.getElementById('day-tickets-' + day.id);
    const ti = tripData.days[dayIdx].tickets.length - 1;
    if (list) list.appendChild(createTicketItem(ticket, ti, 'day', dayIdx));
    // Hide upload zone, show "add more" button
    const zone = document.getElementById('day-zone-' + day.id);
    const inp  = document.getElementById('day-input-' + day.id);
    if (zone) zone.classList.add('hidden');
    ensureDayAddMoreBtn(day, dayIdx, inp, list);
    showToast(file.name + ' caricato ✓', 'success');
  }));
  event.target.value = '';
}

function ensureDayAddMoreBtn(day, dayIdx, inp, list) {
  if (!list || !inp) return;
  const btnId = 'day-add-more-' + day.id;
  if (!document.getElementById(btnId)) {
    const addBtn = document.createElement('button');
    addBtn.id = btnId;
    addBtn.className = 'btn--add-slot';
    addBtn.style.marginTop = '0.75rem';
    addBtn.textContent = '+ Aggiungi biglietto';
    addBtn.addEventListener('click', () => inp.click());
    list.after(addBtn);
  }
}

function renderGlobalTickets() {
  const list = document.getElementById('global-tickets-list');
  if (!list) return;
  list.innerHTML = '';
  (tripData.globalTickets || []).forEach((t, i) => list.appendChild(createTicketItem(t, i, 'global')));

  const zone = document.getElementById('global-upload-zone');
  const inp  = document.getElementById('global-file-input');

  // Remove old "add more" button if present
  const oldBtn = document.getElementById('global-add-more-btn');
  if (oldBtn) oldBtn.remove();

  if ((tripData.globalTickets || []).length > 0) {
    if (zone) zone.classList.add('hidden');
    // Add "Aggiungi altro" button after the list
    if (inp) {
      const addBtn = document.createElement('button');
      addBtn.id = 'global-add-more-btn';
      addBtn.className = 'btn--add-slot';
      addBtn.style.marginTop = '0.75rem';
      addBtn.textContent = '+ Aggiungi biglietto';
      addBtn.addEventListener('click', () => inp.click());
      list.after(addBtn);
    }
  } else {
    if (zone) zone.classList.remove('hidden');
    if (inp) inp.value = '';
  }
}

function createTicketItem(ticket, idx, scope, dayIdx) {
  const item = document.createElement('div');
  item.className = 'ticket-item';
  const isPdf = ticket.type === 'application/pdf';
  item.innerHTML = `
    <span class="ticket-icon">${isPdf ? '📄' : '🖼'}</span>
    <span class="ticket-name">${esc(ticket.name)}</span>
    <button class="ticket-view-btn" aria-label="Visualizza ${esc(ticket.name)}">Apri</button>
    <button class="ticket-delete-btn" aria-label="Elimina ${esc(ticket.name)}">🗑</button>
  `;
  item.querySelector('.ticket-view-btn').addEventListener('click', () => openViewerFromTicket(ticket));
  item.querySelector('.ticket-delete-btn').addEventListener('click', () => deleteTicket(scope, idx, dayIdx));
  return item;
}

function deleteTicket(scope, idx, dayIdx) {
  if (scope === 'global') {
    tripData.globalTickets.splice(idx, 1);
    saveData(); renderGlobalTickets();
  } else if (scope === 'day') {
    tripData.days[dayIdx].tickets.splice(idx, 1);
    saveData();
    const day = tripData.days[dayIdx];
    const list = document.getElementById('day-tickets-' + day.id);
    if (list) { list.innerHTML = ''; day.tickets.forEach((t,ti) => list.appendChild(createTicketItem(t,ti,'day',dayIdx))); }
    const zone   = document.getElementById('day-zone-' + day.id);
    const inp    = document.getElementById('day-input-' + day.id);
    const addBtn = document.getElementById('day-add-more-' + day.id);
    if (day.tickets.length === 0) {
      if (zone) zone.classList.remove('hidden');
      if (inp) inp.value = '';
      if (addBtn) addBtn.remove();
    } else {
      if (zone) zone.classList.add('hidden');
      if (list && inp && !document.getElementById('day-add-more-' + day.id)) {
        ensureDayAddMoreBtn(day, dayIdx, inp, list);
      }
    }
  }
  showToast('Biglietto eliminato', 'info');
}

// ---- VIEWER ----
function openViewerFromTicket(ticket) {
  if (typeof ticket === 'string') ticket = JSON.parse(ticket);
  const viewer = document.getElementById('fullscreen-viewer');
  const content = document.getElementById('viewer-content');
  content.innerHTML = '';

  const isPdf = ticket.type === 'application/pdf';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Convert base64 dataURL to Blob + blobURL
  function makeBlobUrl(dataUrl, mimeType) {
    try {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    } catch(e) { return null; }
  }

  // Universal download: tries anchor click with dataURL first (works on desktop + Android),
  // falls back to opening dataURL in new window (iOS Safari saves via long-press)
  function downloadFile(dataUrl, filename) {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); }, 200);
      if (!isIOS) showToast('Download avviato ✓', 'success');
    } catch(e) {
      // Fallback: open in new window
      window.open(dataUrl, '_blank');
    }
  }

  const wrap = document.createElement('div');
  // Semplice colonna centrata — il viewer-content fa lo scroll
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1.25rem;width:100%;max-width:700px;margin:0 auto;';

  if (isPdf) {
    const blobUrl = makeBlobUrl(ticket.data, 'application/pdf');

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:4rem;';
    icon.textContent = '📄';
    const name = document.createElement('div');
    name.style.cssText = 'color:#fff;font-size:1.25rem;font-weight:700;text-align:center;max-width:85%;word-break:break-all;';
    name.textContent = ticket.name;
    wrap.appendChild(icon);
    wrap.appendChild(name);

    // Desktop: embed iframe
    if (!isIOS && blobUrl) {
      const iframe = document.createElement('iframe');
      iframe.src = blobUrl;
      iframe.style.cssText = 'width:100%;max-width:700px;height:55vh;border:none;border-radius:0.75rem;background:#fff;';
      iframe.title = ticket.name;
      wrap.appendChild(iframe);
    }

    // Bottone download/apertura
    if (blobUrl) {
      const dlBtn = document.createElement('button');
      dlBtn.style.cssText = 'background:#e8a900;color:#1a1a2e;padding:0.875rem 2rem;border-radius:1rem;font-size:1.25rem;font-weight:900;border:none;cursor:pointer;';
      dlBtn.textContent = isIOS ? '📂 Apri PDF' : '⬇ Scarica PDF';
      dlBtn.addEventListener('click', () => {
        if (isIOS) {
          window.open(blobUrl, '_blank');
          showToast('In Safari: premi 📤 → Salva nel file', 'info');
        } else {
          downloadFile(ticket.data, ticket.name);
        }
      });
      wrap.appendChild(dlBtn);
    }

    if (isIOS) {
      const hint = document.createElement('div');
      hint.style.cssText = 'color:#aaa;font-size:0.9rem;text-align:center;max-width:300px;';
      hint.textContent = 'Su iPhone: tocca "Apri PDF" → usa il pulsante Condividi 📤 per salvare';
      wrap.appendChild(hint);
    }

  } else {
    // IMMAGINE (JPEG, PNG, ecc.)
    const img = document.createElement('img');
    img.alt = 'Biglietto: ' + ticket.name;
    img.style.cssText = 'max-width:100%;width:100%;object-fit:contain;display:block;border-radius:0.5rem;';

    // Carica l'immagine: prova prima dataURL, se fallisce prova blob
    img.onerror = () => {
      // Prova con blob URL come fallback
      try {
        const blobUrl = makeBlobUrl(ticket.data, ticket.type || 'image/jpeg');
        if (blobUrl && img.src !== blobUrl) { img.src = blobUrl; return; }
      } catch(e) {}
      wrap.innerHTML = '<div style="color:#fff;padding:2rem;text-align:center;font-size:1.2rem">⚠️ Impossibile aprire l\'immagine</div>';
    };
    img.src = ticket.data;
    setupPinchZoom(img);
    wrap.appendChild(img);

    const name = document.createElement('div');
    name.style.cssText = 'color:#ccc;font-size:1rem;text-align:center;word-break:break-all;max-width:85%;';
    name.textContent = ticket.name;
    wrap.appendChild(name);

    // Download immagine: dataURL anchor click funziona ovunque tranne Chrome/iOS
    // Per iOS Safari: apre in nuova tab → premi a lungo → Salva immagine
    const dlBtn = document.createElement('button');
    dlBtn.style.cssText = 'background:#e8a900;color:#1a1a2e;padding:0.875rem 2rem;border-radius:1rem;font-size:1.25rem;font-weight:900;border:none;cursor:pointer;';
    dlBtn.textContent = isIOS ? '🖼 Apri immagine' : '⬇ Scarica immagine';
    dlBtn.addEventListener('click', () => {
      if (isIOS) {
        // iOS Safari: apri in nuova finestra, utente preme a lungo per salvare
        const blobUrl = makeBlobUrl(ticket.data, ticket.type || 'image/jpeg');
        if (blobUrl) window.open(blobUrl, '_blank');
        else window.open(ticket.data, '_blank');
        showToast('Premi a lungo sull\'immagine → Aggiungi a Foto', 'info');
      } else {
        // Desktop/Android: download diretto con anchor + dataURL
        downloadFile(ticket.data, ticket.name);
      }
    });
    wrap.appendChild(dlBtn);

    if (isIOS) {
      const hint = document.createElement('div');
      hint.style.cssText = 'color:#aaa;font-size:0.9rem;text-align:center;max-width:300px;';
      hint.textContent = 'Su iPhone: tocca "Apri immagine" → tieni premuto → Aggiungi alla Libreria foto';
      wrap.appendChild(hint);
    }
  }

  content.appendChild(wrap);
  viewer.classList.remove('hidden');
  viewer.querySelector('.viewer-close').focus();
  announce('Visualizzatore aperto: ' + ticket.name);
}

function openViewer(scope, idx, dayIdx) {
  let t;
  if (scope === 'global') t = tripData.globalTickets[idx];
  else if (scope === 'day') t = tripData.days[dayIdx]?.tickets[idx];
  if (t) openViewerFromTicket(t);
}

function closeViewer() {
  document.getElementById('fullscreen-viewer').classList.add('hidden');
  document.getElementById('viewer-content').innerHTML = '';
}

function setupPinchZoom(img) {
  let scale = 1, startDist = 0;
  img.style.transition = 'transform 0.1s';
  const dist = t => Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
  img.parentElement.addEventListener('touchstart', e => { if (e.touches.length === 2) startDist = dist(e.touches); });
  img.parentElement.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      const d = dist(e.touches);
      scale = Math.min(Math.max(1, scale * d / startDist), 5);
      img.style.transform = `scale(${scale})`; startDist = d; e.preventDefault();
    }
  }, { passive: false });
  let lastTap = 0;
  img.parentElement.addEventListener('touchend', () => {
    const now = Date.now();
    if (now - lastTap < 300) { scale = 1; img.style.transform = 'scale(1)'; }
    lastTap = now;
  });
}

// ---- MODALS ----
function openTicketModal() {
  document.getElementById('modal-ticket').classList.remove('hidden');
  announce('Finestra biglietti aperta');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function openHotel() {
  const link = tripData.hotelMaps;
  if (link) { window.open(link, '_blank', 'noopener,noreferrer'); return; }
  if (tripData.hotelAddress) {
    window.open('https://maps.google.com/?q=' + encodeURIComponent(tripData.hotelAddress), '_blank', 'noopener,noreferrer');
    return;
  }
  showToast('Configura prima l\'indirizzo dell\'hotel', 'error');
}

function openAttractions() {
  const modal = document.getElementById('modal-attractions');
  modal.classList.remove('hidden');
  document.getElementById('attractions-loading').classList.remove('hidden');
  document.getElementById('attractions-content').classList.add('hidden');
  document.getElementById('attractions-error').classList.add('hidden');

  if (!navigator.geolocation) {
    document.getElementById('attractions-loading').classList.add('hidden');
    document.getElementById('attractions-error').classList.remove('hidden');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude.toFixed(5);
    const lng = pos.coords.longitude.toFixed(5);
    setText('attractions-location', '📍 Posizione: ' + lat + ', ' + lng);
    document.getElementById('btn-attractions-maps').href =
      `https://www.google.com/maps/search/attrazioni+turistiche/@${lat},${lng},14z`;
    document.getElementById('attractions-loading').classList.add('hidden');
    document.getElementById('attractions-content').classList.remove('hidden');
  }, () => {
    document.getElementById('attractions-loading').classList.add('hidden');
    document.getElementById('attractions-error').classList.remove('hidden');
  }, { timeout: 10000 });
}


// ---- RESET ----
function resetTrip() {
  if (!confirm('Sei sicuro? Tutti i dati del viaggio saranno cancellati.')) return;
  localStorage.removeItem('travelAssist_v2');
  tripData = {
    city:'', departureDate:'', departureTime:'', returnDate:'', returnTime:'',
    transport:'', hotelAddress:'', hotelMaps:'', days:[], globalTickets:[],
    transportTickets:{ andata:null, ritorno:null }
  };
  showSection('setup');
  announce('Viaggio resettato');
}

// ---- TOAST ----
function createToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
}
function showToast(msg, type = 'info') {
  const c = document.querySelector('.toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`; t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---- SCREEN READER ----
function announce(msg) {
  const el = document.getElementById('sr-announce');
  if (!el) return;
  el.textContent = ''; setTimeout(() => el.textContent = msg, 50);
}

// ---- ESCAPE HTML ----
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- ESC KEY ----
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    if (!document.getElementById('fullscreen-viewer').classList.contains('hidden')) closeViewer();
    closeDropdown();
  }
});
