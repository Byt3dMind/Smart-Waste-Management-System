/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Complaints Controller (complaints.js)
   Integrates complaints page with localStorage, enabling submission,
   editing, deletion, status updates, and interactive pagination.
   ============================================================ */

'use strict';

// Pagination and Filtering State
let currentPage = 1;
const itemsPerPage = 7;
let currentStatusFilter = ''; // Empty string means "All"

// Bootstrap Modal reference
let editModal = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Bootstrap Edit Modal
  const editModalEl = document.getElementById('editComplaintModal');
  if (editModalEl) {
    editModal = new bootstrap.Modal(editModalEl);
  }

  // Bind Form Submissions and Filters
  setupFormBindings();
  setupPaginationHandlers();

  // Initial render of page contents
  renderComplaintsPage();
});

/**
 * Recalculates stats, updates table grid, and manages pagination buttons.
 */
function renderComplaintsPage() {
  const complaints = SwmsDB.complaints.getAll();

  // 1. Calculate & Render Statistics
  const totalCount = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
  const inProgressCount = complaints.filter(c => c.status === 'in-progress').length;
  const openCount = complaints.filter(c => c.status === 'open' || c.status === 'pending').length;

  updateStatCard('cmpStat1', totalCount);
  updateStatCard('cmpStat2', resolvedCount);
  updateStatCard('cmpStat3', inProgressCount);
  updateStatCard('cmpStat4', openCount);
  if (window.animateCounters) window.animateCounters();

  // 2. Filter & Paginate complaints
  let filteredComplaints = [...complaints];
  if (currentStatusFilter) {
    filteredComplaints = complaints.filter(c => {
      if (currentStatusFilter === 'Open') return c.status === 'open' || c.status === 'pending';
      if (currentStatusFilter === 'In Progress') return c.status === 'in-progress';
      if (currentStatusFilter === 'Resolved') return c.status === 'resolved';
      return true;
    });
  }

  const totalFiltered = filteredComplaints.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;

  // Bound currentPage
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedComplaints = filteredComplaints.slice(startIndex, startIndex + itemsPerPage);

  // 3. Populate Table Body
  renderTable(paginatedComplaints);

  // 4. Update Pagination text and buttons
  updatePaginationControls(startIndex, paginatedComplaints.length, totalFiltered, currentPage, totalPages);
}

/**
 * Helper to update numeric values inside the KPI stat cards.
 */
function updateStatCard(cardId, value) {
  const card = document.getElementById(cardId);
  if (card) {
    const numDiv = card.querySelector('div');
    if (numDiv) numDiv.textContent = value;
  }
}

/**
 * Renders rows into the complaints table body with Action buttons.
 */
