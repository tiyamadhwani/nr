/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI — Core JS Utilities
   app.js — loaded on every page
   ═══════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = '/api';

/* ─────────────────────────────────────────────────────────
   THEME
───────────────────────────────────────────────────────── */
const Theme = {
  init() {
    const saved = localStorage.getItem('nr_theme') || 'light';
    this.apply(saved);
  },
  apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('nr_theme', t);
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = t === 'dark'
        ? '<i class="fas fa-sun"></i><span>Light</span>'
        : '<i class="fas fa-moon"></i><span>Dark</span>';
    }
  },
  toggle() {
    const cur = localStorage.getItem('nr_theme') || 'light';
    this.apply(cur === 'dark' ? 'light' : 'dark');
  }
};

/* ─────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────── */
const Auth = {
  TOKEN_KEY: 'nr_token',
  USER_KEY:  'nr_user',

  token()   { return localStorage.getItem(this.TOKEN_KEY); },
  user()    { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); },
  loggedIn(){ return !!this.token(); },

  save(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = '/';
  },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token()) h['Authorization'] = `Bearer ${this.token()}`;
    return h;
  },

  updateNavUI() {
    const user = this.user();
    const loginBtn  = document.getElementById('authBtn');
    const userWrap  = document.getElementById('userMenuWrap');
    if (!loginBtn && !userWrap) return;

    if (user) {
      if (loginBtn)  loginBtn.style.display  = 'none';
      if (userWrap) {
        userWrap.style.display = 'flex';
        const nameEl = userWrap.querySelector('.user-name');
        if (nameEl) nameEl.textContent = user.name.split(' ')[0];
      }
    } else {
      if (loginBtn)  loginBtn.style.display  = '';
      if (userWrap)  userWrap.style.display   = 'none';
    }
  }
};

/* ─────────────────────────────────────────────────────────
   API HELPER
───────────────────────────────────────────────────────── */
async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: Auth.headers() };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ─────────────────────────────────────────────────────────
   CART
───────────────────────────────────────────────────────── */
const Cart = {
  KEY: 'nr_cart',

  get()        { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); },
  _save(items) { localStorage.setItem(this.KEY, JSON.stringify(items)); this._updateBadge(); },

  add(product, qty = 0.25) {
    const items = this.get();
    const idx   = items.findIndex(i => i.id === product.id);
    if (idx > -1) {
      items[idx].qty = parseFloat((items[idx].qty + qty).toFixed(2));
    } else {
      items.push({ ...product, qty: parseFloat(qty.toFixed(2)) });
    }
    this._save(items);
    Toast.show(`${product.name} added to cart`);
  },

  remove(id) {
    this._save(this.get().filter(i => i.id !== id));
  },

  setQty(id, qty) {
    if (parseFloat(qty) <= 0) return this.remove(id);
    const items = this.get();
    const idx   = items.findIndex(i => i.id === id);
    if (idx > -1) { items[idx].qty = parseFloat(parseFloat(qty).toFixed(2)); this._save(items); }
  },

  clear()     { localStorage.removeItem(this.KEY); this._updateBadge(); },
  count()     { return this.get().reduce((s, i) => s + i.qty, 0); },
  subtotal()  { return this.get().reduce((s, i) => s + i.price_per_unit * i.qty, 0); },
  delivery()  { return this.subtotal() >= 300 ? 0 : 30; },
  total()     { return this.subtotal() + this.delivery(); },

  _updateBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const n = Math.round(this.count());
    badge.textContent = n > 99 ? '99+' : n;
    badge.style.display = n > 0 ? 'flex' : 'none';
  }
};

