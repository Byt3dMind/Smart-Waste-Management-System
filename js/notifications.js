/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Notification System (notifications.js)
   Triggers alerts for high-fill bins, inactive vehicles, and new
   complaints. Stores history in localStorage and injects a live
   interactive bell center in the site-wide Bootstrap navbar.
   ============================================================ */

'use strict';

// Storage keys specifically for notifications tracker states
const NOTIF_KEYS = {
  LIST:          'swms_notifications',
  NOTIFIED_BINS: 'swms_notified_bins',
  NOTIFIED_VEHS: 'swms_notified_vehicles',
  LAST_CMP_COUNT: 'swms_last_complaint_count'
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inject the Notification Bell Center dropdown dynamically into the nav link list
  injectNotificationBell();

  // 2. Render initial notifications list
  refreshNotificationList();

  // 3. Mount periodic background checks (every 3.5 seconds)
  startNotificationChecks();
});

/**
 * Automatically modifies the active navbar on load to mount a glowing notification bell.
 */
function injectNotificationBell() {
  const navList = document.querySelector('#navbarMain ul');
  if (!navList) return;

  // Insert just before the Contact button (last element)
  const bellLi = document.createElement('li');
  bellLi.className = 'nav-item dropdown ms-lg-2 position-relative';
  bellLi.id = 'navNotificationCenter';
  bellLi.innerHTML = `
    <a class="nav-link dropdown-toggle" href="#" id="bellDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="padding: 0.5rem; position: relative;">
      <i class="bi bi-bell fs-5"></i>
      <span class="position-absolute top-1 start-75 translate-middle badge rounded-pill bg-danger" id="notificationBadge" style="font-size: 0.55rem; padding: 0.25em 0.45em; display: none;">0</span>
    </a>
    <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end border-eco p-2" aria-labelledby="bellDropdown" style="background: var(--bg-card); min-width: 300px; max-height: 400px; overflow-y: auto; right: 0; margin-top: 10px;">
      <li class="d-flex justify-content-between align-items-center px-2 py-1 mb-2" style="border-bottom: 1px solid var(--border);">
        <span class="fw-bold" style="font-size: 0.85rem; color: var(--text-primary);">Notification Hub</span>
        <a href="#" class="text-accent" style="font-size: 0.75rem; text-decoration: none; font-weight: 600;" onclick="clearAllNotifications(event)">Clear All</a>
      </li>
      <div id="notificationList" class="d-flex flex-column gap-1">
        <!-- Rendered dynamically -->
      </div>
    </ul>
  `;

  // Inject before the contact button item
  const contactItem = navList.querySelector('.nav-item.ms-lg-2');
  if (contactItem) {
    navList.insertBefore(bellLi, contactItem);
  } else {
    navList.appendChild(bellLi);
  }

  // Inject CSS style override to hide the dropdown toggle arrow on the bell icon
  const style = document.createElement('style');
  style.textContent = `
    #bellDropdown::after { display: none !important; }
    .notification-item {
      background: var(--bg-card2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      font-size: 0.78rem;
      transition: border-color 0.2s;
    }
    .notification-item:hover { border-color: var(--border-hover); }
    .toast-container-custom {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Reads notifications and renders them in the dropdown, updating the badge.
 */
function refreshNotificationList() {
  const notifs = SwmsStorage.get(NOTIF_KEYS.LIST, []);
  const listDiv = document.getElementById('notificationList');
  const badge = document.getElementById('notificationBadge');

  if (!listDiv) return;

  // Update badge count
  const unreadCount = notifs.filter(n => !n.read).length;
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  if (notifs.length === 0) {
    listDiv.innerHTML = `
      <div class="text-center py-4 text-eco-muted" style="font-size: 0.8rem;">
        <i class="bi bi-bell-slash fs-4 d-block mb-1"></i>
        No recent notifications.
      </div>
    `;
    return;
  }

  listDiv.innerHTML = notifs.slice(0, 10).map(n => {
    let emoji = '🔔';
    if (n.type === 'bin') emoji = '🚨';
    else if (n.type === 'complaint') emoji = '📋';
    else if (n.type === 'vehicle') emoji = '🚛';

    const unreadStyle = !n.read ? 'border-left: 3px solid var(--accent);' : '';
    const dateText = new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="notification-item" style="${unreadStyle}">
        <div class="d-flex justify-content-between align-items-start gap-1">
          <span style="font-weight: 600; color: var(--text-primary);">${emoji} ${n.title}</span>
          <small class="text-eco-muted" style="font-size: 0.68rem; flex-shrink:0;">${dateText}</small>
        </div>
        <p class="mb-0 text-eco-muted mt-1" style="font-size: 0.74rem; line-height: 1.35;">${n.message}</p>
      </div>
    `;
  }).join('');

  // Mark all as read when dropdown is opened
  const bell = document.getElementById('bellDropdown');
  if (bell) {
    bell.addEventListener('click', () => {
      const current = SwmsStorage.get(NOTIF_KEYS.LIST, []);
      const readAll = current.map(n => ({ ...n, read: true }));
      SwmsStorage.set(NOTIF_KEYS.LIST, readAll);
      // Wait briefly before hiding badge for smooth UX
      setTimeout(() => {
        if (badge) badge.style.display = 'none';
      }, 800);
    });
  }
}

