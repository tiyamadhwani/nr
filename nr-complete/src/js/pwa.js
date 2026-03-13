/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI — PWA Registration & Install Prompt
   src/js/pwa.js
   Add <script src="src/js/pwa.js" defer></script> to every page
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────
   SERVICE WORKER REGISTRATION
───────────────────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PWA] Service Worker registered:', reg.scope);

      // Notify user when update is available
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  });

  // Reload page when new SW takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  });
}

/* ─────────────────────────────────────────────────────────
   UPDATE BANNER
───────────────────────────────────────────────────────── */
function showUpdateBanner() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed; bottom:0; left:0; right:0; z-index:9999;
    background:var(--c-forest,#2e7d32); color:#fff;
    padding:13px 20px; display:flex; align-items:center;
    justify-content:space-between; gap:12px;
    box-shadow:0 -4px 20px rgba(0,0,0,.25);
    animation:slideUp .3s ease;
    font-family:var(--font-body,sans-serif); font-size:.88rem;`;

  banner.innerHTML = `
    <span><strong>Update available!</strong> A new version of NR Sabji Mandi is ready.</span>
    <button onclick="location.reload()"
            style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);
                   color:#fff;padding:6px 16px;border-radius:99px;cursor:pointer;
                   font-size:.83rem;font-weight:700;white-space:nowrap;font-family:inherit;">
      Refresh Now
    </button>`;

  const style = document.createElement('style');
  style.textContent = `@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`;
  document.head.appendChild(style);
  document.body.appendChild(banner);
}


/* ─────────────────────────────────────────────────────────
   INSTALL PROMPT (Add to Home Screen)
───────────────────────────────────────────────────────── */
let _installPrompt = null;

// Capture the browser's beforeinstallprompt event
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // Don't show if already installed or dismissed in last 7 days
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  const dismissed = localStorage.getItem('nr_install_dismissed');
  if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 3600 * 1000) return;

  const banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.style.cssText = `
    position:fixed; bottom:20px; left:50%; transform:translateX(-50%);
    z-index:1700; width:calc(100% - 40px); max-width:420px;
    background:var(--bg-card,#fff); border:1.5px solid var(--border,#ddd);
    border-radius:16px; padding:16px 18px;
    box-shadow:0 8px 32px rgba(0,0,0,.18);
    display:flex; align-items:center; gap:14px;
    animation:fadeUp .35s ease;
    font-family:var(--font-body,sans-serif);`;

  banner.innerHTML = `
    <div style="width:48px;height:48px;border-radius:12px;background:var(--c-dew,#e8f5e9);
                display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;">
      🥦
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;font-size:.9rem;color:var(--text-head,#111);">Install NR Sabji Mandi</div>
      <div style="font-size:.76rem;color:var(--text-muted,#888);margin-top:2px;">
        Add to Home Screen for faster ordering
      </div>
    </div>
    <div style="display:flex;gap:7px;flex-shrink:0;">
      <button onclick="dismissInstall()"
              style="padding:7px 12px;border-radius:99px;background:var(--bg-subtle,#f5f5f5);
                     border:1px solid var(--border,#ddd);cursor:pointer;font-size:.78rem;
                     color:var(--text-sec,#666);font-family:inherit;">
        Later
      </button>
      <button onclick="triggerInstall()"
              style="padding:7px 16px;border-radius:99px;background:var(--c-forest,#2e7d32);
                     color:#fff;border:none;cursor:pointer;font-size:.78rem;font-weight:700;
                     font-family:inherit;">
        Install
      </button>
    </div>`;

  document.body.appendChild(banner);
}

function triggerInstall() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  _installPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') {
      console.log('[PWA] App installed!');
      if (typeof Toast !== 'undefined') Toast.show('App installed! Find NR Sabji Mandi on your home screen.');
    }
    _installPrompt = null;
    document.getElementById('installBanner')?.remove();
  });
}

function dismissInstall() {
  localStorage.setItem('nr_install_dismissed', Date.now().toString());
  document.getElementById('installBanner')?.remove();
}

// Handle successful install
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed via browser prompt');
  document.getElementById('installBanner')?.remove();
  _installPrompt = null;
});


/* ─────────────────────────────────────────────────────────
   PUSH NOTIFICATION SUBSCRIPTION
───────────────────────────────────────────────────────── */

// VAPID public key from your backend .env
// Generate with: python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key)"
const VAPID_PUBLIC_KEY = window.VAPID_KEY || 'YOUR_VAPID_PUBLIC_KEY';

async function subscribeToPushNotifications() {
  if (!('PushManager' in window)) {
    console.warn('[PWA] Push not supported in this browser');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // Check existing subscription
    let sub = await reg.pushManager.getSubscription();
    if (sub) return sub;

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[PWA] Push permission denied');
      return null;
    }

    // Subscribe
    sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Send subscription to backend
    const token = localStorage.getItem('nr_token');
    if (token) {
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(sub),
      });
      console.log('[PWA] Push subscription sent to backend');
    }

    return sub;
  } catch (err) {
    console.warn('[PWA] Push subscription failed:', err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Auto-subscribe when user logs in
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('nr_token');
  if (token && 'PushManager' in window) {
    // Delay to not block page load
    setTimeout(subscribeToPushNotifications, 3000);
  }
});


/* ─────────────────────────────────────────────────────────
   ONLINE/OFFLINE STATUS BAR
───────────────────────────────────────────────────────── */
function updateOnlineStatus() {
  const existing = document.getElementById('offlineBar');
  if (navigator.onLine) {
    existing?.remove();
  } else {
    if (existing) return;
    const bar = document.createElement('div');
    bar.id = 'offlineBar';
    bar.style.cssText = `
      position:fixed; top:var(--nav-h,70px); left:0; right:0; z-index:999;
      background:#e65100; color:#fff; text-align:center;
      padding:7px 16px; font-size:.82rem; font-weight:600;
      font-family:var(--font-body,sans-serif);
      animation:fadeIn .2s;`;
    bar.textContent = 'You are offline. Some features may not be available.';
    document.body.appendChild(bar);
  }
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
