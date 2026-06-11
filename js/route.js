/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Route Optimisation (route.js)
   Renders Leaflet.js routes, highlights smart bins exceeding 80%
   fill, draws AI-optimized collection path polylines, and
   re-calculates distances, stops, and vehicle assignments.
   ============================================================ */

'use strict';

let routeMap = null;
let binMarkers = [];
let routePolyline = null;
let currentZone = 'Zone A'; // Default active zone

// Central Depot coordinate (depot starting point)
const depotLatLng = [12.9520, 77.5800];

// Map of zones to matching vehicles and route names
const zoneRouteMap = {
  'Zone A': { name: 'Route A — Zone North', vehicle: 'VH-001 (Crusher Alpha)', color: '#22c55e' },
  'Zone B': { name: 'Route B — Zone East', vehicle: 'VH-002 (Tipper Bravo)', color: '#38bdf8' },
  'Zone C': { name: 'Route C — Zone West', vehicle: 'VH-003 (Mini Van Charlie)', color: '#f59e0b' },
  'Zone D': { name: 'Route D — Zone South', vehicle: 'VH-004 (Hydraulic Delta)', color: '#a78bfa' },
  'Zone E': { name: 'Route E — Zone Central', vehicle: 'VH-005 (Compactor Echo)', color: '#f87171' },
  'Zone F': { name: 'Route F — Zone Airport', vehicle: 'VH-001 (Crusher Alpha)', color: '#34d399' }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Clear placeholder div before mounting Leaflet
  const mapEl = document.getElementById('routeMap');
  if (mapEl) {
    mapEl.innerHTML = '';
  }

  // 2. Initialize Leaflet Map
  initRouteMap();

  // 3. Render Today's Routes list in sidebar
  renderRouteList();

  // 4. Draw optimized route for the default Zone A
  optimizeRoute('Zone A');

  // 5. Setup Action triggers (Regenerate, Export)
  setupRouteControls();
});

/**
 * Mounts Leaflet map centered over Bengaluru.
 */
function initRouteMap() {
  routeMap = L.map('routeMap', {
    zoomControl: true,
    attributionControl: false
  }).setView([12.9716, 77.5946], 12);

  // CartoDB Dark style tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20
  }).addTo(routeMap);
}

/**
 * Populates sidebar list with current routes and fill rates.
 */
