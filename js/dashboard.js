/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Dashboard Controller (dashboard.js)
   Connects the Operations Dashboard page with localStorage.
   Auto-updates values and charts on storage modifications.
   ============================================================ */

'use strict';

// Keep global references to Chart.js instances so we can destroy/recreate them
let collectionChartInstance = null;
let binStatusChartInstance = null;
let complaintChartInstance = null;

// Track the last stringified database state to avoid redundant UI re-renders
let lastDbStateStr = '';

/**
 * Initialize elements on page load.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Replace the HTML placeholders with canvas elements for Chart.js
  prepareChartCanvases();

  // Initial render of all elements
  renderDashboard();

  // Setup event listeners
  setupEventListeners();
});

/**
 * Replaces the div placeholder containers with actual canvas elements
 * to allow Chart.js to render properly.
 */
function prepareChartCanvases() {
  const collectionPlaceholder = document.getElementById('collectionChartCanvas');
  if (collectionPlaceholder) {
    collectionPlaceholder.outerHTML = `<canvas id="collectionChartCanvas" style="max-height: 200px; width: 100%;"></canvas>`;
  }

  const binStatusPlaceholder = document.getElementById('binStatusChartCanvas');
  if (binStatusPlaceholder) {
    binStatusPlaceholder.outerHTML = `<canvas id="binStatusChartCanvas" style="max-height: 200px; width: 100%;"></canvas>`;
  }

  const complaintPlaceholder = document.getElementById('complaintChartCanvas');
  if (complaintPlaceholder) {
    complaintPlaceholder.outerHTML = `<canvas id="complaintChartCanvas" style="max-height: 200px; width: 100%;"></canvas>`;
  }
}

/**
 * Reads all required data from localStorage and returns aggregated numbers
 */
function getDashboardData() {
  // Access data through the SwmsDB namespace
  const bins = SwmsDB.bins.getAll();
  const vehicles = SwmsDB.vehicles.getAll();
  const complaints = SwmsDB.complaints.getAll();
  const reports = SwmsDB.reports.getAll();

  // Calculations
  const totalBins = bins.length;
  const fullBins = bins.filter(b => b.status === 'full' || b.fillLevel >= 90).length;
  const nearFullBins = bins.filter(b => b.status === 'near-full' || (b.fillLevel >= 75 && b.fillLevel < 90)).length;
  const emptyBins = bins.filter(b => b.status === 'empty' || b.fillLevel <= 30).length;
  const partialBins = totalBins - (fullBins + nearFullBins + emptyBins);

  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const totalVehiclesCount = vehicles.length;
  
  // Pending complaints include both 'open' and 'in-progress'
  const pendingComplaints = complaints.filter(c => c.status === 'open' || c.status === 'pending').length;
  const inProgressComplaints = complaints.filter(c => c.status === 'in-progress').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;

  return {
    bins,
    vehicles,
    complaints,
    reports,
    kpis: {
      totalBins,
      fullBins,
      nearFullBins,
      emptyBins,
      partialBins,
      activeVehicles,
      totalVehiclesCount,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints
    }
  };
}

/**
 * Main render function that populates all components on the dashboard.
 */
function renderDashboard() {
  const data = getDashboardData();
  const stateStr = JSON.stringify(data.kpis) + '_' + data.bins.length + '_' + data.vehicles.length + '_' + data.complaints.length;

  // Skip redundant rendering if state is unchanged
  if (stateStr === lastDbStateStr) {
    return;
  }
  lastDbStateStr = stateStr;

  console.info('[Dashboard] Re-rendering dashboard UI with fresh localStorage data...');

  // 1. Render KPIs
  renderKPIs(data.kpis);
  if (window.animateCounters) window.animateCounters();

  // 2. Render Attention Bins Table
  renderAttentionBinsTable(data.bins);

  // 3. Render Active Vehicles List
  renderVehiclesList(data.vehicles);

  // 4. Render Charts
  renderWeeklyCollectionChart(data.reports);
  renderBinStatusDonutChart(data.kpis);
  renderComplaintAnalyticsChart(data.kpis);

  // 5. Update Legend Text Labels
  updateLegendLabels(data.kpis, data.reports);
}