function renderTable(list) {
  const tableBody = document.querySelector('#complaintTable tbody');
  if (!tableBody) return;

  if (list.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-eco-muted">
          <i class="bi bi-chat-left-text fs-3 mb-2 d-block"></i>
          No complaints found matching this status.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = list.map(c => {
    // Priority badges
    let priorityBadge = '';
    if (c.priority === 'critical') priorityBadge = '<span class="badge bg-danger">Critical</span>';
    else if (c.priority === 'high') priorityBadge = '<span class="badge bg-warning text-dark">High</span>';
    else if (c.priority === 'medium') priorityBadge = '<span class="badge bg-info text-dark">Medium</span>';
    else priorityBadge = '<span class="badge bg-secondary">Low</span>';

    // Status badges
    let statusBadge = '';
    if (c.status === 'resolved') statusBadge = '<span class="badge bg-success">Resolved</span>';
    else if (c.status === 'in-progress') statusBadge = '<span class="badge bg-warning text-dark">In Progress</span>';
    else statusBadge = '<span class="badge bg-danger">Pending</span>';

    // Formatted date
    const dateObj = c.createdAt ? new Date(c.createdAt) : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return `
      <tr class="complaint-row align-middle">
        <td style="color: var(--accent); font-weight: 600;">${c.id}</td>
        <td class="text-eco">${c.category}</td>
        <td class="text-eco-muted">${c.zone}</td>
        <td>${priorityBadge}</td>
        <td>${statusBadge}</td>
        <td class="text-eco-muted" style="font-size: 0.82rem;">${formattedDate}</td>
        <td class="text-end">
          <div class="d-flex gap-1 justify-content-end">
            <button class="btn btn-sm btn-eco-outline py-1 px-2" onclick="openEditModal('${c.id}')" title="Edit / Update Status">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger py-1 px-2" onclick="deleteComplaint('${c.id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Manages disabled states of pagination buttons and info text labels.
 */
function updatePaginationControls(start, count, total, current, maxPages) {
  const label = document.querySelector('.table-responsive').nextElementSibling.querySelector('span');
  if (label) {
    label.textContent = total > 0 
      ? `Showing ${start + 1} to ${start + count} of ${total} complaints`
      : 'Showing 0 complaints';
  }

  const prevBtn = document.getElementById('prevComplaintsBtn');
  const nextBtn = document.getElementById('nextComplaintsBtn');

  if (prevBtn) prevBtn.disabled = (current <= 1);
  if (nextBtn) nextBtn.disabled = (current >= maxPages);
}

/**
 * Handles validation, submits new complaints, and hooks modal/filters.
 */
function setupFormBindings() {
  // 1. Submit Complaint
  const form = document.getElementById('newComplaintForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      // Collect data fields
      const complaintData = {
        name:        document.getElementById('cmpName').value.trim(),
        email:       document.getElementById('cmpEmail').value.trim(),
        phone:       document.getElementById('cmpPhone').value.trim(),
        category:    document.getElementById('cmpCategory').value,
        zone:        document.getElementById('cmpZone').value,
        location:    document.getElementById('cmpLocation').value.trim() || 'Not specified',
        priority:    document.getElementById('cmpPriority').value,
        description: document.getElementById('cmpDescription').value.trim(),
      };

      // Add using SwmsDB domain wrapper
      const success = SwmsDB.complaints.add(complaintData);

      if (success) {
        form.reset();
        form.classList.remove('was-validated');
        currentPage = 1; // Go to first page to see the fresh record
        renderComplaintsPage();

        if (window.SwmsToast) {
          window.SwmsToast.show('Complaint submitted successfully!', 'success');
        }
      } else {
        if (window.SwmsToast) {
          window.SwmsToast.show('Failed to save complaint.', 'error');
        }
      }
    });
  }

  // 2. Filter Status Select Element
  const filterSelect = document.getElementById('filterCmpStatus');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      currentPage = 1;
      renderComplaintsPage();
    });
  }

  // 3. Edit Form Submission
  const editForm = document.getElementById('editComplaintForm');
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const id = document.getElementById('editCmpIdField').value;
      const patch = {
        category:    document.getElementById('editCmpCategory').value,
        zone:        document.getElementById('editCmpZone').value,
        location:    document.getElementById('editCmpLocation').value.trim(),
        priority:    document.getElementById('editCmpPriority').value,
        status:      document.getElementById('editCmpStatus').value,
        description: document.getElementById('editCmpDescription').value.trim(),
        resolution:  document.getElementById('editCmpResolution').value.trim() || null
      };

      const success = SwmsDB.complaints.update(id, patch);

      if (success) {
        if (editModal) editModal.hide();
        renderComplaintsPage();
        if (window.SwmsToast) {
          window.SwmsToast.show(`Complaint ${id} updated!`, 'success');
        }
      } else {
        if (window.SwmsToast) {
          window.SwmsToast.show('Failed to update complaint.', 'error');
        }
      }
    });
  }

  // 4. Modal resolved trigger to show/hide resolution textarea dynamically
  const statusSelect = document.getElementById('editCmpStatus');
  const resolutionGroup = document.getElementById('resolutionGroup');
  if (statusSelect && resolutionGroup) {
    statusSelect.addEventListener('change', (e) => {
      if (e.target.value === 'resolved') {
        resolutionGroup.classList.remove('d-none');
      } else {
        resolutionGroup.classList.add('d-none');
      }
    });
  }
}

/**
 * Binds page buttons to scroll & update page index.
 */
function setupPaginationHandlers() {
  const prevBtn = document.getElementById('prevComplaintsBtn');
  const nextBtn = document.getElementById('nextComplaintsBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderComplaintsPage();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage++;
      renderComplaintsPage();
    });
  }
}

/**
 * Open edit modal loaded with a single complaint record's values.
 */
window.openEditModal = function(id) {
  const complaint = SwmsDB.complaints.getById(id);
  if (!complaint) return;

  // Set modal texts & fields
  document.getElementById('editCmpId').textContent = `(${id})`;
  document.getElementById('editCmpIdField').value = id;
  document.getElementById('editCmpCategory').value = complaint.category;
  document.getElementById('editCmpZone').value = complaint.zone;
  document.getElementById('editCmpLocation').value = complaint.location || '';
  document.getElementById('editCmpPriority').value = complaint.priority || 'medium';
  document.getElementById('editCmpStatus').value = complaint.status;
  document.getElementById('editCmpDescription').value = complaint.description || '';
  document.getElementById('editCmpResolution').value = complaint.resolution || '';

  // Show resolution textbox if status resolved
  const resolutionGroup = document.getElementById('resolutionGroup');
  if (resolutionGroup) {
    if (complaint.status === 'resolved') {
      resolutionGroup.classList.remove('d-none');
    } else {
      resolutionGroup.classList.add('d-none');
    }
  }

  if (editModal) editModal.show();
};

/**
 * Delete a complaint completely after user confirmation.
 */
window.deleteComplaint = function(id) {
  if (confirm(`Are you sure you want to delete complaint ${id}?`)) {
    const success = SwmsDB.complaints.delete(id);
    if (success) {
      renderComplaintsPage();
      if (window.SwmsToast) {
        window.SwmsToast.show(`Complaint ${id} has been deleted.`, 'warning');
      }
    } else {
      if (window.SwmsToast) {
        window.SwmsToast.show('Failed to delete complaint.', 'error');
      }
    }
  }
};
