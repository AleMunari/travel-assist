// =============================================
// TRAVEL ASSIST — app.js
// Vanilla JS, PWA-ready, Accessible
// =============================================

'use strict';

// ---- STATE ----
let tripData = {
  city: '',
  departureDate: '',
  departureTime: '',
  returnDate: '',
  returnTime: '',
  transport: '',
  hotelAddress: '',
  days: [],
  globalTickets: []
};

let currentPosition = null;
let watchId = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  loadTripData();
  createToastContainer();

  if (tripData.city) {
    renderDashboard();
    showSection('dashboard');
  } else {
    showSection('setup');
  }

  // Set default form dates
  const today = new Date().toISOString().split('T')[0];
  const setupForm = document.getElementById('setup-form');
  if (setupForm) {
    document.getElementById('departure-date').value = today;
    document.getElementById('return-date').value = today;
  }

  // Form submit
  document.getElementById('setup-form').addEventListener('submit', handleSetupSubmit);

  // Start geolocation watch
  startGeolocation();

  // Drag-and-drop for global upload zone
  setupDragDrop('global-upload-zone', handleGlobalFileUpload);
});

// ---- SERVICE WORKER ----
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }
}

// ---- STORAGE ----
function saveTripData() {
  try {
    localStorage.setItem('travelAssist_trip', JSON.stringify(tripData));
  } catch (e) {
    showToast('Errore nel salvataggio dei dati', 'error');
  }
}

function loadTripData() {
  try {
    const saved = localStorage.getItem('travelAssist_trip');
    if (saved) {
      tripData = { ...tripData, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Impossibile caricare i dati salvati');
  }
}

// ---- SECTIONS ----
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`section-${name}`);
  if (target) {
    target.classList.remove('hidden');
    // Announce to screen reader
    announce(`Sezione ${name} aperta`);
  }
}

// ---- SETUP FORM ----
function handleSetupSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const city = form.city.value.trim();
  if (!city) {
    showToast('Inserisci la città di destinazione', 'error');
    document.getElementById('city').focus();
    return;
  }

  tripData.city = city;
  tripData.departureDate = form['departure-date'].value;
  tripData.departureTime = form['departure-time'].value;
  tripData.returnDate = form['return-date'].value;
  tripData.returnTime = form['return-time'].value;
  tripData.transport = form.transport.value;
  tripData.hotelAddress = form['hotel-address'].value.trim();

  // Generate days from date range
  tripData.days = generateDays(tripData.departureDate, tripData.returnDate);

  saveTripData();
  renderDashboard();
  showSection('dashboard');
  announce('Viaggio configurato. Itinerario aperto.');
}

// ---- DATE UTILITIES ----
function generateDays(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const days = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);
  let dayNum = 1;

  while (current <= end) {
    days.push({
      id: `day-${dayNum}`,
      date: current.toISOString().split('T')[0],
      slots: [],
      tickets: []
    });
    current.setDate(current.getDate() + 1);
    dayNum++;
  }
  return days;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

// ---- DASHBOARD RENDER ----
function renderDashboard() {
  // Trip info bar
  document.getElementById('display-city').textContent = tripData.city || '—';
  document.getElementById('display-departure').textContent =
    tripData.departureDate ? `${formatDate(tripData.departureDate)} ${tripData.departureTime}` : '—';
  document.getElementById('display-return').textContent =
    tripData.returnDate ? `${formatDate(tripData.returnDate)} ${tripData.returnTime}` : '—';

  renderDaysList();
  renderGlobalTickets();
}

function renderDaysList() {
  const container = document.getElementById('days-list');
  container.innerHTML = '';

  if (!tripData.days || tripData.days.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Nessun giorno configurato</p>';
    return;
  }

  tripData.days.forEach((day, idx) => {
    const dayEl = createDayCard(day, idx);
    container.appendChild(dayEl);
    // Auto-expand today
    if (isToday(day.date)) {
      dayEl.classList.add('expanded', 'is-today');
    }
  });
}

