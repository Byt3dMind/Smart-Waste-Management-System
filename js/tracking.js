/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Fleet Tracking (tracking.js)
   Renders Leaflet.js map, simulates real-time vehicle GPS
   movements every 5 seconds, saves paths to localStorage, and
   synchronizes with the interactive fleet sidebar panel.
   ============================================================ */

'use strict';

let map = null;
let markers = {}; // Store Leaflet markers by vehicle ID
let selectedVehicleId = 'VH-001'; // Default selected
let simulationInterval = null;

// Bengaluru coordinates from settings
const mapCenter = [12.9716, 77.5946];

document.addEventListener('DOMContentLoaded', () => {
  // 1. Clear placeholder before Leaflet mount
  const mapContainer = document.getElementById('trackingMap');
  if (mapContainer) {
    mapContainer.innerHTML = '';
  }

  // 2. Initialize Leaflet Map
  initMap();

  // 3. Render list & markers initially
  renderFleetSection();

  // 4. Start Live simulation (every 5 seconds)
  startPositionSimulation();

  // 5. Setup search and refresh actions
  setupTrackingControls();
});

/**
 * Initializes the Leaflet map and configures openstreetmap tiles.
 */
function initMap() {
  // Mount leaflet
  map = L.map('trackingMap', {
    zoomControl: true,
    attributionControl: false
  }).setView(mapCenter, 13);

  // Add dark themed map style using free CartoDB Voyager tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20
  }).addTo(map);
}

/**
 * Renders custom Leaflet markers based on vehicle statuses.
 */
function createCustomMarker(vehicle) {
  let emoji = '🚛';
  let color = '#22c55e'; // Green for active

  if (vehicle.status === 'idle') {
    color = '#f59e0b'; // Amber
    emoji = '🚛';
  } else if (vehicle.status === 'maintenance') {
    color = '#ef4444'; // Red
    emoji = '🔧';
  }

  if (vehicle.type === 'Mini Van') {
    emoji = '🚐';
  }

  // Glowing custom HTML pin
  const customIcon = L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        width: 38px; height: 38px;
        background: #111918;
        border: 2px solid ${color};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.2rem;
        box-shadow: 0 0 12px ${color}88, inset 0 0 4px ${color}66;
        cursor: pointer;
        transition: transform 0.2s ease;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });

  return customIcon;
}

/**
 * Renders the vehicle list on the left side and places/updates Leaflet markers.
 */
function renderFleetSection(searchQuery = '') {
  const vehicles = SwmsDB.vehicles.getAll();
  const listContainer = document.getElementById('vehicleTrackList');
  if (!listContainer) return;

  const query = searchQuery.toLowerCase().trim();
  const filtered = vehicles.filter(v => 
    v.id.toLowerCase().includes(query) || 
    v.name.toLowerCase().includes(query) || 
    (v.driver && v.driver.toLowerCase().includes(query)) ||
    (v.currentZone && v.currentZone.toLowerCase().includes(query))
  );

  // Update dynamic stats cards
  const totalFleet = vehicles.length;
  const onRoute = vehicles.filter(v => v.status === 'active').length;
  const atDepot = vehicles.filter(v => v.status === 'idle').length;
  const inMaint = vehicles.filter(v => v.status === 'maintenance' || v.status === 'offline').length;

  updateKPI('fleetStat1', totalFleet);
  updateKPI('fleetStat2', onRoute);
  updateKPI('fleetStat3', atDepot);
  updateKPI('fleetStat4', inMaint);

  if (filtered.length === 0) {
    listContainer.innerHTML = `<div class="text-center py-4 text-eco-muted">No matching vehicles.</div>`;
    // Hide all markers
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};
    return;
  }

  // Re-build active list HTML
  listContainer.innerHTML = filtered.map(v => {
    let badgeClass = 'offline';
    let subtext = `Offline`;

    if (v.status === 'active') {
      badgeClass = 'online';
      subtext = `Speed: ${v.speed} km/h · ${v.stopsCompleted || 0} stops done`;
    } else if (v.status === 'idle') {
      badgeClass = 'warning';
      subtext = `Idle at Depot · Awaiting route`;
    } else if (v.status === 'maintenance') {
      badgeClass = 'offline';
      subtext = `Scheduled Maintenance Bay`;
    }

    const isSelected = v.id === selectedVehicleId ? 'selected' : '';
    const avatarBg = v.status === 'active' ? 'rgba(74,222,128,0.12)' : (v.status === 'idle' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)');
    const emoji = v.type === 'Mini Van' ? '🚐' : (v.status === 'maintenance' ? '🔧' : '🚛');

    return `
      <div class="vehicle-row ${isSelected}" id="veh-${v.id}" onclick="selectVehicle('${v.id}')">
        <div class="d-flex align-items-center gap-3">
          <div class="vehicle-avatar" style="background: ${avatarBg};">${emoji}</div>
          <div class="flex-grow-1">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${v.id} · ${v.name}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${v.currentZone || 'Depot'} · Driver: ${v.driver || 'Staff'}</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${subtext}</div>
          </div>
          <span class="status-dot ${badgeClass}"></span>
        </div>
      </div>
    `;
  }).join('');

  // Synchronise Leaflet markers
  // First, clear old markers no longer in search results
  Object.keys(markers).forEach(id => {
    if (!filtered.some(v => v.id === id)) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  });

  // Place/update markers for filtered set
  filtered.forEach(v => {
    const lat = parseFloat(v.lat);
    const lng = parseFloat(v.lng);

    if (isNaN(lat) || isNaN(lng)) return;

    const popupHtml = `
      <div style="font-family: 'Inter', sans-serif; color: #1f2937; min-width: 160px; line-height: 1.4;">
        <strong style="font-size: 0.95rem; color: #16a34a;">${v.id} · ${v.name}</strong><br>
        <span style="font-size: 0.8rem; color: #6b7280;">Driver: ${v.driver || 'N/A'}</span><br>
        <span style="font-size: 0.8rem; color: #6b7280;">Fuel Level: ${v.fuel}%</span><br>
        <hr style="margin: 6px 0; border: 0; border-top: 1px solid #e5e7eb;">
        <span style="font-size: 0.8rem;">Status: <b style="color: ${v.status === 'active' ? '#16a34a' : '#f59e0b'};">${v.status.toUpperCase()}</b></span>
      </div>
    `;

    if (markers[v.id]) {
      // Move existing marker smoothly
      markers[v.id].setLatLng([lat, lng]);
      // Update popup content
      markers[v.id].setPopupContent(popupHtml);
    } else {
      // Create new marker
      const marker = L.marker([lat, lng], { icon: createCustomMarker(v) })
        .addTo(map)
        .bindPopup(popupHtml);

      // Bind click triggers
      marker.on('click', () => {
        selectVehicle(v.id, false); // select silently without flyTo
      });

      markers[v.id] = marker;
    }
  });

  // Pan to selected vehicle if requested
  if (selectedVehicleId && markers[selectedVehicleId] && searchQuery === '') {
    const activeVeh = vehicles.find(v => v.id === selectedVehicleId);
    if (activeVeh) {
      map.panTo([activeVeh.lat, activeVeh.lng]);
    }
  }
}

