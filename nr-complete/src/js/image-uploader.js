/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI — Image Uploader Component
   src/js/image-uploader.js
   (Used in BOTH admin product form and customer profile avatar)
   ═══════════════════════════════════════════════════════════ */

'use strict';

/**
 * ImageUploader
 * Drop this into any page that needs image upload.
 *
 * Usage:
 *   const uploader = new ImageUploader({
 *     dropzoneId:   'imgDropzone',   // id of the dropzone <div>
 *     previewId:    'imgPreview',    // id of <img> for preview
 *     urlInputId:   'pImageUrl',     // hidden input to store final URL
 *     endpoint:     '/api/upload/product-image',
 *     maxMB:        5,
 *   });
 */
class ImageUploader {
  constructor({ dropzoneId, previewId, urlInputId, endpoint, maxMB = 5 }) {
    this.dropzone  = document.getElementById(dropzoneId);
    this.preview   = document.getElementById(previewId);
    this.urlInput  = document.getElementById(urlInputId);
    this.endpoint  = endpoint || '/api/upload/product-image';
    this.maxBytes  = maxMB * 1024 * 1024;
    this.currentPublicId = null;

    if (!this.dropzone) return;
    this._init();
  }

  _init() {
    // Render dropzone HTML
    this.dropzone.innerHTML = `
      <div class="dz-inner" id="${this.dropzone.id}-inner">
        <input type="file" accept="image/jpeg,image/png,image/webp" class="dz-file-input" id="${this.dropzone.id}-file">
        <div class="dz-idle">
          <div class="dz-icon"><i class="fas fa-cloud-upload-alt"></i></div>
          <div class="dz-text">
            <span class="dz-main">Click or drag &amp; drop image here</span>
            <span class="dz-sub">JPEG, PNG, WebP — max ${this.maxBytes/1024/1024}MB</span>
          </div>
        </div>
        <div class="dz-progress" style="display:none;">
          <div class="dz-bar"></div>
          <span class="dz-pct">Uploading...</span>
        </div>
        <div class="dz-preview-wrap" style="display:none;">
          <img class="dz-preview-img" id="${this.dropzone.id}-preview" alt="Preview">
          <button class="dz-remove-btn" type="button">
            <i class="fas fa-times"></i> Remove
          </button>
        </div>
      </div>`;

    this._attachStyles();

    const fileInput  = this.dropzone.querySelector('.dz-file-input');
    const removeBtn  = this.dropzone.querySelector('.dz-remove-btn');
    const inner      = this.dropzone.querySelector('.dz-inner');

    // Click to open file dialog
    inner.addEventListener('click', e => {
      if (!e.target.closest('.dz-remove-btn')) fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) this._handleFile(e.target.files[0]);
    });