function createDayCard(day, idx) {
  const card = document.createElement('article');
  card.className = 'day-card';
  card.id = `card-${day.id}`;
  card.setAttribute('aria-label', `Giorno ${idx + 1}: ${formatDate(day.date)}`);

  const headerBtn = document.createElement('button');
  headerBtn.className = 'day-header';
  headerBtn.setAttribute('aria-expanded', 'false');
  headerBtn.setAttribute('aria-controls', `body-${day.id}`);
  headerBtn.innerHTML = `
    <div class="day-header-left">
      <span class="day-number" aria-hidden="true">${String(idx + 1).padStart(2, '0')}</span>
      <div class="day-info">
        <span class="day-date">${formatDate(day.date)}</span>
        <span class="day-label">${isToday(day.date) ? '📍 Oggi' : `Giorno ${idx + 1}`}</span>
      </div>
    </div>
    <span class="day-toggle" aria-hidden="true">▼</span>
  `;

  headerBtn.addEventListener('click', () => {
    const isExpanded = card.classList.toggle('expanded');
    headerBtn.setAttribute('aria-expanded', isExpanded.toString());
  });

  const body = document.createElement('div');
  body.className = 'day-body';
  body.id = `body-${day.id}`;
  body.setAttribute('role', 'region');

  // Slots section
  const slotsSection = document.createElement('div');
  slotsSection.className = 'slots-section';
  slotsSection.innerHTML = '<h3 style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">📍 Tappe del giorno</h3>';

  const slotsList = document.createElement('div');
  slotsList.className = 'slots-list';
  slotsList.id = `slots-${day.id}`;

  if (day.slots && day.slots.length > 0) {
    day.slots.forEach((slot, si) => {
      slotsList.appendChild(createSlotItem(day, idx, slot, si));
    });
  }

  const addSlotBtn = document.createElement('button');
  addSlotBtn.className = 'btn--add-slot';
  addSlotBtn.setAttribute('aria-label', `Aggiungi tappa al giorno ${idx + 1}`);
  addSlotBtn.textContent = '+ Aggiungi Tappa';
  addSlotBtn.addEventListener('click', () => addSlot(idx));

  slotsSection.appendChild(slotsList);
  slotsSection.appendChild(addSlotBtn);

  // Ticket pocket
  const pocket = createTicketPocket(day, idx);

  body.appendChild(slotsSection);
  body.appendChild(pocket);
  card.appendChild(headerBtn);
  card.appendChild(body);

  return card;
}

function createSlotItem(day, dayIdx, slot, slotIdx) {
  const item = document.createElement('div');
  item.className = 'slot-item';
  item.id = `slot-${day.id}-${slotIdx}`;

  item.innerHTML = `
    <div class="slot-row">
      <div class="slot-time">
        <label class="sr-only" for="time-${day.id}-${slotIdx}">Orario tappa ${slotIdx + 1}</label>
        <input type="time" class="slot-input" id="time-${day.id}-${slotIdx}"
          value="${slot.time || ''}"
          aria-label="Orario tappa ${slotIdx + 1}"
          data-field="time" data-day="${dayIdx}" data-slot="${slotIdx}" />
      </div>
      <div class="slot-place">
        <label class="sr-only" for="place-${day.id}-${slotIdx}">Luogo tappa ${slotIdx + 1}</label>
        <input type="text" class="slot-input" id="place-${day.id}-${slotIdx}"
          value="${escapeHtml(slot.place || '')}"
          placeholder="Luogo da visitare..."
          aria-label="Luogo tappa ${slotIdx + 1}"
          data-field="place" data-day="${dayIdx}" data-slot="${slotIdx}" />
      </div>
    </div>
    <div class="slot-row">
      <div class="slot-place" style="flex:1">
        <label class="sr-only" for="maps-${day.id}-${slotIdx}">Link Maps tappa ${slotIdx + 1}</label>
        <input type="url" class="slot-input" id="maps-${day.id}-${slotIdx}"
          value="${escapeHtml(slot.mapsLink || '')}"
          placeholder="https://maps.google.com/..."
          aria-label="Link Google Maps tappa ${slotIdx + 1}"
          data-field="mapsLink" data-day="${dayIdx}" data-slot="${slotIdx}" />
      </div>
    </div>
    <div class="slot-actions">
      <a href="${slot.mapsLink || '#'}" target="_blank" rel="noopener noreferrer"
        class="btn--go" id="go-${day.id}-${slotIdx}"
        aria-label="Portami a ${slot.place || 'questa tappa'} con Google Maps"
        ${!slot.mapsLink ? 'style="opacity:0.5;pointer-events:none"' : ''}>
        🧭 Portami Lì
      </a>
      <button class="btn--remove-slot"
        aria-label="Rimuovi tappa ${slotIdx + 1}"
        onclick="removeSlot(${dayIdx}, ${slotIdx})">✕</button>
    </div>
  `;

  // Event listeners for auto-save
  item.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('change', (e) => {
      const { field, day: d, slot: s } = e.target.dataset;
      tripData.days[parseInt(d)].slots[parseInt(s)][field] = e.target.value;
      saveTripData();
      // Update Maps link in go button
      if (field === 'mapsLink') {
        const goBtn = document.getElementById(`go-${tripData.days[d].id}-${s}`);
        if (goBtn) {
          goBtn.href = e.target.value || '#';
          goBtn.style.opacity = e.target.value ? '1' : '0.5';
          goBtn.style.pointerEvents = e.target.value ? '' : 'none';
        }
        updateDistanceDisplay();
      }
    });
    input.addEventListener('blur', () => saveTripData());
  });

  return item;
}

