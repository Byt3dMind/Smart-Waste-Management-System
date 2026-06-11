/* ============================================================
   SMART WASTE COLLECTION SYSTEM — Global JavaScript
   ============================================================ */

'use strict';

/* ── Navbar scroll shadow ─────────────────────────────── */
(function () {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── Active nav link highlight ────────────────────────── */
(function () {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href === page || (page === '' && href === 'index.html'))) {
      link.classList.add('active');
      // Also open parent dropdown if nested
      const parentDropdown = link.closest('.dropdown');
      if (parentDropdown) {
        const toggle = parentDropdown.querySelector('.nav-link.dropdown-toggle');
        if (toggle) toggle.classList.add('active');
      }
    }
  });
})();

/* ── Smooth scroll for anchor links ───────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── Animate elements on scroll (Intersection Observer) ─ */
(function () {
  const els = document.querySelectorAll('.eco-card, .animate-on-scroll');
  if (!els.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-up');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => observer.observe(el));
})();

/* ── Toast notification utility ───────────────────────── */
window.SwmsToast = {
  show(message, type = 'success') {
    const wrap = document.getElementById('toastContainer') || (() => {
      const d = document.createElement('div');
      d.id = 'toastContainer';
      d.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(d);
      return d;
    })();

    const colors = {
      success: '#22c55e',
      warning: '#f59e0b',
      error:   '#ef4444',
      info:    '#38bdf8',
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      background: #111918;
      border: 1px solid ${colors[type] || colors.info}55;
      border-left: 3px solid ${colors[type] || colors.info};
      color: #f0fdf4;
      padding: 0.75rem 1.25rem;
      border-radius: 10px;
      font-size: 0.875rem;
      font-family: Inter, sans-serif;
      font-weight: 500;
      max-width: 320px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      animation: slideInRight 0.3s ease;
      cursor: pointer;
    `;
    toast.textContent = message;
    toast.addEventListener('click', () => toast.remove());
    wrap.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

/* ── localStorage helper ──────────────────────────────── */
window.SwmsStorage = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { localStorage.removeItem(key); },
  clear()     { localStorage.clear(); },
};

/* ── Current year in footer ───────────────────────────── */
document.querySelectorAll('.footer-year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

/* ── Dynamically load Notifications system ────────────── */
(function loadNotificationsSystem() {
  const s = document.createElement('script');
  s.src = 'js/notifications.js';
  s.defer = true;
  document.body.appendChild(s);
})();

/* ── Live Premium Features Injection (Theme Switcher, Loading Screen) ── */
(function injectPremiumUI() {
  // 1. Injects fullscreen global spinner
  const loader = document.createElement('div');
  loader.className = 'global-page-loader';
  loader.id = 'globalLoader';
  loader.innerHTML = `
    <div class="eco-spinner mb-3"></div>
    <span style="color:var(--accent); font-weight:700; font-family:'Poppins',sans-serif; letter-spacing:0.5px; font-size:0.95rem;">♻️ SmartWaste City Hub</span>
  `;
  document.body.appendChild(loader);

  // Fade out loader smoothly once page loaded
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('loaded');
      setTimeout(() => {
        loader.remove();
        // Trigger page counter animations once loading completes!
        animateCounters();
      }, 500);
    }, 300);
  });

  // 2. Injects Theme Toggler
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'theme-toggle-floating';
  toggleBtn.id = 'themeToggleBtn';
  toggleBtn.title = 'Toggle Dark/Light Mode';
  
  // Set initial icon based on localStorage
  const savedTheme = localStorage.getItem('swms_theme') || 'dark';
  const isLight = savedTheme === 'light';
  if (isLight) {
    document.documentElement.classList.add('light-theme');
    toggleBtn.innerHTML = '🌙'; // moon icon indicates click to switch back to dark
  } else {
    toggleBtn.innerHTML = '☀️'; // sun icon indicates click to switch to light
  }

  // Bind click toggle action
  toggleBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const isLightNow = html.classList.toggle('light-theme');
    
    if (isLightNow) {
      localStorage.setItem('swms_theme', 'light');
      toggleBtn.innerHTML = '🌙';
      if (window.SwmsToast) window.SwmsToast.show('Switched to Eco-Light Theme!', 'success');
    } else {
      localStorage.setItem('swms_theme', 'dark');
      toggleBtn.innerHTML = '☀️';
      if (window.SwmsToast) window.SwmsToast.show('Switched to Eco-Dark Theme!', 'success');
    }
  });

  document.body.appendChild(toggleBtn);
})();

/* ── Live Premium Count-Up Counter Animation System ── */
window.animateCounters = function() {
  document.querySelectorAll('.kpi-value, .counter-animate, [id^="rKpi"] div, [id^="fleetStat"] div, [id^="cmpStat"] div').forEach(el => {
    const rawText = el.textContent.trim();
    
    // Parse value extraction (handling units like km, T, L, etc.)
    const matches = rawText.match(/^([₹]?)([\d,.]+)([%\sTLLhrs]*)$/);
    if (!matches) return;

    const prefix = matches[1] || '';
    const numericPartStr = matches[2].replace(/,/g, '');
    const suffix = matches[3] || '';

    const targetVal = parseFloat(numericPartStr);
    if (isNaN(targetVal)) return;

    const isDecimal = numericPartStr.includes('.');
    let currentVal = 0;
    
    // Animation duration details
    const steps = 40; 
    const increment = targetVal / steps;
    let stepCount = 0;

    const update = () => {
      stepCount++;
      currentVal += increment;
      
      if (stepCount >= steps || currentVal >= targetVal) {
        el.textContent = prefix + (isDecimal ? targetVal.toFixed(1) : Math.round(targetVal).toLocaleString()) + suffix;
      } else {
        el.textContent = prefix + (isDecimal ? currentVal.toFixed(1) : Math.round(currentVal).toLocaleString()) + suffix;
        requestAnimationFrame(update);
      }
    };
    
    update();
  });
};

console.info('%c♻ SmartWaste System Loaded', 'color:#4ade80;font-weight:700;font-size:14px;');
