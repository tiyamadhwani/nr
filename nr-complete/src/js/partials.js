/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI — Shared HTML Partials (injected via JS)
   partials.js
   ═══════════════════════════════════════════════════════════ */

function injectNavbar() {
  const el = document.getElementById('navbar-placeholder');
  if (!el) return;
  const page = window.location.pathname;
  function navLink(href, label) {
    const active = (page === href || (href !== '/' && page.startsWith(href))) ? ' active' : '';
    return `<a href="${href}" class="nav-link${active}">${label}</a>`;
  }
  el.innerHTML = `
<div class="scroll-progress" id="scrollProgress"></div>
<button class="back-to-top" id="backToTop" title="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">
  <i class="fas fa-arrow-up"></i>
</button>
<button class="cart-fab" id="cartFab" onclick="CartDrawer.open()" title="Your Cart">
  <i class="fas fa-basket-shopping"></i>
  <span class="cart-fab-count" id="cartFabCount" style="display:none;">0</span>
</button>
<nav class="navbar">
  <a class="nav-brand" href="/">
    <div class="nav-logo">
      <img src="/src/images/logo.jpg"
           alt="NR Sabji Mandi"
           onerror="this.style.display='none';this.parentElement.innerHTML='<span class=nav-logo-text>NR</span>'">
    </div>
    <div class="nav-brand-text">
      <div class="nav-shop-name">NR Sabji Mandi</div>
      <div class="nav-tagline">Your Daily Dose of Freshness</div>
    </div>
  </a>

  <div class="nav-links">
    ${navLink('/', 'Home')}
    ${navLink('/products', 'Vegetables')}
    ${navLink('/products?cat=fruit', 'Fruits')}
    ${navLink('/orders', 'My Orders')}
  </div>

  <div class="nav-search search-wrap">
    <div class="search-bar">
      <i class="fas fa-search"></i>
      <input type="text" id="navSearchInput" placeholder="Search sabzi, fruits..." autocomplete="off">
    </div>
    <div class="search-dropdown hidden" id="navSearchDrop"></div>
  </div>

  <div class="nav-actions">
    <button class="theme-btn" id="themeBtn">
      <i class="fas fa-moon"></i><span>Dark</span>
    </button>

    <button class="cart-btn" id="cartBtn" title="Your Cart">
      <i class="fas fa-basket-shopping"></i>
      <span class="cart-count" id="cartCount" style="display:none;">0</span>
    </button>

    <button class="auth-btn" id="authBtn">Sign In</button>

    <div class="user-menu-wrap" id="userMenuWrap" style="display:none;">
      <button class="user-avatar-btn" id="userAvatarBtn">
        <div class="user-avatar"><i class="fas fa-user"></i></div>
        <span class="user-name"></span>
        <i class="fas fa-chevron-down" style="font-size:.65rem;color:var(--text-muted);margin-left:2px;"></i>
      </button>
      <div class="user-dropdown hidden" id="userDropdown">
        <a href="/orders" class="dropdown-item"><i class="fas fa-receipt"></i> My Orders</a>
        <a href="/profile" class="dropdown-item"><i class="fas fa-user-circle"></i> My Profile</a>
        <a href="/profile#addresses" class="dropdown-item"><i class="fas fa-map-marker-alt"></i> My Addresses</a>
        <hr class="dropdown-divider">
        <button class="dropdown-item danger" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </div>

    <button class="hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<!-- Mobile nav -->
<div class="mobile-nav" id="mobileNav">
  <a href="/"><i class="fas fa-home"></i> Home</a>
  <a href="/products"><i class="fas fa-leaf"></i> Vegetables</a>
  <a href="/products?cat=fruit"><i class="fas fa-apple-whole"></i> Fruits</a>
  <a href="/orders"><i class="fas fa-receipt"></i> My Orders</a>
  <a href="/profile"><i class="fas fa-user"></i> Profile</a>
  <div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px;display:flex;flex-direction:column;gap:8px;">
    <div class="search-bar">
      <i class="fas fa-search"></i>
      <input type="text" placeholder="Search products..." onkeydown="if(event.key==='Enter')window.location.href='/products?q='+this.value">
    </div>
    <button class="btn btn-primary btn-full" onclick="CartDrawer.open();document.getElementById('mobileNav').classList.remove('open')">
      <i class="fas fa-basket-shopping"></i> View Cart
    </button>
  </div>
</div>
`;
}

