/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI ADMIN — Core Utilities
   admin-core.js
   ═══════════════════════════════════════════════════════════ */

'use strict';

const API = 'http://localhost:5000/api';
const WS  = 'http://localhost:5000';

/* ─────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────── */
const AdminAuth = {
  TOKEN_KEY: 'nr_admin_token',
  USER_KEY:  'nr_admin_user',

  token()    { return localStorage.getItem(this.TOKEN_KEY); },
  user()     { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); },
  loggedIn() { return !!this.token(); },

  save(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    location.href = '/admin-panel/login';
  },

  headers() {
    return {
      'Content-Type': 'application/json',
      ...(this.token() ? { 'Authorization': `Bearer ${this.token()}` } : {})
    };
  }
};

/* ─────────────────────────────────────────────────────────
   API HELPER
───────────────────────────────────────────────────────── */
async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: AdminAuth.headers() };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(`${API}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  } catch (err) {
    if (err.message.includes('401')) AdminAuth.logout();
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────── */
const Toast = {
  _stack: null,
  _get() {
    if (!this._stack) {
      this._stack = Object.assign(document.createElement('div'), { className: 'toast-stack' });
      document.body.appendChild(this._stack);
    }
    return this._stack;
  },
  show(msg, type = 'success') {
    const icons = { success: 'fa-check-circle', err: 'fa-times-circle', warn: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${icons[type]||icons.success} toast-icon" style="color:${type==='err'?'var(--red)':type==='warn'?'var(--amber)':type==='info'?'var(--blue)':'var(--green)'}"></i>${msg}`;
    this._get().appendChild(t);
    setTimeout(() => { t.classList.add('toast-exit'); setTimeout(() => t.remove(), 280); }, 3500);
  }
};

/* ─────────────────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open');    document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); document.body.style.overflow = ''; }

/* ─────────────────────────────────────────────────────────
   FORMATTERS
───────────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtRupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

/* ─────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────── */
const STATUS_MAP = {
  pending:          { label: 'Pending',         cls: 'badge-amber'  },
  confirmed:        { label: 'Confirmed',       cls: 'badge-blue'   },
  preparing:        { label: 'Preparing',       cls: 'badge-purple' },
  out_for_delivery: { label: 'Out for Delivery',cls: 'badge-blue'   },
  delivered:        { label: 'Delivered',       cls: 'badge-green'  },
  cancelled:        { label: 'Cancelled',       cls: 'badge-red'    },
};

function statusBadge(s) {
  const m = STATUS_MAP[s] || { label: s, cls: 'badge-dim' };
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

/* ─────────────────────────────────────────────────────────
   NOTIFICATIONS (Socket.IO + polling fallback)
───────────────────────────────────────────────────────── */
const Notifications = {
  list: JSON.parse(localStorage.getItem('nr_admin_notifs') || '[]'),
  socket: null,
  unreadCount: 0,

  init() {
    this.unreadCount = this.list.filter(n => !n.read).length;
    this._updateBadge();

    // Try Socket.IO
    if (window.io) {
      try {
        this.socket = io(WS);
        this.socket.emit('join_admin');
        this.socket.on('new_order', data => {
          this.add({
            id: Date.now(),
            type: 'order',
            msg: `New order ${data.order_number} — ${fmtRupee(data.total_amount)}`,
            time: new Date().toISOString(),
            read: false,
            data
          });
          // Refresh orders list if visible
          if (typeof refreshOrders === 'function') refreshOrders();
        });
        console.log('[WS] Socket.IO connected');
      } catch (e) { console.warn('[WS] Socket.IO failed, using polling'); this._startPolling(); }
    } else {
      this._startPolling();
    }
  },

  _startPolling() {
    // Poll for new orders every 30s
    setInterval(async () => {
      try {
        const data = await api('/analytics/dashboard');
        if (data.pending_orders > (this._lastPending || 0)) {
          this.add({ id: Date.now(), type: 'order', msg: `${data.pending_orders} pending order(s) need attention`, time: new Date().toISOString(), read: false });
        }
        this._lastPending = data.pending_orders;
      } catch {}
    }, 30000);
  },

  add(notif) {
    this.list.unshift(notif);
    if (this.list.length > 50) this.list.pop();
    this.unreadCount++;
    this._updateBadge();
    this._save();
    this._renderPanel();
    Toast.show(notif.msg, 'info');
  },

  markAllRead() {
    this.list.forEach(n => n.read = true);
    this.unreadCount = 0;
    this._updateBadge();
    this._save();
    this._renderPanel();
  },

  _updateBadge() {
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = this.unreadCount > 0 ? '' : 'none';
    const cnt = document.getElementById('notifCount');
    if (cnt) cnt.textContent = this.unreadCount || '';
  },

  _save() { localStorage.setItem('nr_admin_notifs', JSON.stringify(this.list)); },

  _renderPanel() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!this.list.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><p>No notifications yet</p></div>`;
      return;
    }
    list.innerHTML = this.list.slice(0, 20).map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="Notifications.markAllRead()">
        <div class="notif-dot-wrap"><i class="fas fa-${n.type === 'order' ? 'receipt' : 'bell'}"></i></div>
        <div>
          <div class="notif-msg">${n.msg}</div>
          <div class="notif-time">${fmtDateTime(n.time)}</div>
        </div>
      </div>`).join('');
  },

  togglePanel() {
    const p = document.getElementById('notifPanel');
    if (!p) return;
    const open = p.classList.toggle('open');
    if (open) { this._renderPanel(); }
  }
};

