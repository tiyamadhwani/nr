/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI — Google Maps Delivery Area Picker
   src/js/maps.js
   ═══════════════════════════════════════════════════════════
   Features:
   - Address autocomplete with Udaipur bias
   - Map pin to confirm delivery location
   - Delivery zone check (is customer inside service area?)
   - Fills checkout address fields automatically
   - Works on checkout.html AND profile address form

   Setup:
   1. Get a Google Maps API key from console.cloud.google.com
   2. Enable: Maps JavaScript API, Places API, Geocoding API
   3. Replace YOUR_GOOGLE_MAPS_API_KEY below (or set it in .env and
      inject via a server-side template)

   IMPORTANT: Restrict your API key to your domain in Google Console!
   ═══════════════════════════════════════════════════════════ */

'use strict';

const MAPS_CONFIG = {
  // ── Change this to your actual API key ──
  API_KEY: window.GOOGLE_MAPS_KEY || 'YOUR_GOOGLE_MAPS_API_KEY',

  // Udaipur city center (lat, lng)
  CENTER: { lat: 24.5854, lng: 73.7125 },

  // Delivery zone: polygon around serviceable Udaipur areas
  // Edit these coordinates to match your actual delivery boundary
  DELIVERY_ZONE: [
    { lat: 24.6200, lng: 73.6800 },
    { lat: 24.6200, lng: 73.7600 },
    { lat: 24.5700, lng: 73.7800 },
    { lat: 24.5400, lng: 73.7500 },
    { lat: 24.5400, lng: 73.6700 },
    { lat: 24.5700, lng: 73.6600 },
  ],

  DEFAULT_ZOOM: 14,
};


// ──────────────────────────────────────────────────────────
// GOOGLE MAPS LOADER (async, no duplicate loads)
// ──────────────────────────────────────────────────────────

let _mapsLoaded = false;
let _mapsLoadPromise = null;