function createTicketPocket(day, dayIdx) {
  const pocket = document.createElement('div');
  pocket.className = 'ticket-pocket';

  pocket.innerHTML = `
    <div class="ticket-pocket-title">
      <span aria-hidden="true">🎟</span>
      Tasca Biglietti del Giorno
    </div>
    <div class="pocket-upload-zone" role="button" tabindex="0"
      id="pocket-zone-${day.id}"
      aria-label="Zona caricamento biglietti giorno ${dayIdx + 1}, clicca o premi Invio">
      <span aria-hidden="true" style="font-size:1.75rem">📎</span>
      <span style="font-size:var(--text-sm)">Carica biglietti del giorno</span>
      <span style="font-size:var(--text-xs);color:var(--text-muted)">PDF, JPEG, PNG</span>
    </div>
    <input type="file" id="pocket-input-${day.id}" accept=".pdf,.jpg,.jpeg,.png" multiple class="hidden"
      aria-label="Seleziona biglietti per il giorno ${dayIdx + 1}"
      data-day-idx="${dayIdx}" onchange="handleDayFileUpload(event, ${dayIdx})" />
    <div class="tickets-list" id="pocket-tickets-${day.id}" aria-live="polite" aria-label="Biglietti caricati giorno ${dayIdx + 1}"></div>
  `;

  const zone = pocket.querySelector('.pocket-upload-zone');
  const fileInput = pocket.querySelector(`#pocket-input-${day.id}`);

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  setupDragDrop(`pocket-zone-${day.id}`, (e) => handleDayFileUpload(e, dayIdx));

  // Render existing tickets
  if (day.tickets && day.tickets.length > 0) {
    const list = pocket.querySelector(`#pocket-tickets-${day.id}`);
    day.tickets.forEach((ticket, ti) => {
      list.appendChild(createTicketItem(ticket, ti, 'day', dayIdx));
    });
  }

  return pocket;
}

// ---- SLOTS MANAGEMENT ----
function addSlot(dayIdx) {
  if (!tripData.days[dayIdx].slots) tripData.days[dayIdx].slots = [];
  tripData.days[dayIdx].slots.push({ time: '', place: '', mapsLink: '' });
  saveTripData();

  const day = tripData.days[dayIdx];
  const slotIdx = day.slots.length - 1;
  const list = document.getElementById(`slots-${day.id}`);
  if (list) {
    const newSlot = createSlotItem(day, dayIdx, day.slots[slotIdx], slotIdx);
    list.appendChild(newSlot);
    // Focus on place input
    setTimeout(() => {
      const placeInput = newSlot.querySelector('[data-field="place"]');
      if (placeInput) placeInput.focus();
    }, 50);
  }
  announce('Nuova tappa aggiunta');
}