/* ─────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────── */
const Toast = {
  _stack: null,

  _getStack() {
    if (!this._stack) {
      this._stack = document.createElement('div');
      this._stack.className = 'toast-stack';
      document.body.appendChild(this._stack);
    }
    return this._stack;
  },

  show(msg, type = 'success') {
    const icons = { success: 'fa-check', error: 'fa-times', warning: 'fa-exclamation', info: 'fa-info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon"><i class="fas ${icons[type] || 'fa-check'}"></i></div>
      <div class="toast-msg">${msg}</div>`;
    this._getStack().appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 320);
    }, 3200);
  }
};

/* ─────────────────────────────────────────────────────────
   CART DRAWER
───────────────────────────────────────────────────────── */
const CartDrawer = {
  open() {
    this.render();
    document.getElementById('cartBackdrop')?.classList.add('open');
    document.getElementById('cartDrawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  close() {
    document.getElementById('cartBackdrop')?.classList.remove('open');
    document.getElementById('cartDrawer')?.classList.remove('open');
    document.body.style.overflow = '';
  },
  render() {
    const items    = Cart.get();
    const itemsEl  = document.getElementById('cartItemsList');
    const emptyEl  = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');
    if (!itemsEl) return;

    if (items.length === 0) {
      itemsEl.innerHTML  = '';
      if (emptyEl)  emptyEl.style.display  = 'flex';
      if (footerEl) footerEl.style.display = 'none';
      return;
    }

    if (emptyEl)  emptyEl.style.display  = 'none';
    if (footerEl) footerEl.style.display = 'block';

    itemsEl.innerHTML = items.map(item => `
      <div class="cart-item" id="ci-${item.id}">
        <img class="cart-item-img"
             src="${item.image_url || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&q=60'}"
             alt="${item.name}"
             onerror="this.src='https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&q=60'">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">Rs.${item.price_per_unit}/${item.unit}</div>
          <div class="qty-ctrl" style="margin-top:6px;">
            <button class="qty-btn" onclick="CartDrawer.changeQty(${item.id}, ${item.qty - 0.25})">−</button>
            <span class="qty-val">${item.qty} ${item.unit}</span>
            <button class="qty-btn" onclick="CartDrawer.changeQty(${item.id}, ${item.qty + 0.25})">+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div class="cart-item-total">Rs.${(item.price_per_unit * item.qty).toFixed(0)}</div>
          <button class="cart-item-remove" onclick="CartDrawer.removeItem(${item.id})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    `).join('');

    const sub = Cart.subtotal(), del = Cart.delivery(), tot = Cart.total();

    const subEl  = document.getElementById('cartSubtotal');
    const delEl  = document.getElementById('cartDelivery');
    const totEl  = document.getElementById('cartTotal');
    const msgEl  = document.getElementById('cartDeliveryMsg');

    if (subEl) subEl.textContent = `Rs.${sub.toFixed(0)}`;
    if (delEl) delEl.textContent = del === 0 ? 'FREE' : `Rs.${del}`;
    if (totEl) totEl.textContent = `Rs.${tot.toFixed(0)}`;
    if (msgEl) msgEl.textContent = sub < 300
      ? `Add Rs.${(300 - sub).toFixed(0)} more for free delivery!`
      : 'You have free delivery on this order!';
  },
  changeQty(id, newQty) {
    Cart.setQty(id, Math.max(0, newQty));
    this.render();
  },
  removeItem(id) {
    Cart.remove(id);
    this.render();
  }
};

/* ─────────────────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); document.body.style.overflow = ''; }

/* ─────────────────────────────────────────────────────────
   CHATBOT
───────────────────────────────────────────────────────── */
const Chatbot = {
  open:   false,
  recognition: null,

  toggle() {
    this.open = !this.open;
    document.getElementById('chatWindow')?.classList.toggle('open', this.open);
  },

  async send() {
    const input = document.getElementById('chatInput');
    const msg   = input?.value.trim();
    if (!msg) return;
    this.addMsg(msg, 'user');
    input.value = '';
    this.addMsg('...', 'bot', 'chat-typing');
    try {
      const data = await api('/chatbot/message', 'POST', { message: msg });
      document.querySelector('.chat-typing')?.remove();
      this.addMsg(data.reply, 'bot');
      if (data.products_found?.length) {
        const preview = data.products_found
          .map(p => `${p.name} – Rs.${p.price}/${p.unit}`)
          .join('\n');
        this.addMsg(`Found:\n${preview}`, 'bot');
      }
    } catch {
      document.querySelector('.chat-typing')?.remove();
      this.addMsg('Sorry, could not connect. Please try again.', 'bot');
    }
  },

  addMsg(text, from, extra = '') {
    const msgs = document.getElementById('chatMsgs');
    if (!msgs) return;
    const d = document.createElement('div');
    d.className = `chat-msg ${from} ${extra}`;
    d.innerHTML = `<div class="chat-bubble">${text.replace(/\n/g,'<br>')}</div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  },

  startVoice() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { Toast.show('Voice input not supported in this browser', 'warning'); return; }
    const btn = document.getElementById('voiceBtn');
    if (this.recognition) { this.recognition.stop(); return; }
    this.recognition = new Rec();
    this.recognition.lang = 'hi-IN';
    this.recognition.interimResults = false;
    btn?.classList.add('listening');
    this.recognition.start();
    this.recognition.onresult = e => {
      const t = e.results[0][0].transcript;
      const inp = document.getElementById('chatInput');
      if (inp) { inp.value = t; this.send(); }
    };
    this.recognition.onend  = () => { btn?.classList.remove('listening'); this.recognition = null; };
    this.recognition.onerror= () => { btn?.classList.remove('listening'); this.recognition = null; Toast.show('Could not hear clearly. Try again.', 'warning'); };
  }
};

/* ─────────────────────────────────────────────────────────
   LIVE SEARCH
───────────────────────────────────────────────────────── */
let _searchTimer;
function initSearch(inputId, dropId, allProductsRef) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { closeDropdown(dropId); return; }
    _searchTimer = setTimeout(() => doSearch(q, dropId, allProductsRef), 380);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) window.location.href = `/products?q=${encodeURIComponent(q)}`;
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-search') && !e.target.closest('#'+dropId)) closeDropdown(dropId);
  });
}

async function doSearch(q, dropId, allProductsRef) {
  const drop = document.getElementById(dropId);
  if (!drop) return;
  drop.classList.remove('hidden');
  drop.innerHTML = '<div style="padding:16px;text-align:center;"><div class="spinner spinner-sm" style="margin:0 auto;"></div></div>';

  try {
    const data = await api(`/search/?q=${encodeURIComponent(q)}`);
    if (!data.results_found) {
      drop.innerHTML = `<div class="search-no-results">No results for "<strong>${q}</strong>"<br><span style="font-size:.78rem;">We've noted your request!</span></div>`;
    } else {
      drop.innerHTML = data.products.slice(0, 6).map(p => `
        <div class="search-result-item" onclick="quickAddFromSearch(${JSON.stringify(p).replace(/"/g,'&quot;')})">
          <img class="search-result-img"
               src="${p.image_url || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=80&q=50'}"
               alt="${p.name}"
               onerror="this.src='https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=80&q=50'">
          <div style="flex:1;">
            <div class="search-result-name">${p.name} <span style="font-family:var(--font-hindi);font-size:.75rem;color:var(--text-muted);">${p.name_hi||''}</span></div>
            <div class="search-result-price">Rs.${p.price_per_unit} / ${p.unit}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();Cart.add(${JSON.stringify(p).replace(/"/g,'&quot;')},0.25)">Add</button>
        </div>
      `).join('');
      if (allProductsRef) {
        data.products.forEach(p => { if (!allProductsRef.find(x => x.id === p.id)) allProductsRef.push(p); });
      }
    }
  } catch { drop.innerHTML = '<div class="search-no-results">Search error. Please try again.</div>'; }
}