    // Drag & drop
    inner.addEventListener('dragover',  e => { e.preventDefault(); inner.classList.add('dz-drag'); });
    inner.addEventListener('dragleave', ()  => inner.classList.remove('dz-drag'));
    inner.addEventListener('drop',      e => {
      e.preventDefault();
      inner.classList.remove('dz-drag');
      if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]);
    });

    // Remove button
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      this._reset();
    });
  }

  _handleFile(file) {
    // Validate
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      this._showError('Only JPEG, PNG or WebP images allowed.'); return;
    }
    if (file.size > this.maxBytes) {
      this._showError(`Image must be under ${this.maxBytes/1024/1024}MB.`); return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = e => this._showPreview(e.target.result);
    reader.readAsDataURL(file);

    // Upload to Cloudinary via backend
    this._upload(file);
  }

  async _upload(file) {
    this._showProgress(0);

    const formData = new FormData();
    formData.append('image', file);

    try {
      // XHR for progress events
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.endpoint);

      // JWT auth
      const token = localStorage.getItem('nr_admin_token') || localStorage.getItem('nr_token');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) this._showProgress(Math.round(e.loaded / e.total * 100));
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          this.currentPublicId = data.public_id;
          if (this.urlInput) this.urlInput.value = data.url;
          this._showPreview(data.url);
          this._hideProgress();
          if (typeof Toast !== 'undefined') Toast.show('Image uploaded!');
        } else {
          const err = JSON.parse(xhr.responseText);
          this._showError(err.error || 'Upload failed');
          this._hideProgress();
        }
      };

      xhr.onerror = () => { this._showError('Network error during upload.'); this._hideProgress(); };
      xhr.send(formData);
    } catch (err) {
      this._showError(err.message);
      this._hideProgress();
    }
  }

  _showPreview(src) {
    const idle    = this.dropzone.querySelector('.dz-idle');
    const pw      = this.dropzone.querySelector('.dz-preview-wrap');
    const img     = this.dropzone.querySelector('.dz-preview-img');
    if (idle) idle.style.display = 'none';
    if (pw)   pw.style.display   = 'flex';
    if (img)  img.src = src;
  }

  _showProgress(pct) {
    const prog = this.dropzone.querySelector('.dz-progress');
    const bar  = this.dropzone.querySelector('.dz-bar');
    const txt  = this.dropzone.querySelector('.dz-pct');
    const idle = this.dropzone.querySelector('.dz-idle');
    if (prog) prog.style.display = 'flex';
    if (idle) idle.style.display = 'none';
    if (bar)  bar.style.width    = `${pct}%`;
    if (txt)  txt.textContent    = pct < 100 ? `Uploading ${pct}%...` : 'Processing...';
  }

  _hideProgress() {
    const prog = this.dropzone.querySelector('.dz-progress');
    if (prog) prog.style.display = 'none';
  }

  _reset() {
    if (this.urlInput) this.urlInput.value = '';
    const idle = this.dropzone.querySelector('.dz-idle');
    const pw   = this.dropzone.querySelector('.dz-preview-wrap');
    if (idle) idle.style.display = 'flex';
    if (pw)   pw.style.display   = 'none';
    this.currentPublicId = null;
  }

  _showError(msg) {
    if (typeof Toast !== 'undefined') Toast.show(msg, 'err');
    else alert(msg);
  }

  // Inject styles once
  _attachStyles() {
    if (document.getElementById('dz-styles')) return;
    const style = document.createElement('style');
    style.id = 'dz-styles';
    style.textContent = `
      .dz-inner {
        border: 1.5px dashed var(--border-mid, #243424);
        border-radius: 10px;
        min-height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color .15s, background .15s;
        position: relative;
        overflow: hidden;
        background: var(--bg-input, #111811);
      }
      .dz-inner:hover, .dz-inner.dz-drag {
        border-color: var(--green, #4ade80);
        background: rgba(74,222,128,.04);
      }
      .dz-file-input { display: none; }
      .dz-idle {
        display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px;
        pointer-events: none;
      }
      .dz-icon { font-size: 2rem; color: var(--text-3, #5a8a5d); }
      .dz-main { font-size: .85rem; font-weight: 600; color: var(--text-2, #a8c5aa); }
      .dz-sub  { font-size: .72rem; color: var(--text-4, #2e502e); font-family: monospace; }
      .dz-progress {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
        background: var(--bg-input, #111811);
      }
      .dz-bar {
        height: 4px; background: var(--green, #4ade80);
        border-radius: 99px; transition: width .2s;
        width: 0%; max-width: 70%;
      }
      .dz-pct { font-size: .75rem; color: var(--green, #4ade80); font-family: monospace; }
      .dz-preview-wrap {
        display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px;
        width: 100%;
      }
      .dz-preview-img {
        max-height: 140px; border-radius: 8px; border: 1px solid var(--border, #1e2e1e);
        object-fit: cover;
      }
      .dz-remove-btn {
        font-size: .75rem; color: var(--red, #f87171);
        background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.2);
        border-radius: 6px; padding: 4px 12px; cursor: pointer;
        font-family: inherit; transition: background .15s;
      }
      .dz-remove-btn:hover { background: rgba(248,113,113,.2); }
    `;
    document.head.appendChild(style);
  }
}

// ── Admin product modal patch ────────────────────────────
// Call this after the admin panel DOM is ready to replace the URL input
// with a proper drag-drop uploader.
function initAdminProductImageUploader() {
  // Replace the plain URL input row with dropzone + URL input (hidden)
  const urlInput = document.getElementById('pImageUrl');
  if (!urlInput) return;

  // Create dropzone container
  const dz = document.createElement('div');
  dz.id = 'productImgDropzone';
  urlInput.parentElement.insertBefore(dz, urlInput);
  urlInput.style.display = 'none'; // hide raw URL input; uploader fills it

  // Also keep URL input as fallback text field
  const fallbackWrap = document.createElement('div');
  fallbackWrap.innerHTML = `
    <div style="text-align:center;margin:6px 0;font-size:.72rem;color:var(--text-4);font-family:monospace;">— or enter URL directly —</div>`;
  urlInput.parentElement.insertBefore(fallbackWrap, urlInput);
  urlInput.style.display = '';

  new ImageUploader({
    dropzoneId: 'productImgDropzone',
    urlInputId: 'pImageUrl',
    endpoint:   '/api/upload/product-image',
    maxMB:      5,
  });
}