function renderRouteList() {
  const listContainer = document.getElementById('routeList');
  if (!listContainer) return;

  const bins = SwmsDB.bins.getAll();

  listContainer.innerHTML = Object.entries(zoneRouteMap).map(([zone, info]) => {
    const zoneBins = bins.filter(b => b.zone === zone);
    const highFillBins = zoneBins.filter(b => b.fillLevel >= 80);
    const avgFill = Math.round(zoneBins.reduce((sum, b) => sum + b.fillLevel, 0) / (zoneBins.length || 1));
    const isSelected = zone === currentZone ? 'selected' : '';

    let statusBadge = '<span class="badge bg-warning ms-auto" style="font-size:0.7rem;">Pending</span>';
    if (highFillBins.length === 0) {
      statusBadge = '<span class="badge bg-success ms-auto" style="font-size:0.7rem;">Clear</span>';
    } else if (zone === currentZone) {
      statusBadge = '<span class="badge bg-danger ms-auto" style="font-size:0.7rem;">Optimising</span>';
    }

    return `
      <div class="route-item ${isSelected}" onclick="selectRoute('${zone}')">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="route-color-dot" style="background: ${info.color};"></span>
          <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${info.name}</span>
          ${statusBadge}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted);">
          Vehicle: ${info.vehicle.split(' ')[0]} · ${zoneBins.length} bins · Avg Fill: ${avgFill}%
        </div>
        <div class="fill-gauge mt-1" style="height: 4px;">
          <div class="fill-gauge-bar" style="width: ${avgFill}%; background: ${info.color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Handle route selection from list.
 */
window.selectRoute = function(zone) {
  currentZone = zone;

  // Re-render sidebar highlighted class
  renderRouteList();

  // Optimise and render route
  optimizeRoute(zone);
};

/**
 * Performs heuristic nearest-neighbor route planning for high-fill bins in the selected zone.
 */
function optimizeRoute(zone) {
  // Clear previous layers
  binMarkers.forEach(m => routeMap.removeLayer(m));
  binMarkers = [];

  if (routePolyline) {
    routeMap.removeLayer(routePolyline);
    routePolyline = null;
  }

  const allBins = SwmsDB.bins.getAll();
  const zoneBins = allBins.filter(b => b.zone === zone);
  
  // High-fill bins exceeding 80% capacity
  const collectBins = zoneBins.filter(b => b.fillLevel >= 80);

  // 1. Draw Depot Marker (glowing base)
  const depotIcon = L.divIcon({
    className: 'custom-depot-marker',
    html: `<div style="width:24px;height:24px;background:#38bdf8;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #38bdf8;display:flex;align-items:center;justify-content:center;font-size:0.75rem;">🏢</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  const depotMarker = L.marker(depotLatLng, { icon: depotIcon })
    .bindPopup('<b>SWMS Central Depot</b><br>Fleet Starting Point')
    .addTo(routeMap);
  binMarkers.push(depotMarker);

  // 2. Draw Bin Markers (Highlight above 80%)
  zoneBins.forEach(bin => {
    const lat = parseFloat(bin.lat);
    const lng = parseFloat(bin.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const isHighFill = bin.fillLevel >= 80;
    const color = isHighFill ? '#ef4444' : '#22c55e'; // Red vs Green
    const size = isHighFill ? 32 : 24;

    const binIcon = L.divIcon({
      className: 'custom-bin-marker',
      html: `
        <div style="
          width: ${size}px; height: ${size}px;
          background: #111918;
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: ${isHighFill ? '0.9rem' : '0.75rem'};
          box-shadow: 0 0 10px ${color}88;
        ">
          🗑️
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    const marker = L.marker([lat, lng], { icon: binIcon })
      .bindPopup(`
        <b>${bin.id}</b><br>
        Fill Level: <b style="color:${color};">${bin.fillLevel}%</b><br>
        Type: ${bin.wasteType}<br>
        Location: ${bin.location}
      `)
      .addTo(routeMap);
    
    binMarkers.push(marker);
  });

  // 3. Connect Route using Polylines (AI Route Generation)
  if (collectBins.length > 0) {
    const routePoints = [depotLatLng];
    const unvisited = [...collectBins];
    let currentPos = L.latLng(depotLatLng[0], depotLatLng[1]);

    // Greedy Nearest-Neighbor TSP algorithm to sort locations logically
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const binPos = L.latLng(parseFloat(unvisited[i].lat), parseFloat(unvisited[i].lng));
        const dist = currentPos.distanceTo(binPos);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }

      const nextBin = unvisited.splice(nearestIndex, 1)[0];
      routePoints.push([parseFloat(nextBin.lat), parseFloat(nextBin.lng)]);
      currentPos = L.latLng(parseFloat(nextBin.lat), parseFloat(nextBin.lng));
    }

    // Complete the loop back to depot
    routePoints.push(depotLatLng);

    // Render path polylines on map
    const routeColor = zoneRouteMap[zone].color;
    routePolyline = L.polyline(routePoints, {
      color: routeColor,
      weight: 5,
      opacity: 0.8,
      dashArray: '8, 8',
      lineJoin: 'round'
    }).addTo(routeMap);

    // Fit map view to wrap the route
    routeMap.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    // Calculate total route distance dynamically using Leaflet distance mapping
    let totalDistMeters = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = L.latLng(routePoints[i][0], routePoints[i][1]);
      const p2 = L.latLng(routePoints[i + 1][0], routePoints[i + 1][1]);
      totalDistMeters += p1.distanceTo(p2);
    }
    const totalDistKm = (totalDistMeters / 1000).toFixed(1);

    // Update KPI panels dynamically based on calculation
    document.querySelector('#routeStat1 div').textContent = Object.values(zoneRouteMap).filter(z => allBins.filter(b => b.zone === z).length > 0).length || 6;
    document.querySelector('#routeStat2 div').textContent = `${totalDistKm} km`;
    document.querySelector('#routeStat4 div').textContent = `${(totalDistKm / 22).toFixed(1)} hrs`; // Simulated speed 22 km/h
  } else {
    // If no bins need collection, pan to depot and clear metrics
    routeMap.setView(depotLatLng, 13);
    document.querySelector('#routeStat2 div').textContent = `0 km`;
    document.querySelector('#routeStat4 div').textContent = `0 hrs`;
  }
}

/**
 * Setup controls like manual regeneration and downloads.
 */
function setupRouteControls() {
  // 1. Regenerate Routes (Simulate IoT sensor updates)
  const regenBtn = document.getElementById('regenerateRouteBtn');
  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      const bins = SwmsDB.bins.getAll();
      
      // Simulate random fluctuations in fill levels
      const nextBins = bins.map(b => {
        const delta = Math.floor(Math.random() * 21) - 10; // -10 to +10%
        let nextFill = Math.max(0, Math.min(100, b.fillLevel + delta));
        
        let status = 'empty';
        if (nextFill > 90) status = 'full';
        else if (nextFill >= 75) status = 'near-full';
        else if (nextFill > 30) status = 'partial';

        return {
          ...b,
          fillLevel: nextFill,
          status,
          lastUpdated: new Date().toISOString()
        };
      });

      SwmsDB.bins.save(nextBins);
      
      // Refresh current route view
      renderRouteList();
      optimizeRoute(currentZone);

      if (window.SwmsToast) {
        window.SwmsToast.show('AI Route Optimization recalibrated!', 'success');
      }
    });
  }

  // 2. Export Routes (Real JSON compilation download)
  const exportBtn = document.getElementById('exportRouteBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const bins = SwmsDB.bins.getAll();
      const exportData = Object.entries(zoneRouteMap).map(([zone, info]) => {
        const routeBins = bins.filter(b => b.zone === zone && b.fillLevel >= 80);
        return {
          route: info.name,
          vehicle: info.vehicle,
          highFillStopsCount: routeBins.length,
          stopsList: routeBins.map(b => ({ id: b.id, location: b.location, fill: b.fillLevel }))
        };
      });

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `optimized_routes_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.SwmsToast) {
        window.SwmsToast.show('Optimized routes downloaded!', 'success');
      }
    });
  }

  // 3. Fullscreen Map toggling capability
  const fsBtn = document.getElementById('fullscreenMapBtn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const mapWrap = document.getElementById('routeMap');
      if (mapWrap) {
        if (!document.fullscreenElement) {
          mapWrap.requestFullscreen().catch(err => {
            console.error('Fullscreen request failed:', err);
          });
        } else {
          document.exitFullscreen();
        }
      }
    });
  }
}