function removeSlot(dayIdx, slotIdx) {
  tripData.days[dayIdx].slots.splice(slotIdx, 1);
  saveTripData();
  // Re-render day slots
  const day = tripData.days[dayIdx];
  const list = document.getElementById(`slots-${day.id}`);
  if (list) {
    list.innerHTML = '';
    day.slots.forEach((slot, si) => {
      list.appendChild(createSlotItem(day, dayIdx, slot, si));
    });
  }
  announce('Tappa rimossa');
}

function addDay() {
  const lastDay = tripData.days[tripData.days.length - 1];
  let nextDate = new Date();
  if (lastDay) {
    nextDate = new Date(lastDay.date + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + 1);
  }
  const newDay = {
    id: `day-${tripData.days.length + 1}`,
    date: nextDate.toISOString().split('T')[0],
    slots: [],
    tickets: []
  };
  tripData.days.push(newDay);
  saveTripData();

  const container = document.getElementById('days-list');
  const dayEl = createDayCard(newDay, tripData.days.length - 1);
  container.appendChild(dayEl);
  dayEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  announce('Nuovo giorno aggiunto all\'itinerario');
}

// ---- FILE UPLOAD ----
function handleGlobalFileUpload(event) {
  const files = event.target ? event.target.files : event;
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    readAndStoreFile(file, (ticket) => {
      if (!tripData.globalTickets) tripData.globalTickets = [];
      tripData.globalTickets.push(ticket);
      saveTripData();
      const list = document.getElementById('global-tickets-list');
      if (list) {
        list.appendChild(createTicketItem(ticket, tripData.globalTickets.length - 1, 'global'));
      }
    });
  });
}

function handleDayFileUpload(event, dayIdx) {
  const files = event.target ? event.target.files : event;
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    readAndStoreFile(file, (ticket) => {
      if (!tripData.days[dayIdx].tickets) tripData.days[dayIdx].tickets = [];
      tripData.days[dayIdx].tickets.push(ticket);
      saveTripData();
      const day = tripData.days[dayIdx];
      const list = document.getElementById(`pocket-tickets-${day.id}`);
      if (list) {
        list.appendChild(createTicketItem(ticket, tripData.days[dayIdx].tickets.length - 1, 'day', dayIdx));
      }
    });
  });
}

function readAndStoreFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const ticket = {
      name: file.name,
      type: file.type,
      data: e.target.result,
      size: file.size,
      savedAt: new Date().toISOString()
    };
    callback(ticket);
    showToast(`Biglietto "${file.name}" caricato ✓`, 'success');
    announce(`Biglietto ${file.name} caricato con successo`);
  };
  reader.onerror = () => showToast('Errore nel caricamento del file', 'error');
  reader.readAsDataURL(file);
}

function createTicketItem(ticket, idx, scope, dayIdx) {
  const item = document.createElement('div');
  item.className = 'ticket-item';

  const isPdf = ticket.type === 'application/pdf';
  const icon = isPdf ? '📄' : '🖼';

  item.innerHTML = `
    <span class="ticket-icon" aria-hidden="true">${icon}</span>
    <span class="ticket-name">${escapeHtml(ticket.name)}</span>
    <button class="ticket-view-btn" aria-label="Visualizza biglietto ${escapeHtml(ticket.name)} a schermo intero"
      onclick="openViewer('${scope}', ${idx}, ${dayIdx !== undefined ? dayIdx : 'null'})">
      Apri
    </button>
    <button class="ticket-delete-btn" aria-label="Elimina biglietto ${escapeHtml(ticket.name)}"
      onclick="deleteTicket('${scope}', ${idx}, ${dayIdx !== undefined ? dayIdx : 'null'})">
      🗑
    </button>
  `;
  return item;
}