/**
 * Triggers a brand new notification, adds to local history, and renders Bootstrap Toast on-screen.
 */
function addNotification(type, title, message) {
  const notifs = SwmsStorage.get(NOTIF_KEYS.LIST, []);
  
  const newNotif = {
    id: 'NTF-' + Date.now(),
    type,
    title,
    message,
    time: new Date().toISOString(),
    read: false
  };

  notifs.unshift(newNotif); // newest first
  SwmsStorage.set(NOTIF_KEYS.LIST, notifs.slice(0, 30)); // Cap history at 30 items

  // Refresh nav bell listing
  refreshNotificationList();

  // Draw on-screen Bootstrap Toast alert
  showBootstrapToast(newNotif);
}

/**
 * Injects a Bootstrap Toast dynamically and displays it.
 */
function showBootstrapToast(notif) {
  // Ensure global Toast container is ready
  let wrap = document.getElementById('swmsToastContainer');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'swmsToastContainer';
    wrap.className = 'toast-container-custom';
    document.body.appendChild(wrap);
  }

  // Set visual details
  let color = '#22c55e'; // Green default
  let icon = 'bi-bell-fill';
  if (notif.type === 'bin') { color = '#ef4444'; icon = 'bi-exclamation-triangle-fill'; }
  else if (notif.type === 'vehicle') { color = '#f59e0b'; icon = 'bi-truck-flatbed'; }
  else if (notif.type === 'complaint') { color = '#38bdf8'; icon = 'bi-chat-left-text-fill'; }

  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.role = 'alert';
  toastEl.ariaLive = 'assertive';
  toastEl.ariaAtomic = 'true';
  toastEl.style.cssText = `
    background: #111918;
    border: 1px solid ${color}44;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    min-width: 290px;
  `;

  toastEl.innerHTML = `
    <div class="toast-header border-bottom border-secondary text-white" style="background: rgba(255,255,255,0.03);">
      <i class="bi ${icon} me-2" style="color: ${color};"></i>
      <strong class="me-auto">${notif.title}</strong>
      <small style="color: var(--text-muted);">Just now</small>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body text-eco-muted" style="font-size: 0.82rem; padding: 0.75rem 1rem;">
      ${notif.message}
    </div>
  `;

  wrap.appendChild(toastEl);

  // Initialize and show via Bootstrap Toast JS constructor
  const bsToast = new bootstrap.Toast(toastEl, { delay: 4500 });
  bsToast.show();

  // Cleanup DOM element after hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

/**
 * Evaluates state of localStorage to detect high bins, dead vehicles, and new complaints.
 */
