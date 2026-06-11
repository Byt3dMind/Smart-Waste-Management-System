/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Reports Controller (reports.js)
   Renders highly premium, responsive Chart.js charts using
   localStorage data. Includes live exports & report generation.
   ============================================================ */

'use strict';

// Global references to Chart.js instances
let collectionTrendChart = null;
let binStatusDistChart = null;
let fuelEfficiencyChart = null;
let complaintResolutionChart = null;

document.addEventListener('DOMContentLoaded', () => {
  // Replace placeholder divs with Canvas tags
  prepareCanvases();

  // Initial load of charts
  generateAllCharts();

  // Hook filters & actions
  setupReportsControls();
});

/**
 * Replaces the HTML placeholder divs with canvas elements.
 */
function prepareCanvases() {
  const collectionPh = document.getElementById('collectionBarChart');
  if (collectionPh) {
    collectionPh.outerHTML = `<canvas id="collectionBarChart" style="max-height: 260px; width: 100%;"></canvas>`;
  }

  const wasteTypePh = document.getElementById('wasteTypePieChart');
  if (wasteTypePh) {
    wasteTypePh.outerHTML = `<canvas id="wasteTypePieChart" style="max-height: 200px; width: 100%;"></canvas>`;
  }

  const fuelPh = document.getElementById('fuelLineChart');
  if (fuelPh) {
    fuelPh.outerHTML = `<canvas id="fuelLineChart" style="max-height: 220px; width: 100%;"></canvas>`;
  }

  const complaintPh = document.getElementById('complaintLineChart');
  if (complaintPh) {
    complaintPh.outerHTML = `<canvas id="complaintLineChart" style="max-height: 220px; width: 100%;"></canvas>`;
  }
}

/**
 * Compiles all data and renders/updates the Chart.js visualisations.
 */
function generateAllCharts() {
  const bins = SwmsDB.bins.getAll();
  const complaints = SwmsDB.complaints.getAll();
  const reports = SwmsDB.reports.getAll();

  // 1. Render Waste Collection Trend (Monthly bar/area chart)
  renderWasteCollectionTrend(reports);

  // 2. Render Bin Status Distribution (Doughnut using live Bins array)
  renderBinStatusDistribution(bins);

  // 3. Render Complaint Status Chart (Doughnut/Pie using live Complaints)
  renderComplaintStatusChart(complaints);

  // 4. Render Fuel Efficiency Trend (Baseline vs Optimized routes)
  renderFuelEfficiencyTrend(reports);

  // 5. Update summary KPIs
  updateSummaryKPIs(bins, complaints, reports);
}

/**
 * Calculates and prints summary metrics into the top 4 KPI cards.
 */
function updateSummaryKPIs(bins, complaints, reports) {
  // KPI 1: Collection Rate
  const efficiency = reports.zoneEfficiency ? reports.zoneEfficiency.efficiency : [97.2];
  const avgEfficiency = (efficiency.reduce((a, b) => a + b, 0) / efficiency.length).toFixed(1);
  const kpi1 = document.querySelector('#rKpi1 div');
  if (kpi1) kpi1.textContent = `${avgEfficiency}%`;

  // KPI 2: Waste Collected (Total monthly tonnes sum)
  const monthlyData = (reports.collectionVolume && reports.collectionVolume.data) || [0];
  const totalTons = monthlyData.reduce((a, b) => a + b, 0);
  const kpi2 = document.querySelector('#rKpi2 div');
  if (kpi2) kpi2.textContent = `${totalTons.toLocaleString()} T`;

  // KPI 3: Cost Saved
  const costSavings = (reports.costAnalysis && reports.costAnalysis.savings) || [0];
  const totalSavings = costSavings.reduce((a, b) => a + b, 0);
  const kpi3 = document.querySelector('#rKpi3 div');
  if (kpi3) kpi3.textContent = `₹${(totalSavings / 10).toFixed(1)}L`;

  // KPI 4: CO2 Saved
  const co2Saved = (reports.environmentalImpact && reports.environmentalImpact.co2Avoided_kg) || 0;
  const kpi4 = document.querySelector('#rKpi4 div');
  if (kpi4) kpi4.textContent = `${(co2Saved / 1000).toFixed(1)} T`;

  if (window.animateCounters) window.animateCounters();
}

/**
 * 1. Waste Collection Trend Chart
 */