/**
 * Renders the 5 KPI cards with custom icons, values, labels and descriptions.
 */
function renderKPIs(kpis) {
  const kpiRow = document.getElementById('kpiRow');
  if (!kpiRow) return;

  // Make the row layout responsive for 5 columns
  kpiRow.className = "row g-3 mb-4 row-cols-2 row-cols-sm-3 row-cols-lg-5";

  kpiRow.innerHTML = `
    <!-- Total Bins -->
    <div class="col">
      <div class="kpi-card h-100">
        <div class="kpi-icon" style="background: rgba(34, 197, 94, 0.12);">🗑️</div>
        <div class="kpi-value" style="color: var(--accent);">${kpis.totalBins}</div>
        <div class="kpi-label">Total Bins</div>
        <div class="mt-2">
          <span class="stat-badge" style="font-size: 0.72rem;">
            <i class="bi bi-cpu me-1"></i>IoT Connected
          </span>
        </div>
      </div>
    </div>

    <!-- Full Bins -->
    <div class="col">
      <div class="kpi-card h-100">
        <div class="kpi-icon" style="background: rgba(239, 68, 68, 0.12);">🚨</div>
        <div class="kpi-value" style="color: #ef4444;">${kpis.fullBins}</div>
        <div class="kpi-label">Full Bins</div>
        <div class="mt-2">
          <span class="stat-badge" style="font-size: 0.72rem; border-color: rgba(239,68,68,0.3); color: #f87171;">
            <i class="bi bi-exclamation-triangle me-1"></i>Needs Clearing
          </span>
        </div>
      </div>
    </div>

    <!-- Empty Bins -->
    <div class="col">
      <div class="kpi-card h-100">
        <div class="kpi-icon" style="background: rgba(56, 189, 248, 0.12);">🟢</div>
        <div class="kpi-value" style="color: #38bdf8;">${kpis.emptyBins}</div>
        <div class="kpi-label">Empty Bins</div>
        <div class="mt-2">
          <span class="stat-badge" style="font-size: 0.72rem; border-color: rgba(56,189,248,0.3); color: #38bdf8;">
            <i class="bi bi-check2-circle me-1"></i>Clear & Ready
          </span>
        </div>
      </div>
    </div>

    <!-- Active Vehicles -->
    <div class="col">
      <div class="kpi-card h-100">
        <div class="kpi-icon" style="background: rgba(20, 184, 166, 0.12);">🚛</div>
        <div class="kpi-value" style="color: var(--secondary-light);">${kpis.activeVehicles}</div>
        <div class="kpi-label">Active Vehicles</div>
        <div class="mt-2">
          <span class="stat-badge" style="font-size: 0.72rem; border-color: rgba(20,184,166,0.3); color: var(--secondary-light);">
            ${kpis.activeVehicles} of ${kpis.totalVehiclesCount} on Route
          </span>
        </div>
      </div>
    </div>

    <!-- Pending Complaints -->
    <div class="col">
      <div class="kpi-card h-100">
        <div class="kpi-icon" style="background: rgba(245, 158, 11, 0.12);">📋</div>
        <div class="kpi-value" style="color: #fcd34d;">${kpis.pendingComplaints + kpis.inProgressComplaints}</div>
        <div class="kpi-label">Pending Complaints</div>
        <div class="mt-2">
          <span class="stat-badge" style="font-size: 0.72rem; border-color: rgba(245,158,11,0.3); color: #fcd34d;">
            <i class="bi bi-clock me-1"></i>Needs Action
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Dynamically lists bins that are near-full or full (fillLevel >= 75%)
 * sorted by fill level descending.
 */
function renderAttentionBinsTable(bins) {
  const tableBody = document.querySelector('#attentionBinsTable tbody');
  if (!tableBody) return;

  // Filter and sort
  const attentionBins = bins
    .filter(b => b.fillLevel >= 75 || b.status === 'full' || b.status === 'near-full')
    .sort((a, b) => b.fillLevel - a.fillLevel);

  if (attentionBins.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-eco-muted">
          <i class="bi bi-check-circle-fill text-success fs-3 mb-2 d-block"></i>
          All bins are in excellent condition. No urgent collections required!
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = attentionBins.slice(0, 5).map(bin => {
    // Determine color code based on fill level
    let barColor = '#ef4444'; // Red for full
    let badgeClass = 'bg-danger';
    let statusText = 'Full';

    if (bin.fillLevel < 90) {
      barColor = '#f59e0b'; // Amber for near-full
      badgeClass = 'bg-warning text-dark';
      statusText = 'Near Full';
    }

    // Friendly time ago calculation or fallback
    const timeText = bin.lastUpdated ? new Date(bin.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

    return `
      <tr class="bin-status-row">
        <td><span style="color: var(--accent); font-weight: 600;">${bin.id}</span></td>
        <td class="text-eco">${bin.location} <small class="text-eco-muted d-block" style="font-size:0.75rem;">${bin.zone}</small></td>
        <td style="min-width: 120px;">
          <div class="fill-bar">
            <div class="fill-bar-inner" style="width: ${bin.fillLevel}%; background: ${barColor};"></div>
          </div>
          <small class="text-eco-muted">${bin.fillLevel}%</small>
        </td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td class="text-eco-muted" style="font-size: 0.82rem;">${timeText}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Dynamically lists the vehicles showing active ones first.
 */
function renderVehiclesList(vehicles) {
  const listItems = document.getElementById('vehicleListItems');
  if (!listItems) return;

  if (vehicles.length === 0) {
    listItems.innerHTML = `<div class="text-center text-eco-muted py-3">No vehicles registered.</div>`;
    return;
  }

  // Sort: Active vehicles first
  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return 0;
  });

  listItems.innerHTML = sortedVehicles.slice(0, 4).map(v => {
    let dotClass = 'offline';
    if (v.status === 'active') dotClass = 'online';
    else if (v.status === 'idle') dotClass = 'warning';

    const statusLabel = v.status.charAt(0).toUpperCase() + v.status.slice(1);

    return `
      <div class="d-flex align-items-center gap-3 p-2 rounded-eco" style="background: var(--bg-card2);">
        <span style="font-size: 1.4rem;">🚛</span>
        <div class="flex-grow-1">
          <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${v.id} · ${v.name}</div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">${v.currentZone || 'Depot'} — ${v.route || 'Idle'}</div>
        </div>
        <span class="status-dot ${dotClass}" title="${statusLabel}"></span>
      </div>
    `;
  }).join('');
}