/* ─────────────────────────────────────────────────────────
   CHARTS (Chart.js wrapper)
───────────────────────────────────────────────────────── */
const Charts = {
  _instances: {},

  _defaults() {
    return {
      animation: { duration: 600 },
      plugins: {
        legend: { labels: { color: '#a8c5aa', font: { family: 'DM Mono', size: 11 }, padding: 14 } },
        tooltip: {
          backgroundColor: '#141e14',
          borderColor: '#243424',
          borderWidth: 1,
          titleColor: '#e8f5e9',
          bodyColor: '#a8c5aa',
          titleFont: { family: 'DM Mono', size: 11 },
          bodyFont:  { family: 'DM Mono', size: 11 },
          padding: 10,
          cornerRadius: 6,
        }
      },
      scales: {
        x: {
          ticks:  { color: '#5a8a5d', font: { family: 'DM Mono', size: 10 } },
          grid:   { color: '#1e2e1e' },
        },
        y: {
          ticks:  { color: '#5a8a5d', font: { family: 'DM Mono', size: 10 } },
          grid:   { color: '#1e2e1e' },
          beginAtZero: true,
        }
      }
    };
  },

  line(canvasId, labels, datasets, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this._instances[canvasId]) this._instances[canvasId].destroy();
    this._instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: datasets.map(d => ({
        tension: 0.4,
        fill: true,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        ...d
      }))},
      options: { ...this._defaults(), responsive: true, maintainAspectRatio: false, ...opts }
    });
  },

  bar(canvasId, labels, datasets, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this._instances[canvasId]) this._instances[canvasId].destroy();
    this._instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: datasets.map(d => ({ borderRadius: 4, ...d })) },
      options: { ...this._defaults(), responsive: true, maintainAspectRatio: false, ...opts }
    });
  },

  doughnut(canvasId, labels, data, colors, opts = {}) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (this._instances[canvasId]) this._instances[canvasId].destroy();
    const def = this._defaults();
    this._instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#0a0f0a', borderWidth: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { ...def.plugins },
        cutout: '65%',
        ...opts
      }
    });
  }
};

/* ─────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────── */
function navigate(section) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById(`sec-${section}`);
  if (sec) sec.classList.add('active');
  const nav = document.getElementById(`nav-${section}`);
  if (nav) nav.classList.add('active');

  document.getElementById('topbarTitle').textContent = {
    dashboard:  'Dashboard',
    orders:     'Order Management',
    products:   'Product Management',
    customers:  'Customer Management',
    analytics:  'Analytics & Reports',
  }[section] || 'Admin Panel';

  // Lazy-load section data
  if (section === 'dashboard')  loadDashboard();
  if (section === 'orders')     loadOrders();
  if (section === 'products')   loadProducts();
  if (section === 'customers')  loadCustomers();
  if (section === 'analytics')  loadAnalytics();
}