function renderWasteCollectionTrend(reports) {
  const canvas = document.getElementById('collectionBarChart');
  if (!canvas) return;

  if (collectionTrendChart) collectionTrendChart.destroy();

  const trendData = (reports && reports.collectionVolume) || {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    data: [712, 698, 745, 780, 810, 820]
  };

  const ctx = canvas.getContext('2d');
  
  // Custom theme gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
  gradient.addColorStop(1, 'rgba(34, 197, 94, 0.02)');

  collectionTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.labels,
      datasets: [{
        label: 'Collected Waste (tonnes)',
        data: trendData.data,
        backgroundColor: gradient,
        borderColor: '#22c55e',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#22c55e',
        pointHoverRadius: 7
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
        x: { grid: { display: false }, ticks: { color: '#a3a3a3' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a3a3a3' } }
      }
    }
  });
}

/**
 * 2. Bin Status Distribution Chart (Doughnut)
 * Groups current bins from localStorage dynamically by fill-level!
 */
function renderBinStatusDistribution(bins) {
  const canvas = document.getElementById('wasteTypePieChart');
  if (!canvas) return;

  if (binStatusDistChart) binStatusDistChart.destroy();

  // Count bins in each status dynamically
  const empty = bins.filter(b => b.status === 'empty' || b.fillLevel <= 30).length;
  const partial = bins.filter(b => b.status === 'partial' || (b.fillLevel > 30 && b.fillLevel < 75)).length;
  const nearFull = bins.filter(b => b.status === 'near-full' || (b.fillLevel >= 75 && b.fillLevel < 90)).length;
  const full = bins.filter(b => b.status === 'full' || b.fillLevel >= 90).length;
  const total = bins.length || 1;

  // Update header text to match target
  const header = canvas.parentNode.querySelector('h6');
  if (header) header.innerHTML = '<i class="bi bi-trash3 text-accent me-2"></i>Bin Status Distribution';

  // Calculate percentages
  const emptyPct = Math.round((empty / total) * 100);
  const partialPct = Math.round((partial / total) * 100);
  const nearFullPct = Math.round((nearFull / total) * 100);
  const fullPct = Math.round((full / total) * 100);

  // Update legend list elements dynamically
  const listContainer = canvas.parentNode.querySelector('.mt-3');
  if (listContainer) {
    listContainer.innerHTML = `
      <div class="d-flex justify-content-between" style="font-size:0.8rem;">
        <span style="color:var(--text-secondary);display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span>Empty (0-30%)</span>
        <span style="color:var(--accent);font-weight:700;">${empty} bins (${emptyPct}%)</span>
      </div>
      <div class="d-flex justify-content-between" style="font-size:0.8rem;">
        <span style="color:var(--text-secondary);display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#38bdf8;display:inline-block;"></span>Partial (31-74%)</span>
        <span style="color:#38bdf8;font-weight:700;">${partial} bins (${partialPct}%)</span>
      </div>
      <div class="d-flex justify-content-between" style="font-size:0.8rem;">
        <span style="color:var(--text-secondary);display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>Near Full (75-89%)</span>
        <span style="color:#f59e0b;font-weight:700;">${nearFull} bins (${nearFullPct}%)</span>
      </div>
      <div class="d-flex justify-content-between" style="font-size:0.8rem;">
        <span style="color:var(--text-secondary);display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;"></span>Full (90-100%)</span>
        <span style="color:#ef4444;font-weight:700;">${full} bins (${fullPct}%)</span>
      </div>
    `;
  }

  const ctx = canvas.getContext('2d');
  binStatusDistChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Empty', 'Partial', 'Near Full', 'Full'],
      datasets: [{
        data: [empty, partial, nearFull, full],
        backgroundColor: ['#22c55e', '#38bdf8', '#f59e0b', '#ef4444'],
        borderWidth: 3,
        borderColor: '#0f1716'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
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
 * 3. Complaint Status Chart (Pie / Doughnut Chart)
 * Replaces the static complaint trend line chart with a live status chart.
 */
function renderComplaintStatusChart(complaints) {
  const canvas = document.getElementById('complaintLineChart');
  if (!canvas) return;

  if (complaintResolutionChart) complaintResolutionChart.destroy();

  // Change heading title dynamically
  const header = canvas.parentNode.querySelector('h6');
  if (header) header.innerHTML = '<i class="bi bi-chat-square-text text-accent me-2"></i>Complaint Status Summary';

  // Group complaints dynamically
  const pending = complaints.filter(c => c.status === 'open' || c.status === 'pending').length;
  const inProgress = complaints.filter(c => c.status === 'in-progress').length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;

  const ctx = canvas.getContext('2d');
  complaintResolutionChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Pending', 'In Progress', 'Resolved'],
      datasets: [{
        data: [pending, inProgress, resolved],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderWidth: 2,
        borderColor: '#0f1716'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: '#e5e5e5', font: { family: 'Inter', size: 11 } }
        },
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
 * 4. Fuel Efficiency Chart (Dual dataset Line Chart)
 */
function renderFuelEfficiencyTrend(reports) {
  const canvas = document.getElementById('fuelLineChart');
  if (!canvas) return;

  if (fuelEfficiencyChart) fuelEfficiencyChart.destroy();

  const fuelData = (reports && reports.fuelEfficiency) || {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    baseline: [8200, 8100, 8400, 8600, 8800, 9000],
    actual: [5740, 5670, 5880, 5900, 6050, 6120]
  };

  const ctx = canvas.getContext('2d');
  fuelEfficiencyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fuelData.labels,
      datasets: [
        {
          label: 'Baseline Usage (without AI)',
          data: fuelData.baseline,
          borderColor: 'rgba(239, 68, 68, 0.65)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.3
        },
        {
          label: 'AI Optimized Usage',
          data: fuelData.actual,
          borderColor: '#22c55e',
          borderWidth: 3,
          backgroundColor: 'rgba(34, 197, 94, 0.05)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#22c55e',
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#a3a3a3', font: { family: 'Inter', size: 10 } }
        },
        tooltip: {
          backgroundColor: '#111918',
          borderColor: '#22c55e55',
          borderWidth: 1,
          titleColor: '#f0fdf4',
          bodyColor: '#f0fdf4',
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a3a3a3' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a3a3a3' } }
      }
    }
  });
}