function quickAddFromSearch(product) {
  Cart.add(product, 0.25);
}

function closeDropdown(id) {
  document.getElementById(id)?.classList.add('hidden');
}

/* ─────────────────────────────────────────────────────────
   PRODUCT CARD BUILDER
───────────────────────────────────────────────────────── */
// Standard quantity presets per unit type
function getQtyPresets(unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'kg' || u === '2kg')   return [{ label:'500g', val:0.5 }, { label:'1 kg', val:1 }, { label:'2 kg', val:2 }];
  if (u === '500g')                return [{ label:'500g', val:1 }, { label:'1 kg', val:2 }];
  if (u === '250g')                return [{ label:'250g', val:1 }, { label:'500g', val:2 }, { label:'1 kg', val:4 }];
  if (u === '200g')                return [{ label:'200g', val:1 }, { label:'400g', val:2 }];
  if (u === '100g')                return [{ label:'100g', val:1 }, { label:'250g', val:2.5 }];
  if (u === 'piece' || u === 'pcs')return [{ label:'1 pc', val:1 }, { label:'2 pcs', val:2 }, { label:'4 pcs', val:4 }];
  if (u === 'bunch')               return [{ label:'1 bunch', val:1 }, { label:'2 bunches', val:2 }];
  return [{ label:'1×', val:1 }, { label:'2×', val:2 }];
}