/**
 * Updates individual fleet status cards counts.
 */
function updateKPI(id, val) {
  const el = document.querySelector(`#${id} div`);
  if (el) el.textContent = val;
}

/**
 * Handle vehicle selection from either map or list rows.
 */
window.selectVehicle = function(id, triggerFly = true) {
  selectedVehicleId = id;

  // Highlights active row in sidebar
  document.querySelectorAll('.vehicle-row').forEach(row => row.classList.remove('selected'));
  const activeRow = document.getElementById(`veh-${id}`);
  if (activeRow) activeRow.classList.add('selected');

  // Fly and popup marker
  const vehicle = SwmsDB.vehicles.getById(id);
  if (vehicle && markers[id]) {
    if (triggerFly) {
      map.flyTo([vehicle.lat, vehicle.lng], 15, { duration: 1.2 });
    }
    markers[id].openPopup();
  }
};

/**
 * Performs simulated GPS movements for active trucks every 5 seconds.
 */
function startPositionSimulation() {
  simulationInterval = setInterval(() => {
    const vehicles = SwmsDB.vehicles.getAll();
    let updatedAny = false;

    const nextVehicles = vehicles.map(v => {
      if (v.status === 'active') {
        updatedAny = true;
        
        // Simulates realistic continuous wandering around Bengaluru streets
        const latDelta = (Math.random() - 0.5) * 0.0006;
        const lngDelta = (Math.random() - 0.5) * 0.0006;

        const newLat = parseFloat(v.lat) + latDelta;
        const newLng = parseFloat(v.lng) + lngDelta;

        // Varies speeds randomly to mimic congestion
        const speedVar = Math.floor(Math.random() * 9) - 4; // -4 to +4 km/h
        const nextSpeed = Math.max(15, Math.min(50, (v.speed || 30) + speedVar));

        // Occasional stops completion
        let nextStops = v.stopsCompleted || 0;
        if (Math.random() > 0.88 && nextStops < (v.stopsTotal || 50)) {
          nextStops++;
        }

        // Slowly drains fuel
        const nextFuel = Math.max(5, (v.fuel || 80) - 0.05);

        return {
          ...v,
          lat: newLat.toFixed(6),
          lng: newLng.toFixed(6),
          speed: nextSpeed,
          stopsCompleted: nextStops,
          fuel: parseFloat(nextFuel.toFixed(1)),
          lastUpdated: new Date().toISOString()
        };
      }
      return v;
    });

    if (updatedAny) {
      SwmsDB.save(SwmsDB.keys.VEHICLES, nextVehicles);
      
      // Update UI matching current search text
      const searchBox = document.getElementById('searchVehicle');
      const searchVal = searchBox ? searchBox.value : '';
      renderFleetSection(searchVal);
    }
  }, 5000);
}

/**
 * Binds search bar inputs, refresh clicks, and cleanup routines.
 */
function setupTrackingControls() {
  // 1. Search Box filters rows & markers dynamically
  const searchBox = document.getElementById('searchVehicle');
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      renderFleetSection(e.target.value);
    });
  }

  // 2. Manual Refresh Button
  const refreshBtn = document.getElementById('refreshTrackBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) {
        icon.classList.add('spin-animation');
        setTimeout(() => icon.classList.remove('spin-animation'), 600);
      }
      
      const searchVal = searchBox ? searchBox.value : '';
      renderFleetSection(searchVal);

      if (window.SwmsToast) {
        window.SwmsToast.show('Live fleet positions updated!', 'success');
      }
    });
  }

  // Clean simulation loop when navigating away from the page
  window.addEventListener('beforeunload', () => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
    }
  });
}