function injectCartDrawer() {
  const el = document.getElementById('cart-placeholder');
  if (!el) return;
  el.innerHTML = `
<div class="cart-backdrop" id="cartBackdrop"></div>
<div class="cart-drawer" id="cartDrawer">
  <div class="cart-drawer-head">
    <h3><i class="fas fa-basket-shopping" style="color:var(--c-forest);margin-right:8px;"></i>Your Cart</h3>
    <button class="icon-btn" id="cartCloseBtn"><i class="fas fa-times"></i></button>
  </div>
  <div class="cart-empty" id="cartEmpty" style="display:none;">
    <div class="cart-empty-icon">🛒</div>
    <h4>Cart is Empty</h4>
    <p>Add fresh vegetables and fruits to get started</p>
    <button class="btn btn-primary" onclick="CartDrawer.close();window.location.href='/products'">Shop Now</button>
  </div>
  <div class="cart-items-list" id="cartItemsList"></div>
  <div class="cart-drawer-foot" id="cartFooter" style="display:none;">
    <div class="cart-delivery-msg" id="cartDeliveryMsg"></div>
    <div class="cart-totals">
      <div class="cart-row"><span>Subtotal</span><span id="cartSubtotal">Rs.0</span></div>
      <div class="cart-row"><span>Delivery</span><span id="cartDelivery">Rs.30</span></div>
      <div class="cart-row cart-row-total"><span>Total</span><span id="cartTotal">Rs.0</span></div>
    </div>
    <button class="btn btn-primary btn-full" id="cartCheckoutBtn" style="margin-top:12px;">
      <i class="fas fa-arrow-right"></i> Proceed to Checkout
    </button>
  </div>
</div>`;
}

function injectFooter() {
  const el = document.getElementById('footer-placeholder');
  if (!el) return;
  el.innerHTML = `
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-top" style="max-width:var(--max-w);margin:0 auto 40px;">
      <div class="footer-logo-mark">
        <img src="/src/images/logo.jpg" alt="NR Sabji Mandi" onerror="this.parentElement.innerHTML='<div style=width:100%;height:100%;background:var(--brand-orange);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;border-radius:50%;>NR</div>'">
      </div>
      <div class="footer-brand-block">
        <div class="footer-brand-name">NR Sabji Mandi</div>
        <div class="footer-brand-tag">Your Daily Dose of Freshness · Since 2024</div>
      </div>
      <div class="footer-badge">🚀 Free delivery above ₹300</div>
    </div>

    <div class="footer-grid" style="max-width:var(--max-w);margin:0 auto;">
      <div class="footer-brand">
        <p>Udaipur's most trusted fresh vegetable and fruit delivery service. We bring farm-fresh sabzi and seasonal fruits directly to your doorstep every single day.</p>
        <div class="footer-contact-list">
          <div class="footer-contact-item"><span class="footer-contact-icon"><i class="fas fa-map-marker-alt"></i></span><span>Udaipur, Rajasthan – 313001</span></div>
          <div class="footer-contact-item"><span class="footer-contact-icon"><i class="fas fa-clock"></i></span><span>Open daily 7:00 AM – 9:00 PM</span></div>
          <div class="footer-contact-item"><span class="footer-contact-icon"><i class="fas fa-envelope"></i></span><span>nrsabjimandi@gmail.com</span></div>
          <div class="footer-contact-item"><span class="footer-contact-icon"><i class="fab fa-whatsapp"></i></span><span>WhatsApp for quick orders</span></div>
        </div>
        <div class="footer-socials">
          <a href="https://www.instagram.com/nr_sabji_mandi/" target="_blank" rel="noopener" class="social-link" title="Instagram"><i class="fab fa-instagram"></i></a>
          <a href="#" class="social-link" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
          <a href="#" class="social-link" title="Facebook"><i class="fab fa-facebook-f"></i></a>
          <a href="#" class="social-link" title="YouTube"><i class="fab fa-youtube"></i></a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/products">All Products</a></li>
          <li><a href="/products?cat=vegetable">Vegetables</a></li>
          <li><a href="/products?cat=fruit">Fruits</a></li>
          <li><a href="/products?q=leafy">Leafy Greens</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Account</h4>
        <ul>
          <li><a href="/orders">My Orders</a></li>
          <li><a href="/profile">My Profile</a></li>
          <li><a href="/profile#addresses">My Addresses</a></li>
          <li><a href="/checkout">Checkout</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="#how-to-order">How to Order</a></li>
          <li><a href="#delivery-info">Delivery Areas</a></li>
          <li><a href="#payment">Payment Options</a></li>
          <li><a href="#returns">Return Policy</a></li>
          <li><a href="#faq">FAQs</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© 2025 NR Sabji Mandi · Udaipur, Rajasthan</span>
      <span>Made with ❤️ for fresh produce lovers</span>
    </div>
  </div>
</footer>`;
}

