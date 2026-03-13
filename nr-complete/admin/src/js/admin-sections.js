/* ═══════════════════════════════════════════════════════════
   NR SABJI MANDI ADMIN — Section Logic
   admin-sections.js
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const data = await api('/analytics/dashboard');

    // Stat cards
    document.getElementById('dTotalOrders').textContent   = data.total_orders || 0;
    document.getElementById('dTodaySales').textContent    = fmtRupee(data.today_sales || 0);
    document.getElementById('dPendingOrders').textContent = data.pending_orders || 0;
    document.getElementById('dTotalCustomers').textContent= data.total_customers || 0;

    // Pending badge in nav
    const nb = document.getElementById('orderNavBadge');
    if (nb) { nb.textContent = data.pending_orders || 0; nb.style.display = data.pending_orders ? '' : 'none'; }

    // Weekly sales chart
    loadWeeklySales();
    // Peak hours
    loadPeakHoursChart();
    // Recent orders
    loadRecentOrdersTable();

  } catch (err) {
    Toast.show('Failed to load dashboard: ' + err.message, 'err');
  }
}

async function loadWeeklySales() {
  try {
    const data = await api('/analytics/daily-sales?days=7');
    const labels   = data.sales.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}); });
    const revenue  = data.sales.map(d => d.revenue);
    const orders   = data.sales.map(d => d.orders);

    Charts.line('weeklySalesChart', labels, [
      { label: 'Revenue (₹)', data: revenue, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,.07)' },
      { label: 'Orders',      data: orders,  borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.07)', yAxisID: 'y1' },
    ], {
      scales: {
        x:  { ticks: { color: '#5a8a5d', font: { family: 'DM Mono', size: 10 } }, grid: { color: '#1e2e1e' } },
        y:  { ticks: { color: '#4ade80', font: { family: 'DM Mono', size: 10 }, callback: v => '₹'+v }, grid: { color: '#1e2e1e' }, position: 'left' },
        y1: { ticks: { color: '#60a5fa', font: { family: 'DM Mono', size: 10 } }, grid: { drawOnChartArea: false }, position: 'right' }
      }
    });
  } catch {}
}

async function loadPeakHoursChart() {
  try {
    const data   = await api('/analytics/peak-hours');
    const labels = data.peak_hours.map(h => `${h.hour}:00`);
    const counts = data.peak_hours.map(h => h.order_count);

    Charts.bar('peakHoursChart', labels, [{
      label: 'Orders',
      data: counts,
      backgroundColor: counts.map((v, i, a) =>
        v === Math.max(...a) ? 'rgba(251,191,36,.85)' : 'rgba(74,222,128,.45)'
      ),
      borderColor: 'transparent',
    }], {
      plugins: { legend: { display: false } }
    });
  } catch {}
}

async function loadRecentOrdersTable() {
  const tbody = document.getElementById('recentOrdersTbody');
  if (!tbody) return;
  try {
    const data = await api('/orders/admin/all?page=1&per_page=6');
    tbody.innerHTML = data.orders.map(o => `
      <tr>
        <td><span style="font-family:var(--font-mono);font-size:.78rem;color:var(--green)">${o.order_number}</span></td>
        <td>${o.customer_name || '—'}</td>
        <td><span style="font-family:var(--font-mono)">${fmtRupee(o.total_amount)}</span></td>
        <td>${statusBadge(o.status)}</td>
        <td style="color:var(--text-3);font-size:.76rem;font-family:var(--font-mono)">${fmtDateTime(o.created_at)}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
            ${['pending','confirmed','preparing','out_for_delivery','delivered','cancelled']
              .map(s => `<option value="${s}" ${s===o.status?'selected':''}>${STATUS_MAP[s]?.label||s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-3);">Failed to load orders</td></tr>`;
  }
}

/* ═══════════════════════════════════════════════
   ORDERS
═══════════════════════════════════════════════ */
let ordersPage = 1, ordersFilter = '';