/**
 * Binds filtration and download/export capabilities.
 */
function setupReportsControls() {
  // 1. Generate Report Button
  const genBtn = document.getElementById('generateReportBtn');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const type = document.getElementById('reportType').value;
      const zone = document.getElementById('reportZone').value || 'All Zones';
      const from = document.getElementById('reportFrom').value || 'Beginning';
      const to = document.getElementById('reportTo').value || 'Today';

      // Regenerate charts with a nice toast indication
      generateAllCharts();

      if (window.SwmsToast) {
        window.SwmsToast.show(`Generated report: ${type} for ${zone} (${from} to ${to})`, 'success');
      }
    });
  }

  // 2. Report Type Grid Buttons (Quick Select)
  const buttons = document.querySelectorAll('.report-type-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const select = document.getElementById('reportType');
      if (select) {
        // Map grid IDs to select options
        if (btn.id === 'rtype1') select.value = 'Collection Efficiency';
        else if (btn.id === 'rtype2') select.value = 'Bin Fill Analysis';
        else if (btn.id === 'rtype3') select.value = 'Vehicle Performance';
        else if (btn.id === 'rtype4') select.value = 'Environmental Impact';
        else if (btn.id === 'rtype5') select.value = 'Cost Analysis';
        else if (btn.id === 'rtype6') select.value = 'Complaint Summary';

        // Trigger generation
        if (genBtn) genBtn.click();
      }
    });
  });

  // 3. Export CSV (Compile localStorage bins and download real CSV)
  const csvBtn = document.getElementById('exportCsvBtn');
  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      const bins = SwmsDB.bins.getAll();
      if (bins.length === 0) {
        if (window.SwmsToast) window.SwmsToast.show('No bin records to export.', 'error');
        return;
      }

      // Convert objects to CSV string
      const headers = ['Bin ID', 'Location', 'Zone', 'Fill Level (%)', 'Status', 'Battery (%)', 'Temp (°C)', 'Last Updated'];
      const rows = bins.map(b => [
        b.id,
        `"${b.location}"`,
        b.zone,
        b.fillLevel,
        b.status,
        b.battery,
        b.temperature,
        b.lastUpdated || ''
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      // Create download anchor trigger
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `swms_report_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.SwmsToast) {
        window.SwmsToast.show('CSV report downloaded successfully!', 'success');
      }
    });
  }

  // 4. Export PDF (Opens browser print window set up perfectly for printing reports)
  const pdfBtn = document.getElementById('exportPdfBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      window.print();
    });
  }
}