function deleteTicket(scope, idx, dayIdx) {
  if (scope === 'global') {
    const name = tripData.globalTickets[idx]?.name;
    tripData.globalTickets.splice(idx, 1);
    saveTripData();
    renderGlobalTickets();
    announce(`Biglietto eliminato`);
  } else if (scope === 'day' && dayIdx !== null) {
    const name = tripData.days[dayIdx]?.tickets[idx]?.name;
    tripData.days[dayIdx].tickets.splice(idx, 1);
    saveTripData();
    const day = tripData.days[dayIdx];
    const list = document.getElementById(`pocket-tickets-${day.id}`);
    if (list) {
      list.innerHTML = '';
      day.tickets.forEach((t, ti) => {
        list.appendChild(createTicketItem(t, ti, 'day', dayIdx));
      });
    }
    announce(`Biglietto eliminato`);
  }
  showToast('Biglietto eliminato', 'info');
}

function renderGlobalTickets() {
  const list = document.getElementById('global-tickets-list');
  if (!list) return;
  list.innerHTML = '';
  (tripData.globalTickets || []).forEach((ticket, idx) => {
    list.appendChild(createTicketItem(ticket, idx, 'global'));
  });
}

// ---- VIEWER ----
function openViewer(scope, idx, dayIdx) {
  let ticket;
  if (scope === 'global') {
    ticket = tripData.globalTickets[idx];
  } else if (scope === 'day' && dayIdx !== null) {
    ticket = tripData.days[dayIdx]?.tickets[idx];
  }

  if (!ticket) return;

  const viewer = document.getElementById('fullscreen-viewer');
  const content = document.getElementById('viewer-content');
  content.innerHTML = '';

  if (ticket.type === 'application/pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = ticket.data;
    iframe.title = ticket.name;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    content.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = ticket.data;
    img.alt = `Biglietto: ${ticket.name}`;
    // Touch zoom support
    setupPinchZoom(img);
    content.appendChild(img);
  }

  // Max brightness
  screen.orientation && document.body.requestFullscreen && document.body.requestFullscreen().catch(() => {});
  viewer.classList.remove('hidden');
  document.getElementById('viewer-title').textContent = `Biglietto: ${ticket.name}`;
  announce(`Visualizzazione biglietto ${ticket.name} aperta`);

  // Trap focus in viewer
  const closeBtn = viewer.querySelector('.viewer-close');
  closeBtn.focus();
}

function closeViewer() {
  document.getElementById('fullscreen-viewer').classList.add('hidden');
  document.getElementById('viewer-content').innerHTML = '';
  document.exitFullscreen && document.exitFullscreen().catch(() => {});
  announce('Visualizzatore chiuso');
}

// Simple pinch-zoom for images
function setupPinchZoom(img) {
  let scale = 1, startDist = 0;
  img.style.transition = 'transform 0.1s';

  const getDistance = (t) => {
    const [a, b] = [t[0], t[1]];
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };

  img.parentElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) startDist = getDistance(e.touches);
  });

  img.parentElement.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      scale = Math.min(Math.max(1, scale * (dist / startDist)), 5);
      img.style.transform = `scale(${scale})`;
      startDist = dist;
      e.preventDefault();
    }
  }, { passive: false });

  // Double-tap reset
  let lastTap = 0;
  img.parentElement.addEventListener('touchend', () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      scale = 1;
      img.style.transform = 'scale(1)';
    }
    lastTap = now;
  });
}

// ---- MODALS ----
function openTicketModal() {
  document.getElementById('modal-ticket').classList.remove('hidden');
  document.querySelector('#modal-ticket .modal-close').focus();
  announce('Modal biglietti aperta');
}

function openHotel() {
  if (!tripData.hotelAddress) {
    showToast('Configura prima l\'indirizzo dell\'hotel', 'error');
    return;
  }
  const mapsUrl = `https://maps.google.com/maps?daddr=${encodeURIComponent(tripData.hotelAddress)}`;
  window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  announce('Apertura Google Maps per l\'hotel');
}