function startNotificationChecks() {
  // Ensure last complaint count is seeded in tracker
  const complaints = SwmsDB.complaints.getAll();
  if (localStorage.getItem(NOTIF_KEYS.LAST_CMP_COUNT) === null) {
    localStorage.setItem(NOTIF_KEYS.LAST_CMP_COUNT, complaints.length);
  }

  // Periodic loop running every 4 seconds
  setInterval(() => {
    // 1. Bin Fill Check (Bin exceeds 80%)
    checkBinLevels();

    // 2. Vehicle Activity Check (Vehicle inactive)
    checkVehicleUptime();

    // 3. New Complaint Check (Complaints submitted)
    checkNewComplaints();
  }, 4000);
}

function checkBinLevels() {
  const bins = SwmsDB.bins.getAll();
  const notifiedBins = SwmsStorage.get(NOTIF_KEYS.NOTIFIED_BINS, []);
  let nextNotified = [...notifiedBins];
  let stateChanged = false;

  bins.forEach(bin => {
    const isHigh = bin.fillLevel >= 80 || bin.status === 'full' || bin.status === 'near-full';
    const isNotified = notifiedBins.includes(bin.id);

    if (isHigh && !isNotified) {
      // Trigger new notification
      addNotification(
        'bin',
        'Capacity Warning!',
        `Smart Bin ${bin.id} on ${bin.location} is at ${bin.fillLevel}% capacity and requires clearing.`
      );
      nextNotified.push(bin.id);
      stateChanged = true;
    } else if (!isHigh && isNotified) {
      // Cleared out of active warnings if emptied
      nextNotified = nextNotified.filter(id => id !== bin.id);
      stateChanged = true;
    }
  });

  if (stateChanged) {
    SwmsStorage.set(NOTIF_KEYS.NOTIFIED_BINS, nextNotified);
  }
}

function checkVehicleUptime() {
  const vehicles = SwmsDB.vehicles.getAll();
  const notifiedVehicles = SwmsStorage.get(NOTIF_KEYS.NOTIFIED_VEHS, []);
  let nextNotified = [...notifiedVehicles];
  let stateChanged = false;

  vehicles.forEach(v => {
    const isInactive = v.status !== 'active';
    const isNotified = notifiedVehicles.includes(v.id);

    if (isInactive && !isNotified) {
      addNotification(
        'vehicle',
        'Fleet Status Change',
        `Vehicle ${v.id} (${v.name}) is currently ${v.status} in ${v.currentZone}.`
      );
      nextNotified.push(v.id);
      stateChanged = true;
    } else if (!isInactive && isNotified) {
      // Back online
      nextNotified = nextNotified.filter(id => id !== v.id);
      stateChanged = true;
    }
  });

  if (stateChanged) {
    SwmsStorage.set(NOTIF_KEYS.NOTIFIED_VEHS, nextNotified);
  }
}

function checkNewComplaints() {
  const complaints = SwmsDB.complaints.getAll();
  const lastCount = parseInt(localStorage.getItem(NOTIF_KEYS.LAST_CMP_COUNT) || '0', 10);

  if (complaints.length > lastCount) {
    // New complaints have been pushed to the top of complaints array
    const diff = complaints.length - lastCount;
    const newItems = complaints.slice(0, diff);

    newItems.forEach(c => {
      addNotification(
        'complaint',
        'New Complaint Received',
        `Complaint ${c.id} submitted in ${c.zone} regarding '${c.category}' by ${c.name}.`
      );
    });

    localStorage.setItem(NOTIF_KEYS.LAST_CMP_COUNT, complaints.length);
  } else if (complaints.length < lastCount) {
    // Sync down if a complaint was deleted
    localStorage.setItem(NOTIF_KEYS.LAST_CMP_COUNT, complaints.length);
  }
}

/**
 * Clear notification dropdown list history completely.
 */
window.clearAllNotifications = function(e) {
  if (e) e.preventDefault();
  SwmsStorage.set(NOTIF_KEYS.LIST, []);
  refreshNotificationList();
  if (window.SwmsToast) {
    window.SwmsToast.show('Notification logs cleared!', 'info');
  }
};