function injectFooter_OLD() {
  const el = document.getElementById('footer-placeholder');
  if (!el) return;
  el.innerHTML = `
<footer class="footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="brand-name">NR <span>Sabji</span> Mandi</div>
      <p>Udaipur's trusted source for farm-fresh vegetables and fruits. We bring the freshest sabzi and seasonal fruits directly from farms to your doorstep every day.</p>
      <div class="footer-contact-list">
        <div class="footer-contact-item">
          <span class="footer-contact-icon"><i class="fas fa-map-marker-alt"></i></span>
          <span>Udaipur, Rajasthan, India – 313001</span>
        </div>
        <div class="footer-contact-item">
          <span class="footer-contact-icon"><i class="fas fa-clock"></i></span>
          <span>Open daily 7:00 AM – 9:00 PM</span>
        </div>
        <div class="footer-contact-item">
          <span class="footer-contact-icon"><i class="fas fa-envelope"></i></span>
          <span>nrsabjimandi@gmail.com</span>
        </div>
        <div class="footer-contact-item">
          <span class="footer-contact-icon"><i class="fab fa-whatsapp"></i></span>
          <span>WhatsApp us for orders &amp; enquiries</span>
        </div>
      </div>
      <div class="footer-socials">
        <a href="https://www.instagram.com/nr_sabji_mandi/" target="_blank" rel="noopener" class="social-link" title="Instagram">
          <i class="fab fa-instagram"></i>
        </a>
        <a href="#" class="social-link" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
        <a href="#" class="social-link" title="Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="#" class="social-link" title="YouTube"><i class="fab fa-youtube"></i></a>
      </div>
    </div>

    <div class="footer-col">
      <h4>Quick Links</h4>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/products">All Products</a></li>
        <li><a href="/products?cat=vegetable">Vegetables</a></li>
        <li><a href="/products?cat=fruit">Fruits</a></li>
        <li><a href="/orders">My Orders</a></li>
        <li><a href="/profile">My Account</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Categories</h4>
      <ul>
        <li><a href="/products?cat=vegetable">Fresh Vegetables</a></li>
        <li><a href="/products?cat=fruit">Seasonal Fruits</a></li>
        <li><a href="/products?q=leafy">Leafy Greens</a></li>
        <li><a href="/products?q=exotic">Exotic Vegetables</a></li>
        <li><a href="/products?q=organic">Organic Produce</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Customer Support</h4>
      <ul>
        <li><a href="#how-to-order">How to Order</a></li>
        <li><a href="#delivery-info">Delivery Areas</a></li>
        <li><a href="#payment">Payment Options</a></li>
        <li><a href="#returns">Return Policy</a></li>
        <li><a href="#contact">Contact Us</a></li>
        <li><a href="#faq">FAQs</a></li>
      </ul>
    </div>
  </div>

  <div class="footer-seo">
    Fresh vegetables Udaipur | Online sabzi delivery Rajasthan | Fruits delivery Udaipur | NR Sabji Mandi | Hari sabzi online order | Tomato onion potato home delivery | Farm fresh organic vegetables | Daily vegetable delivery service | Ghar pe sabzi delivery Udaipur | Best vegetable prices Udaipur
  </div>

  <div class="footer-bottom">
    <span>© 2025 NR Sabji Mandi. All rights reserved. | Udaipur, Rajasthan</span>
    <span>Made with care for fresh produce lovers</span>
  </div>
</footer>`;
}