/**
 * Updates text-based numbers beneath the bin status and complaint donut charts.
 */
function updateLegendLabels(kpis, reports) {
  // 1. Waste Collection Overview volume summation
  const totalVolText = document.getElementById('collectionVolTotal');
  if (totalVolText) {
    const monthlyData = (reports && reports.collectionVolume && reports.collectionVolume.data) || [0];
    const totalTons = monthlyData.reduce((a, b) => a + b, 0);
    totalVolText.innerHTML = `Total Waste Collected: <strong class="text-accent">${totalTons.toLocaleString()} Tonnes</strong> (Last 6 Months)`;
  }

  // 2. Full vs Empty Bins
  const binLegend = document.getElementById('binStatusLegend');
  if (binLegend) {
    const emptyLabel = binLegend.querySelector('.empty-val');
    const fullLabel = binLegend.querySelector('.full-val');
    if (emptyLabel) emptyLabel.textContent = `${kpis.emptyBins} bins`;
    if (fullLabel) fullLabel.textContent = `${kpis.fullBins} bins`;
  }

  // 3. Complaint Analytics
  const cmpLegend = document.getElementById('complaintLegend');
  if (cmpLegend) {
    const pendingLabel = cmpLegend.querySelector('.pending-val');
    const progressLabel = cmpLegend.querySelector('.progress-val');
    const resolvedLabel = cmpLegend.querySelector('.resolved-val');
    if (pendingLabel) pendingLabel.textContent = `${kpis.pendingComplaints} cases`;
    if (progressLabel) progressLabel.textContent = `${kpis.inProgressComplaints} cases`;
    if (resolvedLabel) resolvedLabel.textContent = `${kpis.resolvedComplaints} cases`;
  }
}