const qtyMap = {};
function productCard(p, delay = 0) {
  const fallback = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=70';
  const presets  = getQtyPresets(p.unit);
  if (!qtyMap[p.id]) qtyMap[p.id] = presets[0].val;

  return `
  <div class="product-card" style="animation-delay:${delay}s;" data-id="${p.id}">
    <div class="product-img">
      <img src="${p.image_url || fallback}"
           alt="${p.name} - fresh ${p.category} delivery Udaipur"
           loading="lazy"
           onerror="this.src='${fallback}'">
      <div class="product-img-badge">
        <span class="badge ${p.is_available ? 'badge-green' : 'badge-red'}">
          ${p.is_featured ? 'Featured' : p.is_available ? 'Fresh' : 'Out of Stock'}
        </span>
      </div>
      <button class="product-img-wish" title="Wishlist" onclick="toggleWish(this)">♡</button>
    </div>
    <div class="product-body">
      <div class="product-name">${p.name}</div>
      ${p.name_hi ? `<div class="product-name-hi">${p.name_hi}</div>` : ''}
      <div class="product-price" style="margin:4px 0 8px;" id="pp-${p.id}">Rs.${(p.price_per_unit * presets[0].val).toFixed(0)} <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">/ ${presets[0].label}</span></div>
      <div class="qty-presets" id="qp-${p.id}" style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
        ${presets.map(pr => `
          <button class="qty-preset-btn ${pr.val === presets[0].val ? 'active' : ''}"
                  onclick="selectPreset(${p.id}, ${pr.val}, this)"
                  style="flex:1;min-width:48px;padding:5px 4px;border:1.5px solid ${pr.val === presets[0].val ? 'var(--c-forest)' : 'var(--border)'};border-radius:8px;background:${pr.val === presets[0].val ? 'var(--c-dew,#f0fdf4)' : 'var(--bg-card)'};font-size:.72rem;font-weight:700;cursor:pointer;color:${pr.val === presets[0].val ? 'var(--c-forest)' : 'var(--text-sec)'};transition:all .15s;">
            ${pr.label}
          </button>`).join('')}
      </div>
      <button class="add-cart-btn"
              onclick="addProductToCart(${p.id})"
              ${!p.is_available ? 'disabled' : ''}>
        ${p.is_available ? '<i class="fas fa-basket-shopping" style="font-size:.82rem;"></i> Add to Cart' : 'Out of Stock'}
      </button>
    </div>
  </div>`;
}

function selectPreset(id, val, btn) {
  qtyMap[id] = val;
  const container = document.getElementById(`qp-${id}`);
  if (container) {
    container.querySelectorAll('.qty-preset-btn').forEach(b => {
      b.style.borderColor = 'var(--border)';
      b.style.background  = 'var(--bg-card)';
      b.style.color       = 'var(--text-sec)';
    });
  }
  btn.style.borderColor = 'var(--c-forest)';
  btn.style.background  = 'var(--c-dew,#f0fdf4)';
  btn.style.color       = 'var(--c-forest)';
  // Update price display
  const p = pageProducts.find(x => x.id === id);
  const priceEl = document.getElementById(`pp-${id}`);
  if (p && priceEl) {
    const label = btn.textContent.trim();
    priceEl.innerHTML = `Rs.${(p.price_per_unit * val).toFixed(0)} <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">/ ${label}</span>`;
  }
}

function changeProductQty(id, delta) {
  qtyMap[id] = Math.max(0.25, parseFloat(((qtyMap[id] || 0.25) + delta).toFixed(2)));
  const el = document.getElementById(`qv-${id}`);
  if (el) el.textContent = qtyMap[id];
}

function toggleWish(btn) {
  btn.classList.toggle('wished');
  btn.textContent = btn.classList.contains('wished') ? '♥' : '♡';
}

// must be set by each page
let pageProducts = [];
function addProductToCart(id) {
  const p = pageProducts.find(x => x.id === id);
  if (p) Cart.add(p, qtyMap[id] || 0.25);
}

/* ─────────────────────────────────────────────────────────
   PAGE INIT
───────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────
   UX — Scroll behaviours
───────────────────────────────────────────────────────── */
(function initScrollUX() {
  // Scroll progress bar + navbar compact + back-to-top
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    requestAnimationFrame(() => {
      const scrollY   = window.scrollY;
      const docH      = document.documentElement.scrollHeight - window.innerHeight;
      const pct       = docH > 0 ? (scrollY / docH) * 100 : 0;

      // Progress bar
      const bar = document.getElementById('scrollProgress');
      if (bar) bar.style.width = pct + '%';

      // Compact navbar after 80px
      const nav = document.querySelector('.navbar');
      if (nav) nav.classList.toggle('scrolled', scrollY > 80);

      // Back to top after 400px
      const btn = document.getElementById('backToTop');
      if (btn) btn.classList.toggle('visible', scrollY > 400);

      ticking = false;
    });
    ticking = true;
  });

  // Reveal sections on scroll with IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('section').forEach(s => {
    s.classList.add('reveal');
    observer.observe(s);
  });

  // Active nav link based on current path
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (path === href || (href !== '/' && path.startsWith(href)))) {
      link.classList.add('active');
    }
  });
})();