function injectAuthModal() {
  const el = document.getElementById('auth-modal-placeholder');
  if (!el) return;
  el.innerHTML = `
<div class="modal-overlay" id="authModal">
  <div class="modal">
    <div class="modal-header">
      <div>
        <h3 id="authTitle">Sign In</h3>
        <p style="font-size:.84rem;color:var(--text-muted);margin-top:4px;">to NR Sabji Mandi</p>
      </div>
      <button class="modal-close" onclick="closeModal('authModal')"><i class="fas fa-times"></i></button>
    </div>

    <!-- Login -->
    <div id="loginForm">
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input type="email" class="form-input" id="loginEmail" placeholder="your@email.com">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-input" id="loginPassword" placeholder="Your password" onkeydown="if(event.key==='Enter')doLogin()">
      </div>
      <button class="btn btn-primary btn-full" id="loginSubmitBtn" style="margin-top:6px;">Sign In</button>
      <p style="text-align:center;font-size:.85rem;color:var(--text-muted);margin-top:18px;">
        Don't have an account?
        <button id="switchToRegister" style="color:var(--c-forest);font-weight:700;background:none;border:none;cursor:pointer;">Create one</button>
      </p>
    </div>

    <!-- Register -->
    <div id="registerForm" class="hidden">
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-input" id="regName" placeholder="Your full name">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="regEmail" placeholder="email@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="tel" class="form-input" id="regPhone" placeholder="10-digit mobile" maxlength="10">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-input" id="regPassword" placeholder="Create a password">
      </div>
      <button class="btn btn-primary btn-full" id="registerSubmitBtn" style="margin-top:6px;">Create Account</button>
      <p style="text-align:center;font-size:.85rem;color:var(--text-muted);margin-top:18px;">
        Already have an account?
        <button id="switchToLogin" style="color:var(--c-forest);font-weight:700;background:none;border:none;cursor:pointer;">Sign In</button>
      </p>
    </div>
  </div>
</div>`;
}

function injectChatbot() {
  const el = document.getElementById('chatbot-placeholder');
  if (!el) return;
  el.innerHTML = `
<button class="chat-fab" id="chatFab" title="Chat with NR Assistant">
  <i class="fas fa-comments"></i>
</button>

<div class="chat-window" id="chatWindow">
  <div class="chat-head">
    <div class="chat-avatar"><i class="fas fa-robot"></i></div>
    <div class="chat-head-info">
      <div class="name">NR Assistant</div>
      <div class="status">Online &bull; Hindi &amp; English</div>
    </div>
    <button class="chat-head-close" id="chatCloseBtn"><i class="fas fa-times"></i></button>
  </div>
  <div class="chat-msgs" id="chatMsgs">
    <div class="chat-msg bot">
      <div class="chat-bubble">Namaste! I am your NR Sabji Mandi assistant. Ask me about vegetables, prices, delivery, or anything else. आप हिंदी में भी पूछ सकते हैं!</div>
    </div>
  </div>
  <div class="chat-input-row">
    <input type="text" class="chat-input" id="chatInput" placeholder="Type in Hindi or English...">
    <button class="chat-voice" id="voiceBtn" title="Voice input"><i class="fas fa-microphone"></i></button>
    <button class="chat-send" id="chatSendBtn"><i class="fas fa-paper-plane"></i></button>
  </div>
</div>`;
}

// Auto-inject all partials
document.addEventListener('DOMContentLoaded', () => {
  injectNavbar();
  injectCartDrawer();
  injectFooter();
  injectAuthModal();
  injectChatbot();
});