function loadGoogleMaps() {
  if (_mapsLoaded) return Promise.resolve();
  if (_mapsLoadPromise) return _mapsLoadPromise;

  _mapsLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) { _mapsLoaded = true; resolve(); return; }

    window.__mapsCallback = () => { _mapsLoaded = true; resolve(); };
    const script = document.createElement('script');
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${MAPS_CONFIG.API_KEY}&libraries=places,geometry&callback=__mapsCallback&language=en&region=IN`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Google Maps failed to load. Check your API key.'));
    document.head.appendChild(script);
  });

  return _mapsLoadPromise;
}


// ──────────────────────────────────────────────────────────
// DELIVERY ZONE CHECKER
// ──────────────────────────────────────────────────────────

function isInsideDeliveryZone(lat, lng) {
  if (!window.google?.maps?.geometry) return true; // fail open if Maps not loaded
  const point   = new google.maps.LatLng(lat, lng);
  const polygon = new google.maps.Polygon({ paths: MAPS_CONFIG.DELIVERY_ZONE });
  return google.maps.geometry.poly.containsLocation(point, polygon);
}


// ──────────────────────────────────────────────────────────
// ADDRESS PICKER MODAL
// ──────────────────────────────────────────────────────────

class AddressPicker {
  /**
   * Creates a modal with a Google Map + autocomplete search.
   * On confirm, fills the given form fields with the selected address.
   *
   * @param {Object} opts
   *   fieldMap: {
   *     street:  'fStreet',  // input id for street/house
   *     area:    'fArea',
   *     city:    'fCity',
   *     pincode: 'fPin',
   *   }
   *   onConfirm(addressData) — optional callback
   */
  constructor(opts = {}) {
    this.fieldMap  = opts.fieldMap || {};
    this.onConfirm = opts.onConfirm || null;
    this._marker   = null;
    this._map      = null;
    this._selectedAddress = null;
    this._buildModal();
  }

  _buildModal() {
    if (document.getElementById('mapPickerModal')) return;

    const modal = document.createElement('div');
    modal.id    = 'mapPickerModal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;
      display:flex;align-items:center;justify-content:center;padding:16px;
      opacity:0;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(4px);`;

    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:16px;width:100%;max-width:700px;
                  box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden;
                  transform:scale(.95);transition:transform .2s;display:flex;flex-direction:column;max-height:90vh;">

        <!-- Header -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--border,#eee);
                    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div>
            <div style="font-weight:700;font-size:.95rem;">Pick Delivery Location</div>
            <div style="font-size:.76rem;color:var(--text-muted,#888);margin-top:2px;">
              Search your address or pin your location on the map
            </div>
          </div>
          <button onclick="window._addressPicker?.close()"
                  style="width:30px;height:30px;border-radius:6px;background:var(--bg-subtle,#f5f5f5);
                         border:none;cursor:pointer;font-size:.9rem;color:#666;">✕</button>
        </div>

        <!-- Search box -->
        <div style="padding:12px 16px;border-bottom:1px solid var(--border,#eee);flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:8px;background:var(--bg-subtle,#f5f5f5);
                      border:1.5px solid var(--border,#ddd);border-radius:99px;padding:8px 16px;">
            <i class="fas fa-search" style="color:#aaa;font-size:.85rem;"></i>
            <input type="text" id="mapSearchInput"
                   placeholder="Search address in Udaipur..."
                   style="background:none;border:none;outline:none;flex:1;font-size:.9rem;
                          color:var(--text-body,#222);font-family:inherit;">
          </div>
        </div>

        <!-- Map -->
        <div id="mapPickerContainer" style="height:340px;flex-shrink:0;"></div>

        <!-- Zone warning -->
        <div id="zoneWarning" style="display:none;padding:10px 16px;background:#fff3e0;
             border-bottom:1px solid #ffe0b2;font-size:.82rem;color:#e65100;">
          <i class="fas fa-exclamation-triangle"></i>
          This location may be outside our current delivery zone. Please contact us to confirm.
        </div>

        <!-- Selected address preview -->
        <div id="selectedAddrPreview" style="padding:12px 16px;font-size:.85rem;
             color:var(--text-sec,#555);border-bottom:1px solid var(--border,#eee);
             min-height:50px;flex-shrink:0;">
          <span style="color:#aaa;">No location selected. Click the map or search above.</span>
        </div>

        <!-- Footer -->
        <div style="padding:12px 16px;display:flex;gap:10px;justify-content:flex-end;flex-shrink:0;">
          <button onclick="window._addressPicker?.close()"
                  style="padding:9px 22px;border-radius:99px;background:var(--bg-subtle,#f5f5f5);
                         border:1px solid var(--border,#ddd);cursor:pointer;font-size:.85rem;font-family:inherit;">
            Cancel
          </button>
          <button id="confirmLocationBtn" onclick="window._addressPicker?.confirm()"
                  style="padding:9px 22px;border-radius:99px;background:var(--c-forest,#2e7d32);
                         color:#fff;border:none;cursor:pointer;font-size:.85rem;font-weight:600;font-family:inherit;
                         opacity:.5;pointer-events:none;">
            <i class="fas fa-check"></i> Use This Location
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    this._modal = modal;
  }

  async open() {
    this._modal.style.opacity      = '1';
    this._modal.style.pointerEvents = 'all';
    this._modal.querySelector('div').style.transform = 'scale(1)';
    window._addressPicker = this;

    try {
      await loadGoogleMaps();
      this._initMap();
    } catch (e) {
      alert('Google Maps could not load. Please enter your address manually.');
      this.close();
    }
  }

  _initMap() {
    if (this._map) return;

    const mapEl = document.getElementById('mapPickerContainer');
    this._map = new google.maps.Map(mapEl, {
      center:           MAPS_CONFIG.CENTER,
      zoom:             MAPS_CONFIG.DEFAULT_ZOOM,
      mapTypeControl:   false,
      streetViewControl:false,
      fullscreenControl:false,
      styles: [ // Dark-ish clean style
        { featureType:'all', elementType:'labels.text.fill', stylers:[{color:'#444'}] },
        { featureType:'landscape', stylers:[{color:'#f5f5f5'}] },
        { featureType:'road', elementType:'geometry', stylers:[{color:'#ffffff'}] },
        { featureType:'water', stylers:[{color:'#b0d8f5'}] },
      ],
    });

    // Draw delivery zone polygon
    new google.maps.Polygon({
      paths:         MAPS_CONFIG.DELIVERY_ZONE,
      strokeColor:   '#2e7d32',
      strokeOpacity: 0.7,
      strokeWeight:  2,
      fillColor:     '#4caf50',
      fillOpacity:   0.08,
      map:           this._map,
    });

    // Click on map to place pin
    this._map.addListener('click', e => this._placePin(e.latLng.lat(), e.latLng.lng()));

    // Autocomplete search
    const input = document.getElementById('mapSearchInput');
    const ac = new google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'IN' },
      bounds: new google.maps.LatLngBounds(
        new google.maps.LatLng(24.5300, 73.6500),
        new google.maps.LatLng(24.6400, 73.8000)
      ),
      strictBounds: false,
      fields: ['geometry', 'address_components', 'formatted_address'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry) return;
      const { lat, lng } = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      this._map.setCenter({ lat, lng });
      this._map.setZoom(17);
      this._placePin(lat, lng, place.formatted_address, place.address_components);
    });
  }

  _placePin(lat, lng, formattedAddress = null, components = null) {
    // Remove old marker
    if (this._marker) this._marker.setMap(null);

    this._marker = new google.maps.Marker({
      position:  { lat, lng },
      map:       this._map,
      draggable: true,
      title:     'Drag to adjust',
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor:    '#2e7d32',
        fillOpacity:  1,
        strokeColor:  '#fff',
        strokeWeight: 3,
        scale:        10,
      },
    });

    this._marker.addListener('dragend', e => {
      this._placePin(e.latLng.lat(), e.latLng.lng());
    });

    // Zone check
    const inside = isInsideDeliveryZone(lat, lng);
    document.getElementById('zoneWarning').style.display = inside ? 'none' : 'block';

    if (formattedAddress) {
      this._fillFromComponents(formattedAddress, components, lat, lng);
    } else {
      // Reverse geocode
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          this._fillFromComponents(results[0].formatted_address, results[0].address_components, lat, lng);
        }
      });
    }
  }

  _fillFromComponents(formatted, components = [], lat, lng) {
    const get = (type) => {
      const c = components.find(c => c.types.includes(type));
      return c ? c.long_name : '';
    };

    const pincode  = get('postal_code');
    const city     = get('locality') || get('administrative_area_level_2') || 'Udaipur';
    const area     = get('sublocality_level_1') || get('sublocality') || get('neighborhood') || '';
    const street   = [get('street_number'), get('route')].filter(Boolean).join(' ');

    this._selectedAddress = { formatted, street, area, city, pincode, lat, lng };

    // Update preview
    document.getElementById('selectedAddrPreview').innerHTML = `
      <i class="fas fa-map-marker-alt" style="color:var(--c-forest,#2e7d32);margin-right:6px;"></i>
      <strong>${area || city}</strong> — ${formatted}`;

    // Enable confirm button
    const btn = document.getElementById('confirmLocationBtn');
    btn.style.opacity        = '1';
    btn.style.pointerEvents  = 'all';
  }

  confirm() {
    if (!this._selectedAddress) return;
    const a = this._selectedAddress;

    // Fill form fields
    const fill = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    fill(this.fieldMap.street  || 'fStreet', a.street  || a.area);
    fill(this.fieldMap.area    || 'fArea',   a.area    || '');
    fill(this.fieldMap.city    || 'fCity',   a.city    || 'Udaipur');
    fill(this.fieldMap.pincode || 'fPin',    a.pincode || '');

    if (this.onConfirm) this.onConfirm(a);
    if (typeof Toast !== 'undefined') Toast.show('Location selected!');
    this.close();
  }

  close() {
    this._modal.style.opacity       = '0';
    this._modal.style.pointerEvents = 'none';
    this._modal.querySelector('div').style.transform = 'scale(.95)';
    window._addressPicker = null;
  }
}