async function loadOrders(page = 1, status = '') {
  ordersPage   = page;
  ordersFilter = status;
  const tbody  = document.getElementById('ordersTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7"><div class="spinner"></div></td></tr>`;

  try {
    let url = `/orders/admin/all?page=${page}&per_page=20`;
    if (status) url += `&status=${status}`;
    const data = await api(url);

    if (!data.orders.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No orders found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.orders.map(o => `
      <tr>
        <td><span style="font-family:var(--font-mono);font-size:.78rem;color:var(--green)">${o.order_number}</span></td>
        <td>
          <div style="font-weight:600;font-size:.85rem;">${o.customer_name || 'Guest'}</div>
          <div style="font-size:.72rem;color:var(--text-3);font-family:var(--font-mono)">${o.customer_phone || ''}</div>
        </td>
        <td style="font-size:.8rem;color:var(--text-2);">${o.delivery_area || '—'}</td>
        <td><span style="font-family:var(--font-mono);font-weight:700;color:var(--text-1)">${fmtRupee(o.total_amount)}</span></td>
        <td>${statusBadge(o.status)}</td>
        <td style="color:var(--text-3);font-size:.73rem;font-family:var(--font-mono)">${fmtDateTime(o.created_at)}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
              ${['pending','confirmed','preparing','out_for_delivery','delivered','cancelled']
                .map(s => `<option value="${s}" ${s===o.status?'selected':''}>${STATUS_MAP[s]?.label||s}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="viewOrderDetail(${o.id})" title="View Details">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');

    renderPagination('ordersPagination', data.page, data.pages, p => loadOrders(p, ordersFilter));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--red)">Failed: ${err.message}</td></tr>`;
  }
}

function refreshOrders() { if (ordersPage) loadOrders(ordersPage, ordersFilter); }

async function updateOrderStatus(orderId, newStatus) {
  try {
    await api(`/orders/admin/${orderId}/status`, 'PUT', { status: newStatus });
    Toast.show(`Order status updated to ${STATUS_MAP[newStatus]?.label || newStatus}`);
    const nb = document.getElementById('orderNavBadge');
    if (nb) {
      const dash = await api('/analytics/dashboard');
      nb.textContent = dash.pending_orders || 0;
      nb.style.display = dash.pending_orders ? '' : 'none';
    }
  } catch (err) { Toast.show('Update failed: ' + err.message, 'err'); }
}

async function viewOrderDetail(orderId) {
  try {
    const o = await api(`/orders/${orderId}`);
    document.getElementById('orderDetailTitle').textContent = o.order_number;
    document.getElementById('orderDetailBody').innerHTML = `
      <div class="grid-2" style="margin-bottom:18px;gap:12px;">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:14px;">
          <div class="form-label" style="margin-bottom:8px;">Customer</div>
          <div style="font-weight:600;font-size:.9rem;">${o.customer_name || 'Guest'}</div>
          <div style="font-size:.8rem;color:var(--text-3);font-family:var(--font-mono)">${o.customer_phone||''}</div>
          <div style="font-size:.8rem;color:var(--text-3)">${o.customer_email||''}</div>
        </div>
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:14px;">
          <div class="form-label" style="margin-bottom:8px;">Delivery Address</div>
          <div style="font-size:.85rem;">${o.delivery_name} | ${o.delivery_phone}</div>
          <div style="font-size:.8rem;color:var(--text-3);margin-top:3px;">${o.delivery_street}, ${o.delivery_area}, ${o.delivery_city} – ${o.delivery_pincode}</div>
        </div>
      </div>
      <table class="data-table" style="margin-bottom:16px;">
        <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>
          ${(o.items||[]).map(i => `
            <tr>
              <td>${i.product_name}</td>
              <td style="font-family:var(--font-mono)">${i.quantity} ${i.unit}</td>
              <td style="font-family:var(--font-mono)">${fmtRupee(i.unit_price)}</td>
              <td style="text-align:right;font-family:var(--font-mono);color:var(--green)">${fmtRupee(i.total_price)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
        <div style="font-size:.82rem;color:var(--text-3);">Subtotal: <span style="font-family:var(--font-mono)">${fmtRupee(o.subtotal)}</span></div>
        <div style="font-size:.82rem;color:var(--text-3);">Delivery: <span style="font-family:var(--font-mono)">${o.delivery_charge===0?'FREE':fmtRupee(o.delivery_charge)}</span></div>
        <div style="font-size:1rem;font-weight:800;color:var(--text-1);">Total: <span style="font-family:var(--font-mono);color:var(--green)">${fmtRupee(o.total_amount)}</span></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${statusBadge(o.status)}
        <span style="font-size:.78rem;color:var(--text-3);font-family:var(--font-mono)">Payment: ${(o.payment_method||'').toUpperCase()} | ${(o.payment_status||'').toUpperCase()}</span>
      </div>
      ${o.notes ? `<div style="margin-top:10px;font-size:.82rem;color:var(--text-3);font-style:italic;">Notes: ${o.notes}</div>` : ''}`;
    openModal('orderDetailModal');
  } catch (err) { Toast.show('Failed: ' + err.message, 'err'); }
}

/* ═══════════════════════════════════════════════
   PRODUCTS
═══════════════════════════════════════════════ */
let editProductId = null;

async function loadProducts(page = 1) {
  const tbody = document.getElementById('productsTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7"><div class="spinner"></div></td></tr>`;

  try {
    const data = await api(`/products/?page=${page}&per_page=20`);

    if (!data.products.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🥦</div><p>No products yet. Add your first product!</p></div></td></tr>`;
      return;
    }

    const fallback = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=80&q=50';
    tbody.innerHTML = data.products.map(p => `
      <tr>
        <td>
          <img class="prod-thumb"
               src="${p.image_url || fallback}"
               alt="${p.name}"
               onerror="this.src='${fallback}'">
        </td>
        <td>
          <div style="font-weight:600;font-size:.88rem;">${p.name}</div>
          ${p.name_hi ? `<div style="font-size:.75rem;color:var(--text-3)">${p.name_hi}</div>` : ''}
        </td>
        <td><span class="badge badge-dim" style="text-transform:capitalize">${p.category}</span></td>
        <td><span style="font-family:var(--font-mono);font-weight:700;color:var(--green)">${fmtRupee(p.price_per_unit)}</span><span style="color:var(--text-3);font-size:.75rem">/${p.unit}</span></td>
        <td style="font-family:var(--font-mono);font-size:.82rem">${p.stock_quantity ?? '—'}</td>
        <td>
          <label class="toggle" title="${p.is_available ? 'Mark unavailable' : 'Mark available'}">
            <input type="checkbox" ${p.is_available ? 'checked' : ''}
                   onchange="toggleProductAvailability(${p.id}, this.checked)">
            <div class="toggle-slider"></div>
          </label>
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-icon btn-sm" title="Edit" onclick="openEditProduct(${p.id})">
              <i class="fas fa-pencil"></i>
            </button>
            <button class="btn btn-danger btn-icon btn-sm" title="Delete" onclick="deleteProduct(${p.id}, '${p.name}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');

    renderPagination('productsPagination', data.page, data.pages, p => loadProducts(p));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:20px">Failed: ${err.message}</td></tr>`;
  }
}

function openAddProduct() {
  editProductId = null;
  document.getElementById('productModalTitle').textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  openModal('productModal');
}

async function openEditProduct(id) {
  try {
    const p = await api(`/products/${id}`);
    editProductId = id;
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('pName').value         = p.name    || '';
    document.getElementById('pNameHi').value       = p.name_hi || '';
    document.getElementById('pCategory').value     = p.category || 'vegetable';
    document.getElementById('pPrice').value        = p.price_per_unit || '';
    document.getElementById('pUnit').value         = p.unit    || 'kg';
    document.getElementById('pStock').value        = p.stock_quantity ?? '';
    document.getElementById('pDescription').value  = p.description || '';
    document.getElementById('pImageUrl').value     = p.image_url || '';
    document.getElementById('pAvailable').checked  = p.is_available;
    document.getElementById('pFeatured').checked   = p.is_featured;
    openModal('productModal');
  } catch (err) { Toast.show('Failed to load product: ' + err.message, 'err'); }
}

async function saveProduct() {
  const body = {
    name:           document.getElementById('pName').value.trim(),
    name_hi:        document.getElementById('pNameHi').value.trim(),
    category:       document.getElementById('pCategory').value,
    price_per_unit: parseFloat(document.getElementById('pPrice').value),
    unit:           document.getElementById('pUnit').value,
    stock_quantity: parseInt(document.getElementById('pStock').value) || 0,
    description:    document.getElementById('pDescription').value.trim(),
    image_url:      document.getElementById('pImageUrl').value.trim(),
    is_available:   document.getElementById('pAvailable').checked,
    is_featured:    document.getElementById('pFeatured').checked,
  };

  if (!body.name || !body.price_per_unit) { Toast.show('Name and price are required', 'warn'); return; }

  const btn = document.getElementById('saveProductBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    if (editProductId) {
      await api(`/products/${editProductId}`, 'PUT', body);
      Toast.show('Product updated successfully!');
    } else {
      await api('/products/', 'POST', body);
      Toast.show('Product added successfully!');
    }
    closeModal('productModal');
    loadProducts();
  } catch (err) { Toast.show(err.message, 'err'); }
  finally { btn.disabled = false; btn.textContent = 'Save Product'; }
}

async function toggleProductAvailability(id, available) {
  try {
    await api(`/products/${id}`, 'PUT', { is_available: available });
    Toast.show(`Product marked ${available ? 'available' : 'unavailable'}`);
  } catch (err) { Toast.show(err.message, 'err'); loadProducts(); }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api(`/products/${id}`, 'DELETE');
    Toast.show(`"${name}" deleted`);
    loadProducts();
  } catch (err) { Toast.show(err.message, 'err'); }
}

/* ═══════════════════════════════════════════════
   CUSTOMERS
═══════════════════════════════════════════════ */
async function loadCustomers(page = 1, search = '') {
  const tbody = document.getElementById('customersTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6"><div class="spinner"></div></td></tr>`;

  try {
    let url = `/admin/customers?page=${page}&per_page=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const data = await api(url);

    if (!data.customers.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>No customers found</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.customers.map(c => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--green-dark);border:1px solid rgba(74,222,128,.2);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--green);font-family:var(--font-mono);flex-shrink:0">${(c.name||'?')[0].toUpperCase()}</div>
            <div><div style="font-weight:600;font-size:.87rem;">${c.name}</div></div>
          </div>
        </td>
        <td style="font-family:var(--font-mono);font-size:.8rem;color:var(--text-2)">${c.email}</td>
        <td style="font-family:var(--font-mono);font-size:.8rem">${c.phone || '—'}</td>
        <td style="font-family:var(--font-mono);font-weight:700;color:var(--green)">${fmtRupee(c.total_spent || 0)}</td>
        <td style="font-family:var(--font-mono);font-size:.8rem;color:var(--text-3)">${fmtDate(c.created_at)}</td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${c.is_active ? 'checked' : ''}
                   onchange="toggleCustomer(${c.id}, this.checked)">
            <div class="toggle-slider"></div>
          </label>
        </td>
      </tr>`).join('');

    renderPagination('customersPagination', data.page, data.pages, p => loadCustomers(p, search));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:20px">Failed: ${err.message}</td></tr>`;
  }
}

async function toggleCustomer(id, active) {
  try {
    await api(`/admin/customers/${id}/toggle`, 'PUT', { is_active: active });
    Toast.show(`Customer ${active ? 'activated' : 'deactivated'}`);
  } catch (err) { Toast.show(err.message, 'err'); loadCustomers(); }
}

/* ═══════════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════════ */
async function loadAnalytics() {
  loadDailySalesAnalytics();
  loadProductDemandChart();
  loadFailedSearches();
  loadPrediction();
}

async function loadDailySalesAnalytics() {
  try {
    const days = document.getElementById('analyticsDays')?.value || 30;
    const data = await api(`/analytics/daily-sales?days=${days}`);
    const sales = data.daily_sales || data.sales || [];

    const labels  = sales.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('en-IN',{day:'numeric',month:'short'}); });
    const revenue = sales.map(d => d.revenue);
    const orders  = sales.map(d => d.orders);

    Charts.line('analyticsSalesChart', labels, [
      { label: 'Revenue (₹)', data: revenue, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,.06)' },
    ]);
    Charts.bar('analyticsOrdersChart', labels, [
      { label: 'Orders', data: orders, backgroundColor: 'rgba(96,165,250,.55)', borderColor: 'rgba(96,165,250,.9)' }
    ], { plugins: { legend: { display: false } } });

    // Summary stats
    const totalRev    = revenue.reduce((a, b) => a + b, 0);
    const totalOrders = orders.reduce((a, b) => a + b, 0);
    const avgOrder    = totalOrders ? totalRev / totalOrders : 0;

    document.getElementById('anTotalRev').textContent    = fmtRupee(totalRev);
    document.getElementById('anTotalOrders').textContent = totalOrders;
    document.getElementById('anAvgOrder').textContent    = fmtRupee(avgOrder.toFixed(0));
    document.getElementById('anBestDay').textContent     = revenue.length ? fmtRupee(Math.max(...revenue)) : '—';
  } catch {}
}

async function loadProductDemandChart() {
  try {
    const data = await api('/analytics/product-demand?limit=10');
    if (!data.product_demand?.length) return;

    const labels = data.product_demand.map(p => p.product_name || p.product);
    const counts = data.product_demand.map(p => p.total_quantity || p.quantity_sold || 0);
    const COLORS = ['#4ade80','#60a5fa','#fbbf24','#a78bfa','#f87171','#34d399','#fb7185','#38bdf8','#facc15','#c084fc'];

    Charts.doughnut('demandDonutChart', labels, counts, COLORS);

    // Table
    const tbody = document.getElementById('demandTableTbody');
    if (tbody) {
      tbody.innerHTML = data.product_demand.map((p, i) => `
        <tr>
          <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLORS[i % COLORS.length]};margin-right:6px;"></span>${p.product_name}</td>
          <td style="font-family:var(--font-mono);color:var(--green)">${(p.total_quantity||p.quantity_sold||0).toFixed(1)}</td>
          <td style="font-family:var(--font-mono)">${fmtRupee(p.total_revenue||p.revenue||0)}</td>
          <td style="font-family:var(--font-mono)">${p.order_count||p.orders||0}</td>
        </tr>`).join('');
    }
  } catch {}
}

async function loadFailedSearches() {
  const tbody = document.getElementById('failedSearchesTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4"><div class="spinner"></div></td></tr>`;
  try {
    const data = await api('/analytics/failed-searches?limit=30');
    if (!data.failed_searches?.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🔍</div><p>No failed searches. All searches found results!</p></div></td></tr>`;
      return;
    }
    const max = data.failed_searches[0]?.count || 1;
    tbody.innerHTML = data.failed_searches.map(s => `
      <tr>
        <td style="font-family:var(--font-mono);color:var(--amber)">${s.query}</td>
        <td style="font-family:var(--font-mono);font-weight:700">${s.count}</td>
        <td>
          <div style="height:6px;background:var(--bg-elevated);border-radius:99px;overflow:hidden;min-width:80px;">
            <div style="height:100%;background:var(--amber);border-radius:99px;width:${Math.round(s.count/max*100)}%;transition:.5s"></div>
          </div>
        </td>
        <td>
          <button class="btn btn-amber btn-sm" onclick="window.open('products.html','_blank');Toast.show('Reminder: Add product for &quot;${s.query}&quot;','info')">
            <i class="fas fa-plus"></i> Add Product
          </button>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--red);padding:20px">Failed: ${err.message}</td></tr>`;
  }
}


/* ═══════════════════════════════════════════════
   PREDICTION
═══════════════════════════════════════════════ */
async function loadPrediction() {
  try {
    const data = await api('/analytics/prediction');
    const forecast = data.forecast || [];

    // Forecast chart
    const labels   = forecast.map(d => d.weekday + ' ' + d.date.slice(5));
    const orders   = forecast.map(d => d.orders);
    const revenue  = forecast.map(d => d.revenue);

    Charts.bar('predictionChart', labels, [
      { label: 'Predicted Orders', data: orders, backgroundColor: 'rgba(251,191,36,.6)', borderColor: 'rgba(251,191,36,.9)', borderRadius: 4 },
    ], { plugins: { legend: { display: false } } });

    // Summary cards
    const totalPred = orders.reduce((a,b) => a+b, 0);
    const peakDay   = forecast.reduce((a,b) => a.orders > b.orders ? a : b, forecast[0] || {});
    const el = document.getElementById('predictionSummary');
    if (el) {
      el.innerHTML = `
        <div class="stat-card" style="flex:1;min-width:160px;">
          <div class="stat-icon" style="background:rgba(251,191,36,.1);color:#fbbf24"><i class="fas fa-chart-line"></i></div>
          <div class="stat-body">
            <div class="stat-val">${totalPred.toFixed(0)}</div>
            <div class="stat-lbl">Orders Next 7 Days</div>
          </div>
        </div>
        <div class="stat-card" style="flex:1;min-width:160px;">
          <div class="stat-icon" style="background:rgba(96,165,250,.1);color:#60a5fa"><i class="fas fa-bolt"></i></div>
          <div class="stat-body">
            <div class="stat-val">${data.peak_hour_label || '--'}</div>
            <div class="stat-lbl">Busiest Hour</div>
          </div>
        </div>
        <div class="stat-card" style="flex:1;min-width:160px;">
          <div class="stat-icon" style="background:rgba(74,222,128,.1);color:#4ade80"><i class="fas fa-calendar-star"></i></div>
          <div class="stat-body">
            <div class="stat-val">${peakDay.weekday || '--'}</div>
            <div class="stat-lbl">Busiest Day Predicted</div>
          </div>
        </div>
        <div class="stat-card" style="flex:1;min-width:160px;">
          <div class="stat-icon" style="background:rgba(168,85,247,.1);color:#a855f7"><i class="fas fa-seedling"></i></div>
          <div class="stat-body">
            <div class="stat-val">${(data.top_predicted?.[0]?.product || '--').split(' ').slice(0,2).join(' ')}</div>
            <div class="stat-lbl">Top Product This Week</div>
          </div>
        </div>`;
    }

    // Top predicted products list
    const topEl = document.getElementById('topPredictedList');
    if (topEl && data.top_predicted?.length) {
      topEl.innerHTML = data.top_predicted.map((p, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-family:var(--font-mono);color:var(--green);font-weight:700;">${i+1}</div>
          <div style="flex:1;font-size:.85rem;font-weight:600;">${p.product}</div>
          <div style="font-family:var(--font-mono);font-size:.78rem;color:var(--amber)">${p.orders} orders</div>
        </div>`).join('');
    }

    const confEl = document.getElementById('predictionConfidence');
    if (confEl) confEl.textContent = `Confidence: ${data.confidence} (${data.data_points} days of data)`;

  } catch (err) {
    console.warn('Prediction failed:', err.message);
  }
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function renderPagination(containerId, current, total, onPage) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if(el) el.innerHTML = ''; return; }
  const pages = [];
  for (let i = 1; i <= total; i++) pages.push(i);
  el.innerHTML = pages.map(p => `
    <button class="page-btn ${p === current ? 'active' : ''}" onclick="(${onPage})(${p})">${p}</button>
  `).join('');
}