/* Cart button pop animation on add */
const _origCartAdd = Cart.add.bind(Cart);
Cart.add = function(product, qty) {
  _origCartAdd(product, qty);
  const btn = document.getElementById('cartBtn');
  if (btn) {
    btn.classList.remove('pop');
    void btn.offsetWidth; // reflow
    btn.classList.add('pop');
    btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Cart._updateBadge();
  Auth.updateNavUI();

  // Theme toggle
  document.getElementById('themeBtn')?.addEventListener('click', () => Theme.toggle());

  // Cart button
  document.getElementById('cartBtn')?.addEventListener('click', () => CartDrawer.open());
  document.getElementById('cartBackdrop')?.addEventListener('click', () => CartDrawer.close());
  document.getElementById('cartCloseBtn')?.addEventListener('click', () => CartDrawer.close());

  // Checkout from cart
  document.getElementById('cartCheckoutBtn')?.addEventListener('click', () => {
    CartDrawer.close();
    if (!Auth.loggedIn()) { openModal('authModal'); return; }
    window.location.href = '/checkout';
  });

  // Auth modal
  document.getElementById('authBtn')?.addEventListener('click', () => openModal('authModal'));

  // User dropdown
  document.getElementById('userAvatarBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('userDropdown')?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => document.getElementById('userDropdown')?.classList.add('hidden'));

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());

  // Hamburger
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('mobileNav')?.classList.toggle('open');
    document.getElementById('hamburger')?.classList.toggle('open');
  });

  // Chatbot
  document.getElementById('chatFab')?.addEventListener('click', () => Chatbot.toggle());
  document.getElementById('chatCloseBtn')?.addEventListener('click', () => Chatbot.toggle());
  document.getElementById('chatSendBtn')?.addEventListener('click', () => Chatbot.send());
  document.getElementById('voiceBtn')?.addEventListener('click', () => Chatbot.startVoice());
  document.getElementById('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') Chatbot.send();
  });

  // Auth form switch
  document.getElementById('switchToRegister')?.addEventListener('click', () => switchAuth('register'));
  document.getElementById('switchToLogin')?.addEventListener('click',    () => switchAuth('login'));

  // Login / register submit
  document.getElementById('loginSubmitBtn')?.addEventListener('click',    doLogin);
  document.getElementById('registerSubmitBtn')?.addEventListener('click', doRegister);

  // Search
  initSearch('navSearchInput', 'navSearchDrop', pageProducts);
});

/* ─────────────────────────────────────────────────────────
   AUTH FORMS
───────────────────────────────────────────────────────── */
function switchAuth(mode) {
  const loginF = document.getElementById('loginForm');
  const regF   = document.getElementById('registerForm');
  const title  = document.getElementById('authTitle');
  if (mode === 'register') {
    loginF?.classList.add('hidden');
    regF?.classList.remove('hidden');
    if (title) title.textContent = 'Create Account';
  } else {
    regF?.classList.add('hidden');
    loginF?.classList.remove('hidden');
    if (title) title.textContent = 'Sign In';
  }
}

async function doLogin() {
  const email    = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { Toast.show('Please fill all fields', 'error'); return; }
  const btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
  try {
    const data = await api('/auth/login', 'POST', { email, password });
    Auth.save(data.token, data.user);
    closeModal('authModal');
    Auth.updateNavUI();
    Toast.show(`Welcome back, ${data.user.name.split(' ')[0]}!`);
  } catch (err) {
    Toast.show(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
  }
}

async function doRegister() {
  const name     = document.getElementById('regName')?.value.trim();
  const email    = document.getElementById('regEmail')?.value.trim();
  const phone    = document.getElementById('regPhone')?.value.trim();
  const password = document.getElementById('regPassword')?.value;
  if (!name || !email || !phone || !password) { Toast.show('Please fill all fields', 'error'); return; }
  if (phone.length !== 10) { Toast.show('Enter a valid 10-digit phone number', 'error'); return; }
  const btn = document.getElementById('registerSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
  try {
    const data = await api('/auth/register', 'POST', { name, email, phone, password });
    Auth.save(data.token, data.user);
    closeModal('authModal');
    Auth.updateNavUI();
    Toast.show(`Welcome to NR Sabji Mandi, ${data.user.name.split(' ')[0]}!`);
  } catch (err) {
    Toast.show(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
  }
}