/**
 * Draw the Waste Collection Overview chart.
 */
function renderWeeklyCollectionChart(reports) {
  const canvas = document.getElementById('collectionChartCanvas');
  if (!canvas) return;

  if (collectionChartInstance) {
    collectionChartInstance.destroy();
  }

  const chartData = (reports && reports.collectionVolume) || {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    data: [650, 710, 680, 740, 810, 850]
  };

  const ctx = canvas.getContext('2d');
  
  collectionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Collected Waste (tonnes)',
        data: chartData.data,
        backgroundColor: 'rgba(34, 197, 94, 0.4)',
        borderColor: '#22c55e',
        borderWidth: 2,
        borderRadius: 5,
        hoverBackgroundColor: 'rgba(34, 197, 94, 0.65)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111918',
          borderColor: '#22c55e55',
          borderWidth: 1,
          titleColor: '#f0fdf4',
          bodyColor: '#f0fdf4',
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a3a3a3', font: { family: 'Inter', size: 9 } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#a3a3a3', font: { family: 'Inter', size: 9 } } }
      }
    }
  });
}

/**
 * Draw the Full vs Empty Bins donut chart.
 */
function renderBinStatusDonutChart(kpis) {
  const canvas = document.getElementById('binStatusChartCanvas');
  if (!canvas) return;

  if (binStatusChartInstance) {
    binStatusChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  binStatusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Empty Bins', 'Full Bins'],
      datasets: [{
        data: [kpis.emptyBins, kpis.fullBins],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 2,
        borderColor: '#0f1716'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111918',
          borderColor: '#22c55e55',
          borderWidth: 1,
          titleColor: '#f0fdf4',
          bodyColor: '#f0fdf4',
        }
      }
    }
  });
}

/**
 * Draw the Complaint Analytics donut chart.
 */
function renderComplaintAnalyticsChart(kpis) {
  const canvas = document.getElementById('complaintChartCanvas');
  if (!canvas) return;

  if (complaintChartInstance) {
    complaintChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  complaintChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'In Progress', 'Resolved'],
      datasets: [{
        data: [kpis.pendingComplaints, kpis.inProgressComplaints, kpis.resolvedComplaints],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderWidth: 2,
        borderColor: '#0f1716'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111918',
          borderColor: '#22c55e55',
          borderWidth: 1,
          titleColor: '#f0fdf4',
          bodyColor: '#f0fdf4',
        }
      }
    }
  });
}

/**
 * Setups the storage update listeners and interactive handlers.
 */
function setupEventListeners() {
  // 1. Manual Refresh button
  const refreshBtn = document.getElementById('refreshDashBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) {
        icon.classList.add('spin-animation');
        setTimeout(() => icon.classList.remove('spin-animation'), 600);
      }
      renderDashboard();
      if (window.SwmsToast) {
        window.SwmsToast.show('Dashboard charts & KPIs updated!', 'success');
      }
    });
  }

  // 2. Window Storage Event (handles updates across tabs/windows)
  window.addEventListener('storage', (e) => {
    if (e.key && Object.values(SwmsDB.keys).includes(e.key)) {
      renderDashboard();
    }
  });

  // 3. Periodic Poll (detects modifications within the same window)
  setInterval(() => {
    renderDashboard();
  }, 1000);
}

// Add a quick spin animation class using a stylesheet insertion if it's missing
(function injectMiniStyles() {
  if (document.getElementById('dashboard-extra-styles')) return;
  const style = document.createElement('style');
  style.id = 'dashboard-extra-styles';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spin-animation {
      animation: spin 0.6s linear;
      display: inline-block;
    }
  `;
  document.head.appendChild(style);
})();