function openAttractions() {
  const modal = document.getElementById('modal-attractions');
  modal.classList.remove('hidden');

  const loading = document.getElementById('attractions-loading');
  const content = document.getElementById('attractions-content');
  const error = document.getElementById('attractions-error');

  loading.classList.remove('hidden');
  content.classList.add('hidden');
  error.classList.add('hidden');

  modal.querySelector('.modal-close').focus();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);

        document.getElementById('attractions-location').textContent =
          `📍 Posizione rilevata: ${lat}, ${lng}`;

        const searchUrl = `https://www.google.com/maps/search/attrazioni+turistiche/@${lat},${lng},14z`;
        const dirUrl = `https://maps.google.com/maps?q=${lat},${lng}`;

        document.getElementById('btn-attractions-maps').href = searchUrl;
        document.getElementById('btn-attractions-portami').href = dirUrl;

        loading.classList.add('hidden');
        content.classList.remove('hidden');
        announce('Posizione rilevata. Link attrazioni disponibili.');
      },
      (err) => {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        announce('Errore rilevamento posizione');
      },
      { timeout: 10000 }
    );
  } else {
    loading.classList.add('hidden');
    error.classList.remove('hidden');
  }
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  announce('Finestra chiusa');
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    const viewer = document.getElementById('fullscreen-viewer');
    if (!viewer.classList.contains('hidden')) closeViewer();
  }
});

// ---- CONSOLATO ----
function callConsulate() {
  const city = tripData.city || 'Roma';
  const searchUrl = `https://www.google.com/search?q=consolato+italiano+${encodeURIComponent(city)}+telefono`;
  window.open(searchUrl, '_blank', 'noopener,noreferrer');
}

// ---- GEOLOCATION & DISTANCE ----
function startGeolocation() {
  if (!navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateDistanceDisplay();
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
  );
}

function getNextSlotCoords() {
  if (!tripData.days) return null;
  const today = new Date().toISOString().split('T')[0];
  const todayDay = tripData.days.find(d => d.date === today);
  if (!todayDay || !todayDay.slots) return null;

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  for (const slot of todayDay.slots) {
    if (slot.mapsLink && slot.place) {
      return slot;
    }
  }
  return null;
}

function updateDistanceDisplay() {
  const distEl = document.getElementById('display-distance');
  if (!distEl) return;

  if (!currentPosition) {
    distEl.textContent = 'Rilevamento posizione...';
    return;
  }

  const nextSlot = getNextSlotCoords();
  if (!nextSlot || !nextSlot.mapsLink) {
    distEl.textContent = 'Nessuna tappa configurata';
    return;
  }

  // Try to extract coords from Maps URL
  const coordsMatch = nextSlot.mapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordsMatch) {
    const slotLat = parseFloat(coordsMatch[1]);
    const slotLng = parseFloat(coordsMatch[2]);
    const dist = haversineDistance(currentPosition.lat, currentPosition.lng, slotLat, slotLng);
    distEl.textContent = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
    distEl.parentElement.querySelector('.info-label').textContent =
      `Distanza da: ${nextSlot.place}`;
  } else {
    distEl.textContent = 'Apri Maps per distanza';
  }
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- RESET ----
function resetTrip() {
  if (!confirm('Sei sicuro di voler resettare tutto? I dati del viaggio saranno cancellati.')) return;
  localStorage.removeItem('travelAssist_trip');
  tripData = {
    city: '', departureDate: '', departureTime: '',
    returnDate: '', returnTime: '', transport: '',
    hotelAddress: '', days: [], globalTickets: []
  };
  showSection('setup');
  announce('Viaggio resettato. Configura un nuovo viaggio.');
}

// ---- DRAG AND DROP ----
function setupDragDrop(zoneId, handler) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.style.borderColor = 'var(--accent-primary)';
  });

  zone.addEventListener('dragleave', () => {
    zone.style.borderColor = '';
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.style.borderColor = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) handler({ target: { files } });
  });
}

// ---- TOAST NOTIFICATIONS ----
function createToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const c = document.createElement('div');
    c.className = 'toast-container';
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'false');
    document.body.appendChild(c);
  }
}

function showToast(message, type = 'info') {
  const container = document.querySelector('.toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ---- SCREEN READER ANNOUNCE ----
function announce(message) {
  const el = document.getElementById('sr-announce');
  if (el) {
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 50);
  }
}

// ---- UTILS ----
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