// ──────────────────────────────────────────────────────────
// INIT — add "Pick on Map" button to checkout page
// ──────────────────────────────────────────────────────────

function initCheckoutMapPicker() {
  const streetInput = document.getElementById('fStreet');
  if (!streetInput) return;

  // Create and insert the Pick on Map button next to the street field
  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'btn btn-outline btn-sm';
  btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Pick on Map';
  btn.style.cssText = 'margin-top:8px;width:100%;';

  btn.addEventListener('click', () => {
    const picker = new AddressPicker({
      fieldMap: { street: 'fStreet', area: 'fArea', city: 'fCity', pincode: 'fPin' }
    });
    picker.open();
  });

  streetInput.parentElement.appendChild(btn);
}

// ──────────────────────────────────────────────────────────
// INIT — add "Pick on Map" to profile address form
// ──────────────────────────────────────────────────────────

function initProfileMapPicker() {
  const streetInput = document.getElementById('aStreet');
  if (!streetInput) return;

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'btn btn-outline btn-sm';
  btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Pick on Map';
  btn.style.cssText = 'margin-top:8px;width:100%;';

  btn.addEventListener('click', () => {
    const picker = new AddressPicker({
      fieldMap: { street: 'aStreet', area: 'aArea', city: 'aCity', pincode: 'aPin' }
    });
    picker.open();
  });

  streetInput.parentElement.appendChild(btn);
}

// Auto-init based on which page we're on
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('fStreet')) initCheckoutMapPicker();
  if (document.getElementById('aStreet')) initProfileMapPicker();
});
