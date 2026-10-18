const $ = selector => document.querySelector(selector);
let menu = [];
let orders = [];
let design = {};
let designHasDraft = false;
let promotions = [];
let coupons = [];
let reviews = [];
let auditLogs = [];
let staff = [];
let tables = [];
let deliverySettings = {};
let deliveryDestinations = [];
let deliveryMap = null;
let leafletPromise = null;
let analytics = null;
let toastTimer;

const money = amount => `${new Intl.NumberFormat('en-US').format(amount)} IQD`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function renderTables() {
  $('#tableList').innerHTML = tables.length ? tables.map(table => `
    <article class="admin-feature-item"><div class="dashboard-top"><b>Table ${escapeHTML(table.number)}</b><span>${escapeHTML(table.status)}</span></div>
      <div class="admin-item-actions">
        ${table.status === 'Occupied' ? '' : `<button class="button button-outline" data-table-reserve="${escapeHTML(table.id)}" data-reserved="${table.status !== 'Reserved'}">${table.status === 'Reserved' ? 'Make available' : 'Reserve'}</button>`}
        <button class="button button-outline" data-table-delete="${escapeHTML(table.id)}" ${table.status === 'Occupied' ? 'disabled' : ''}>Remove table</button>
      </div>
    </article>`).join('') : '<p class="hint">No tables configured. Add table numbers before enabling dine-in orders.</p>';
}

function renderReportFilters() {
  const productSelect = $('#reportProduct');
  const staffSelect = $('#reportStaff');
  const productValue = productSelect.value;
  const staffValue = staffSelect.value;
  productSelect.innerHTML = `<option value="">All products</option>${menu.map(item =>
    `<option value="${item.id}">${escapeHTML(item.name)}</option>`).join('')}`;
  staffSelect.innerHTML = `<option value="">All staff</option><option value="owner">Owner</option>${staff.map(account =>
    `<option value="${escapeHTML(account.id)}">${escapeHTML(account.name)} · ${escapeHTML(account.role)}</option>`).join('')}`;
  productSelect.value = productValue;
  staffSelect.value = staffValue;
}

function reportQuery() {
  const parameters = new URLSearchParams();
  for (const [key, value] of new FormData($('#reportFilters'))) {
    if (value) parameters.set(key, value);
  }
  const query = parameters.toString();
  return `/api/admin/analytics${query ? `?${query}` : ''}`;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
}

function safeLink(value) {
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function setImagePreview(inputId, previewId, emptyId) {
  const value = $(`#${inputId}`).value.trim();
  const preview = $(`#${previewId}`);
  const empty = $(`#${emptyId}`);
  preview.classList.toggle('hidden', !value);
  empty.classList.toggle('hidden', Boolean(value));
  if (value) {
    preview.src = value;
    preview.onerror = () => {
      preview.classList.add('hidden');
      empty.textContent = 'Image preview could not be loaded.';
      empty.classList.remove('hidden');
    };
  } else {
    preview.removeAttribute('src');
    preview.onerror = null;
  }
}

function renderImagePreviews() {
  setImagePreview('logoImage', 'logoPreview', 'logoPreviewEmpty');
  setImagePreview('backgroundImage', 'backgroundPreview', 'backgroundPreviewEmpty');
  setImagePreview('heroImage', 'heroPreview', 'heroPreviewEmpty');
  setImagePreview('aboutImage', 'aboutPreview', 'aboutPreviewEmpty');
  setImagePreview('itemImage', 'itemPreview', 'itemPreviewEmpty');
  setImagePreview('promotionImage', 'promotionPreview', 'promotionPreviewEmpty');
}

function uploadImage(file, progress) {
  const extensionType = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const declaredType = file.type || extensionType[file.name.split('.').pop().toLowerCase()];
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(declaredType)) {
    return Promise.reject(new Error('Choose a JPG, PNG, or WebP image.'));
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error('Image files must be smaller than 5 MB.'));
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/admin/uploads');
    request.setRequestHeader('Content-Type', declaredType);
    request.upload.onprogress = event => {
      if (event.lengthComputable) progress.textContent = `Uploading ${Math.round(event.loaded / event.total * 100)}%`;
    };
    request.onerror = () => reject(new Error('Image upload failed because the server could not be reached.'));
    request.onload = () => {
      let result;
      try {
        result = JSON.parse(request.responseText);
      } catch {
        reject(new Error('The server returned an unreadable upload response.'));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result.error || 'Image upload failed.'));
        return;
      }
      progress.textContent = 'Upload complete. Save or publish to apply it.';
      resolve(result);
    };
    request.send(file);
  });
}

async function deleteUnusedImage(imageUrl) {
  if (!imageUrl?.startsWith('/uploads/')) return;
  try {
    await api(`/api/admin/uploads/${encodeURIComponent(imageUrl.slice('/uploads/'.length))}`, { method: 'DELETE' });
  } catch (error) {
    toast(`Saved, but the previous image was not deleted: ${error.message}`);
  }
}

function renderMenu() {
  $('#menuList').innerHTML = menu.length ? menu.map(item => `
    <article class="admin-menu-item">
      <div>${item.image
        ? `<img class="admin-item-image" src="${escapeHTML(item.image)}" alt="">`
        : `<span class="admin-item-emoji">${escapeHTML(item.emoji)}</span>`}</div>
      <div class="admin-item-details"><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.category)} · ${money(item.price)}</small><p>${escapeHTML(item.desc)}</p></div>
      <div class="admin-item-actions"><span class="availability-pill ${item.available === false ? 'is-unavailable' : ''}">${item.available === false ? 'Unavailable' : 'Available'}</span><button class="button button-outline" data-edit="${item.id}">Edit</button><button class="button button-outline" data-delete="${item.id}">Delete</button></div>
    </article>`).join('') : '<p class="no-orders">No products are on the menu yet.</p>';
}

function renderDesign() {
  $('#restaurantName').value = design.restaurantName || '';
  $('#logoText').value = design.logoText || '';
  $('#logoImage').value = design.logoImage || '';
  $('#themePreset').value = design.themePreset || 'new-burger-bright';
  $('#backgroundColor').value = design.backgroundColor || '#fffaf4';
  $('#secondaryBackground').value = design.secondaryBackground || '#ffffff';
  $('#accentColor').value = design.accentColor || '#c62832';
  $('#goldColor').value = design.goldColor || '#f3c744';
  $('#textColor').value = design.textColor || '#202124';
  $('#mutedColor').value = design.mutedColor || '#626873';
  $('#cardColor').value = design.cardColor || '#ffffff';
  $('#borderColor').value = design.borderColor || '#e8e3dc';
  $('#cornerRadius').value = design.cornerRadius || 14;
  $('#heroOverlay').value = design.heroOverlay ?? 48;
  $('#heroOverlayValue').value = `${$('#heroOverlay').value}%`;
  $('#backgroundStyle').value = design.backgroundStyle || 'pattern';
  $('#backgroundImage').value = design.backgroundImage || '';
  $('#heroImage').value = design.heroImage || '';
  $('#aboutImage').value = design.aboutImage || '';
  $('#showFeatured').checked = design.showFeatured !== false;
  $('#showOffers').checked = design.showOffers !== false;
  $('#showBenefits').checked = design.showBenefits !== false;
  const language = $('#contentLanguage').value;
  const content = design.localizedContent?.[language] || design.localizedContent?.en || {};
  $('#heroTitle').value = content.heroTitle || (language === 'en' ? 'Good food. Good mood.' : '');
  $('#heroSubtitle').value = content.heroSubtitle || (language === 'en' ? 'Freshly prepared favourites, made for sharing.' : '');
  $('#heroButton').value = content.heroButton || (language === 'en' ? 'Order now' : '');
  $('#aboutStory').value = content.aboutStory || (language === 'en' ? design.aboutStory || '' : '');
  $('#contactPhone').value = design.contactPhone || '';
  $('#contactEmail').value = design.contactEmail || '';
  $('#contactAddress').value = design.contactAddress || '';
  $('#rewardsPointsPer1000').value = design.rewardsPointsPer1000 || 0;
  $('#rewardsThreshold').value = design.rewardsThreshold || 0;
  $('#rewardsDescription').value = design.rewardsDescription || '';
  renderImagePreviews();
  $('#designStatus').textContent = designHasDraft
    ? 'A saved draft is available. Customers still see the currently published version.'
    : 'Editing the current published version.';
}

function captureLocalizedContent() {
  const language = $('#contentLanguage').value;
  const localizedContent = { ...(design.localizedContent || {}) };
  localizedContent[language] = {
    ...(localizedContent[language] || {}),
    heroTitle: $('#heroTitle').value,
    heroSubtitle: $('#heroSubtitle').value,
    heroButton: $('#heroButton').value,
    aboutStory: $('#aboutStory').value
  };
  return localizedContent;
}

function designFormData() {
  return {
    restaurantName: $('#restaurantName').value,
    logoText: $('#logoText').value,
    logoImage: $('#logoImage').value,
    themePreset: $('#themePreset').value,
    backgroundColor: $('#backgroundColor').value,
    secondaryBackground: $('#secondaryBackground').value,
    accentColor: $('#accentColor').value,
    goldColor: $('#goldColor').value,
    textColor: $('#textColor').value,
    mutedColor: $('#mutedColor').value,
    cardColor: $('#cardColor').value,
    borderColor: $('#borderColor').value,
    cornerRadius: Number($('#cornerRadius').value),
    heroOverlay: Number($('#heroOverlay').value),
    backgroundStyle: $('#backgroundStyle').value,
    backgroundImage: $('#backgroundImage').value,
    heroImage: $('#heroImage').value,
    aboutImage: $('#aboutImage').value,
    showFeatured: $('#showFeatured').checked,
    showOffers: $('#showOffers').checked,
    showBenefits: $('#showBenefits').checked,
    localizedContent: captureLocalizedContent(),
    aboutStory: $('#aboutStory').value,
    contactPhone: $('#contactPhone').value,
    contactEmail: $('#contactEmail').value,
    contactAddress: $('#contactAddress').value,
    rewardsPointsPer1000: Number($('#rewardsPointsPer1000').value),
    rewardsThreshold: Number($('#rewardsThreshold').value),
    rewardsDescription: $('#rewardsDescription').value
  };
}

function renderDeliverySettings() {
  $('#deliveryFee').value = deliverySettings.deliveryFee ?? 0;
  $('#minimumOrder').value = deliverySettings.minimumOrder ?? 0;
  $('#pickupEnabled').checked = deliverySettings.pickupEnabled !== false;
  $('#dineInEnabled').checked = deliverySettings.dineInEnabled === true;
  $('#deliveryAreaLatitude').value = deliverySettings.deliveryArea?.latitude ?? '';
  $('#deliveryAreaLongitude').value = deliverySettings.deliveryArea?.longitude ?? '';
  $('#deliveryAreaRadius').value = deliverySettings.deliveryArea?.radiusKm ?? '';
}

function renderStaff() {
  $('#staffList').innerHTML = staff.length ? staff.map(account => `
    <article class="admin-feature-item"><div class="dashboard-top"><b>${escapeHTML(account.name)} · ${escapeHTML(account.role)}</b><span>${account.active ? 'Active' : 'Disabled'}</span></div>
      <p>${escapeHTML(account.email)}</p><div class="admin-item-actions"><button class="button button-outline" data-staff-active="${escapeHTML(account.id)}" data-active="${!account.active}">${account.active ? 'Disable' : 'Enable'}</button><button class="button button-outline" data-staff-delete="${escapeHTML(account.id)}">Delete</button></div>
    </article>`).join('') : '<p class="hint">No cashier, kitchen, or driver accounts have been created yet.</p>';
  const driverOptions = staff.filter(account => account.active && account.role === 'driver')
    .map(account => `<option value="${escapeHTML(account.id)}">${escapeHTML(account.name)}</option>`).join('');
  document.querySelectorAll('[data-driver-select]').forEach(select => {
    const order = orders.find(item => item.id === select.dataset.driverSelect);
    select.innerHTML = `<option value="">${order?.driverId ? 'Reassign driver' : 'Assign driver'}</option>${driverOptions}`;
    if (order?.driverId) select.value = order.driverId;
    select.disabled = !driverOptions || !['Ready', 'Assigned', 'Delivery problem'].includes(order?.status);
  });
}

async function loadLeaflet() {
  if (window.L) return window.L;
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error('The OpenStreetMap library failed to load.'));
      };
      document.head.append(script);
    });
  }
  return leafletPromise;
}

async function renderDeliveryMap() {
  const element = $('#deliveryMap');
  if (!element) return;
  deliveryMap?.remove();
  if (!deliveryDestinations.length) {
    element.innerHTML = '<p class="hint">No delivery orders with saved map pins yet.</p>';
    return;
  }
  try {
    const L = await loadLeaflet();
    element.replaceChildren();
    deliveryMap = L.map(element).setView(
      [deliveryDestinations[0].address.latitude, deliveryDestinations[0].address.longitude],
      deliveryDestinations.length === 1 ? 14 : 11
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(deliveryMap);
    const bounds = [];
    for (const order of deliveryDestinations) {
      const address = order.address;
      const point = [address.latitude, address.longitude];
      bounds.push(point);
      const popup = `<b>${escapeHTML(order.id)}</b><br>${escapeHTML(order.status)}<br>${escapeHTML(order.customer.name)} · ${escapeHTML(order.customer.phone)}<br>${escapeHTML([address.label, address.building, address.street, address.city].filter(Boolean).join(', '))}<br>${escapeHTML(address.notes || '')}<br><a target="_blank" rel="noopener noreferrer" href="${escapeHTML(order.address.mapLink)}">Open in map</a>`;
      L.marker(point).addTo(deliveryMap).bindPopup(popup);
    }
    if (bounds.length > 1) deliveryMap.fitBounds(bounds, { padding: [25, 25] });
    setTimeout(() => deliveryMap.invalidateSize(), 50);
  } catch (error) {
    element.innerHTML = `<p class="form-error" role="alert">${escapeHTML(error.message)}</p>`;
  }
}

function dateTimeInput(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function renderPromotions() {
  $('#promotionList').innerHTML = promotions.length ? promotions.map(promotion => `
    <article class="admin-feature-item">
      <div class="dashboard-top"><b>${escapeHTML(promotion.title)}</b><span>${new Date(promotion.startsAt).toLocaleString()} — ${new Date(promotion.endsAt).toLocaleString()}</span></div>
      ${promotion.image ? `<img class="admin-item-image" src="${escapeHTML(promotion.image)}" alt="">` : ''}
      <p>${escapeHTML(promotion.description)}</p>
      <div class="admin-item-actions"><button class="button button-outline" data-promotion-edit="${escapeHTML(promotion.id)}">Edit</button><button class="button button-outline" data-promotion-delete="${escapeHTML(promotion.id)}">Delete</button></div>
    </article>`).join('') : '<p class="hint">No offers have been configured.</p>';
}

function renderCoupons() {
  $('#couponList').innerHTML = coupons.length ? coupons.map(coupon => `
    <article class="admin-feature-item">
      <div class="dashboard-top"><b>${escapeHTML(coupon.code)} · ${coupon.discountType === 'percentage' ? `${coupon.amount}%` : money(coupon.amount)}</b><span>${coupon.active ? 'Active' : 'Disabled'} · ${coupon.usageCount}${coupon.usageLimit ? `/${coupon.usageLimit}` : ''} uses</span></div>
      <p>Minimum ${money(coupon.minimumSubtotal)} · Per customer ${coupon.perCustomerLimit} · ${coupon.deliveryTypes.map(type => type === 'dine-in' ? 'Dine-in' : type === 'pickup' ? 'Pickup' : 'Delivery').join(', ')}</p>
      <small>${new Date(coupon.startsAt).toLocaleString()} — ${new Date(coupon.endsAt).toLocaleString()}</small>
      <div class="admin-item-actions"><button class="button button-outline" data-coupon-edit="${escapeHTML(coupon.id)}">Edit</button><button class="button button-outline" data-coupon-delete="${escapeHTML(coupon.id)}">Delete</button></div>
    </article>`).join('') : '<p class="hint">No coupons configured.</p>';
}

function renderAuditLogs() {
  $('#auditLogList').innerHTML = auditLogs.length ? auditLogs.map(entry => `
    <article class="admin-feature-item"><div class="dashboard-top"><b>${escapeHTML(entry.action)}</b><span>${escapeHTML(entry.actorRole)} · ${new Date(entry.at).toLocaleString()}</span></div>
      <small>${escapeHTML(entry.entityType)} ${escapeHTML(entry.entityId)} · ${escapeHTML(entry.actorId)}</small>
    </article>`).join('') : '<p class="hint">No administrative actions recorded yet.</p>';
}

function renderReviews() {
  $('#reviewAdminList').innerHTML = reviews.length ? reviews.map(review => `
    <article class="admin-feature-item">
      <div class="dashboard-top"><b>${escapeHTML(review.displayName || 'Verified customer')} · ${review.rating}/5</b><span>${review.approved ? 'Approved' : 'Pending approval'}</span></div>
      <p>${escapeHTML(review.comment)}</p><small>Order ${escapeHTML(review.orderId)} · ${new Date(review.createdAt).toLocaleString()}</small>
      <div class="admin-item-actions">${review.approved
        ? `<button class="button button-outline" data-review-approve="${escapeHTML(review.id)}" data-approved="false">Unpublish</button>`
        : `<button class="button button-dark" data-review-approve="${escapeHTML(review.id)}" data-approved="true">Approve</button>`}
        <button class="button button-outline" data-review-delete="${escapeHTML(review.id)}">Delete</button></div>
    </article>`).join('') : '<p class="hint">No customer reviews have been submitted.</p>';
}

function nextOrderStatuses(order) {
  const shared = {
    'Pending approval': ['Confirmed', 'Cancelled'],
    Confirmed: ['Preparing', 'Cancelled'],
    Preparing: ['Ready', 'Cancelled'],
    Served: ['Completed']
  };
  const typeNext = order.deliveryType === 'delivery'
    ? { Ready: ['Assigned', 'Cancelled'], Assigned: ['Picked Up', 'Delivery problem', 'Cancelled'], 'Picked Up': ['Out for delivery', 'Delivered', 'Delivery problem'], 'Out for delivery': ['Delivered', 'Delivery problem'], 'Delivery problem': ['Assigned', 'Cancelled'] }
    : order.deliveryType === 'pickup'
      ? { Ready: ['Collected', 'Cancelled'] }
      : { Ready: ['Served', 'Cancelled'] };
  return [...new Set([order.status, ...(shared[order.status] || typeNext[order.status] || [])])];
}

function renderOrders() {
  const query = $('#orderSearch').value.trim().toLowerCase();
  const orderType = $('#orderTypeFilter').value;
  const paymentType = $('#orderPaymentFilter').value;
  const filteredOrders = orders.filter(order =>
    `${order.id} ${order.customer.name} ${order.customer.phone} ${order.status} ${order.payment || ''}`.toLowerCase().includes(query) &&
    (!orderType || (orderType === 'delivery' && order.deliveryType === 'delivery') || (orderType === 'takeaway' && order.deliveryType === 'pickup')) &&
    (!paymentType || (paymentType === 'delivery' && order.payment === 'Cash on delivery') ||
      (paymentType === 'store' && ['Cash at pickup', 'Cash at table'].includes(order.payment)))
  );
  $('#ordersList').innerHTML = filteredOrders.length ? filteredOrders.map(order => {
    const mapLink = safeLink(order.address?.mapLink);
    const address = order.address;
    return `<article class="admin-order-card">
      <div class="dashboard-top"><div><h3>${escapeHTML(order.id)}</h3><small>${new Date(order.createdAt).toLocaleString()}</small></div><b>${money(order.total)}</b></div>
      <p><b>${order.deliveryType === 'delivery' ? 'Delivery' : order.deliveryType === 'dine-in' ? `Dine-in · Table ${escapeHTML(order.tableNumber)}` : 'Pickup / Takeaway'}</b> · ${escapeHTML(order.source || 'online')}</p>
      <p><b>${escapeHTML(order.customer.name)}</b>${order.customer.phone ? ` · ${escapeHTML(order.customer.phone)}` : ''}</p>
      <p>${order.items.map(item => `${item.quantity}× ${escapeHTML(item.name)}${item.extras?.length ? ` (+${item.extras.map(extra => escapeHTML(extra.name)).join(', ')})` : ''}${item.instructions ? ` · Note: ${escapeHTML(item.instructions)}` : ''}`).join('<br>')}</p>
      <p><b>${order.deliveryType === 'pickup' ? 'Pickup / Takeaway' : order.deliveryType === 'dine-in' ? `Dine-in · Table ${escapeHTML(order.tableNumber)}` : 'Delivery'}</b>${address ? ` · ${escapeHTML([address.label, address.building, address.street, address.city].filter(Boolean).join(', '))}${address.unit ? `, ${escapeHTML(address.unit)}` : ''}` : ''}</p>
      ${address?.mapAddress ? `<p class="hint">${escapeHTML(address.mapAddress)}</p>` : ''}
      ${address?.notes ? `<p class="hint">Delivery notes: ${escapeHTML(address.notes)}</p>` : ''}
      ${mapLink ? `<a href="${escapeHTML(mapLink)}" target="_blank" rel="noopener noreferrer">Open map ↗</a>` : ''}
      <p class="hint">Payment: ${escapeHTML(order.payment || 'Cash on delivery')} · ${escapeHTML(order.paymentStatus || 'Pending')}</p>
      ${order.paymentStatus === 'Pending' ? `<button class="button button-outline" data-payment-confirm="${escapeHTML(order.id)}">Confirm cash received</button>` : ''}
      ${order.deliveryType === 'delivery' ? `<label class="admin-order-status">Assign driver<select data-driver-select="${escapeHTML(order.id)}"><option value="">Loading drivers</option></select></label>` : ''}
      <div class="admin-order-status"><label for="status-${escapeHTML(order.id)}">Order status</label>
        <select id="status-${escapeHTML(order.id)}" data-status="${escapeHTML(order.id)}">${nextOrderStatuses(order).map(status =>
          `<option value="${escapeHTML(status)}" ${status === order.status ? 'selected' : ''}>${escapeHTML(status)}</option>`
        ).join('')}</select>
      </div>
      ${order.status === 'Pending approval' ? `<div class="admin-item-actions order-decision-actions"><button class="button button-dark" type="button" data-order-action="Confirmed" data-order-id="${escapeHTML(order.id)}">Accept</button><button class="button button-outline" type="button" data-order-action="Cancelled" data-order-id="${escapeHTML(order.id)}">Reject</button></div>` : ''}
      <button class="button button-outline print-order" data-print="${escapeHTML(order.id)}">Print order</button>
    </article>`;
  }).join('') : `<p class="no-orders">${orders.length ? 'No orders match the current search and filters.' : 'No customer orders have been placed yet.'}</p>`;
}

async function updateOrderStatus(orderId, status, control, successMessage = 'Order status updated') {
  if (control) control.disabled = true;
  try {
    await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadData();
    toast(successMessage);
  } catch (error) {
    toast(error.message);
    await loadData().catch(loadError => toast(loadError.message));
  }
}

function renderAnalytics() {
  if (!analytics) return;
  const cards = [
    ['Total orders', analytics.totalOrders],
    ['Completed orders', analytics.completedOrders],
    ["Today's orders", analytics.todayOrders],
    ["Today's collected revenue", money(analytics.todayRevenue ?? analytics.todaySales)],
    ['Collected revenue', money(analytics.collectedRevenue)],
    ['Total order value', money(analytics.totalOrderValue)],
    ['Pending orders', analytics.pendingOrders],
    ['Pending payment amount', money(analytics.pendingPaymentAmount)]
  ];
  $('#analyticsCards').innerHTML = cards.map(([label, value]) =>
    `<article class="dashboard-stat"><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></article>`
  ).join('');
  const max = Math.max(1, ...analytics.byDay.map(day => day.total));
  $('#salesChart').innerHTML = analytics.byDay.map(day => `
    <div class="chart-day" title="${escapeHTML(day.date)}: ${money(day.total)}">
      <div class="chart-bar" style="height:${Math.max(3, day.total / max * 100)}%"></div>
      <small>${escapeHTML(day.date.slice(5))}</small><b>${money(day.total)}</b>
    </div>`).join('');
  $('#bestSellers').innerHTML = analytics.bestSellers.length
    ? analytics.bestSellers.map(item => `<p><span>${escapeHTML(item.name)}</span><b>${item.quantity} sold</b></p>`).join('')
    : '<p class="hint">No completed orders recorded yet.</p>';
  $('#salesByType').innerHTML = analytics.salesByType.map(item => `
    <p><span>${item.type === 'dine-in' ? 'Dine-in' : item.type === 'pickup' ? 'Pickup / Takeaway' : 'Delivery'} · ${item.completedOrders} completed</span><b>${money(item.collectedRevenue)}</b></p>
  `).join('');
  $('#unavailableItems').innerHTML = analytics.unavailableItems.length
    ? analytics.unavailableItems.map(item => `<p>${escapeHTML(item.name)}</p>`).join('')
    : '<p class="hint">All listed products are available.</p>';
}

function printOrder(order) {
  const receipt = window.open('', '_blank');
  if (!receipt) return toast('Allow pop-ups to print an order ticket.');
  receipt.opener = null;
  const itemLines = order.items.map(item =>
    `<li>${item.quantity} × ${escapeHTML(item.name)} — ${money((item.price + (item.extras || []).reduce((sum, extra) => sum + extra.price, 0)) * item.quantity)}${item.extras?.length ? `<br><small>Extras: ${item.extras.map(extra => escapeHTML(extra.name)).join(', ')}</small>` : ''}${item.instructions ? `<br><small>Note: ${escapeHTML(item.instructions)}</small>` : ''}</li>`
  ).join('');
  const address = order.address;
  const orderType = order.deliveryType === 'delivery'
    ? 'Delivery'
    : order.deliveryType === 'dine-in' ? `Dine-in · Table ${escapeHTML(order.tableNumber)}` : 'Pickup / Takeaway';
  receipt.document.write(`<!doctype html><html><head><title>Order ${escapeHTML(order.id)}</title><style>body{font:16px Arial;max-width:640px;margin:32px auto;padding:0 20px;color:#17251e}h1{font-size:24px}li{padding:12px 0;border-bottom:1px solid #ddd}.total{font-size:20px;font-weight:bold}</style></head><body><h1>Order ${escapeHTML(order.id)}</h1><p>${new Date(order.createdAt).toLocaleString()}</p><p><b>${orderType}</b> · ${escapeHTML(order.source || 'online')}</p><p>${escapeHTML(order.customer.name)} · ${escapeHTML(order.customer.phone)}</p>${address ? `<p>${escapeHTML([address.label, address.building, address.street, address.city, address.unit, address.notes].filter(Boolean).join(', '))}</p><p><a href="${escapeHTML(address.mapLink)}">Open delivery destination</a></p>` : ''}<ul>${itemLines}</ul><p class="total">Total: ${money(order.total)}</p><p>Payment: ${escapeHTML(order.paymentStatus || 'Pending')} · ${escapeHTML(order.payment || '')}</p><p>Status: ${escapeHTML(order.status)}</p><script>window.onload=()=>window.print()</script></body></html>`);
  receipt.document.close();
}

function resetMenuForm() {
  $('#menuForm').reset();
  $('#itemId').value = '';
  $('#saveItemBtn').textContent = 'Add product';
  $('#cancelEditBtn').classList.add('hidden');
  $('#menuError').textContent = '';
  $('#itemUpload').value = '';
  $('#itemUploadProgress').textContent = '';
  renderImagePreviews();
}

function editMenuItem(item) {
  $('#itemId').value = item.id;
  $('#itemName').value = item.name;
  $('#itemCategory').value = item.category;
  $('#itemPrice').value = item.price;
  $('#itemTag').value = item.tag;
  $('#itemDescription').value = item.desc;
  $('#itemImage').value = item.image;
  $('#itemEmoji').value = item.emoji;
  $('#itemIngredients').value = (item.ingredients || []).join(', ');
  $('#itemExtras').value = (item.extras || []).map(extra => `${extra.name}, ${extra.price}`).join('\n');
  $('#itemAvailable').checked = item.available !== false;
  $('#itemPrepTime').value = item.prepTime || '';
  $('#saveItemBtn').textContent = 'Save changes';
  $('#cancelEditBtn').classList.remove('hidden');
  $('#menuError').textContent = '';
  renderImagePreviews();
  $('#itemName').focus();
}

function menuFormData() {
  const extras = $('#itemExtras').value.split('\n').filter(line => line.trim()).map(line => {
    const separator = line.lastIndexOf(',');
    if (separator < 1 || !/^\s*\d+\s*$/.test(line.slice(separator + 1))) {
      throw new Error('Enter each extra as “name, price” on its own line.');
    }
    return { name: line.slice(0, separator).trim(), price: Number(line.slice(separator + 1)) };
  });
  return {
    name: $('#itemName').value,
    category: $('#itemCategory').value,
    price: Number($('#itemPrice').value),
    desc: $('#itemDescription').value,
    image: $('#itemImage').value,
    emoji: $('#itemEmoji').value,
    tag: $('#itemTag').value,
    ingredients: $('#itemIngredients').value.split(',').map(value => value.trim()).filter(Boolean),
    extras,
    available: $('#itemAvailable').checked,
    prepTime: $('#itemPrepTime').value || null
  };
}

async function loadData() {
  const [nextMenu, nextOrders, nextDesign, nextAnalytics, nextPromotions, nextReviews, nextSettings, nextStaff, nextDestinations, nextTables, nextCoupons, nextAuditLogs] = await Promise.all([
    api('/api/admin/menu'),
    api('/api/admin/orders'),
    api('/api/admin/design/draft'),
    api(reportQuery()),
    api('/api/admin/promotions'),
    api('/api/admin/reviews'),
    api('/api/admin/delivery-settings'),
    api('/api/admin/staff'),
    api('/api/staff/delivery-map'),
    api('/api/admin/tables'),
    api('/api/admin/coupons'),
    api('/api/admin/audit-logs?limit=100')
  ]);
  menu = nextMenu;
  orders = nextOrders;
  design = nextDesign.design;
  designHasDraft = nextDesign.hasDraft;
  analytics = nextAnalytics;
  promotions = nextPromotions;
  reviews = nextReviews;
  deliverySettings = nextSettings;
  staff = nextStaff;
  deliveryDestinations = nextDestinations;
  tables = nextTables;
  coupons = nextCoupons;
  auditLogs = nextAuditLogs;
  renderReportFilters();
  renderMenu();
  renderOrders();
  renderDesign();
  renderAnalytics();
  renderPromotions();
  renderReviews();
  renderCoupons();
  renderAuditLogs();
  renderDeliverySettings();
  renderStaff();
  renderTables();
  await renderDeliveryMap();
}

async function showLogin() {
  $('#loginPanel').classList.remove('hidden');
  $('#adminPanel').classList.add('hidden');
  $('#logoutBtn').classList.add('hidden');
  try {
    const session = await api('/api/admin/session');
    $('#setupHint').textContent = session.configured
      ? 'Use the admin email and password configured for this server.'
      : 'Admin login is disabled. Configure ADMIN_EMAIL and ADMIN_PASSWORD in the server environment, then restart it.';
  } catch (error) {
    $('#setupHint').textContent = error.message;
  }
}

async function showAdmin() {
  $('#loginPanel').classList.add('hidden');
  $('#adminPanel').classList.remove('hidden');
  $('#logoutBtn').classList.remove('hidden');
  await loadData();
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  $('#loginError').textContent = '';
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) });
    $('#email').value = '';
    $('#password').value = '';
    await showAdmin();
  } catch (error) {
    $('#loginError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#menuForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#itemId').value;
  const button = $('#saveItemBtn');
  button.disabled = true;
  $('#menuError').textContent = '';
  try {
    const itemData = menuFormData();
    const previousImage = id ? menu.find(item => String(item.id) === id)?.image : '';
    await api(id ? `/api/admin/menu/${encodeURIComponent(id)}` : '/api/admin/menu', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(itemData)
    });
    resetMenuForm();
    await loadData();
    if (previousImage && previousImage !== itemData.image) await deleteUnusedImage(previousImage);
    toast(id ? 'Menu item updated' : 'Menu item added');
  } catch (error) {
    $('#menuError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#designForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#saveDesignBtn');
  button.disabled = true;
  $('#designError').textContent = '';
  try {
    const result = await api('/api/admin/design/draft', {
      method: 'PUT',
      body: JSON.stringify(designFormData())
    });
    design = result.design;
    designHasDraft = true;
    renderDesign();
    $('#designStatus').textContent = 'Draft saved on the server. It is not live until published.';
    toast('Website draft saved');
  } catch (error) {
    $('#designError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#publishDesignBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  $('#designError').textContent = '';
  try {
    await api('/api/admin/design/draft', {
      method: 'PUT',
      body: JSON.stringify(designFormData())
    });
    design = await api('/api/admin/design/publish', { method: 'POST' });
    designHasDraft = false;
    renderDesign();
    toast('Website changes published and live for customers.');
  } catch (error) {
    $('#designError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#previewDesignBtn').addEventListener('click', event => {
  const preview = window.open('/', '_blank');
  if (!preview) return toast('Allow pop-ups to preview the customer website.');
  const message = { type: 'website-design-preview', design: designFormData() };
  preview.addEventListener('load', () => preview.postMessage(message, window.location.origin), { once: true });
  event.currentTarget.blur();
});

$('#cancelDesignBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await api('/api/admin/design/draft');
    design = result.design;
    designHasDraft = result.hasDraft;
    renderDesign();
    $('#designError').textContent = '';
    toast('Unsaved changes cancelled.');
  } catch (error) {
    $('#designError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#restoreDesignBtn').addEventListener('click', async event => {
  if (!window.confirm('Restore the previous published website design?')) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    design = await api('/api/admin/design/restore', { method: 'POST' });
    designHasDraft = false;
    renderDesign();
    toast('Previous website version restored.');
  } catch (error) {
    $('#designError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#resetThemeBtn').addEventListener('click', () => {
  $('#themePreset').value = 'new-burger-bright';
  for (const [id, value] of Object.entries({
    backgroundColor: '#fffaf4', secondaryBackground: '#ffffff', accentColor: '#c62832',
    goldColor: '#f3c744', textColor: '#202124', mutedColor: '#626873',
    cardColor: '#ffffff', borderColor: '#e8e3dc'
  })) $(`#${id}`).value = value;
  $('#cornerRadius').value = 14;
  $('#heroOverlay').value = 0;
  $('#heroOverlayValue').value = '0%';
  $('#backgroundStyle').value = 'plain';
  $('#designStatus').textContent = 'New Burger Bright defaults selected. Save as a draft and publish to apply.';
});

$('#contentLanguage').addEventListener('change', () => {
  design.localizedContent = captureLocalizedContent();
  renderDesign();
});

$('#heroOverlay').addEventListener('input', event => {
  $('#heroOverlayValue').value = `${event.currentTarget.value}%`;
});

document.querySelectorAll('[data-upload-for]').forEach(button => {
  button.addEventListener('click', () => $(`#${button.dataset.uploadFor}`).click());
});

document.querySelectorAll('[data-remove-image]').forEach(button => {
  button.addEventListener('click', () => {
    const field = button.dataset.removeImage;
    $(`#${field}`).value = '';
    const uploadId = { logoImage: 'logoUpload', backgroundImage: 'backgroundUpload', heroImage: 'heroUpload', aboutImage: 'aboutUpload', itemImage: 'itemUpload', promotionImage: 'promotionUpload' }[field];
    if (uploadId) $(`#${uploadId}`).value = '';
    const progressId = { logoImage: 'logoUploadProgress', backgroundImage: 'backgroundUploadProgress', heroImage: 'heroUploadProgress', aboutImage: 'aboutUploadProgress', itemImage: 'itemUploadProgress', promotionImage: 'promotionUploadProgress' }[field];
    if (progressId) $(`#${progressId}`).textContent = 'Image removed from this edit. Save to apply.';
    renderImagePreviews();
  });
});

for (const [inputId, imageId, progressId] of [
  ['logoUpload', 'logoImage', 'logoUploadProgress'],
  ['backgroundUpload', 'backgroundImage', 'backgroundUploadProgress'],
  ['heroUpload', 'heroImage', 'heroUploadProgress'],
  ['aboutUpload', 'aboutImage', 'aboutUploadProgress'],
  ['itemUpload', 'itemImage', 'itemUploadProgress'],
  ['promotionUpload', 'promotionImage', 'promotionUploadProgress']
]) {
  $(`#${inputId}`).addEventListener('change', async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const progress = $(`#${progressId}`);
    progress.textContent = 'Preparing upload…';
    try {
      const uploaded = await uploadImage(file, progress);
      $(`#${imageId}`).value = uploaded.url;
      renderImagePreviews();
    } catch (error) {
      progress.textContent = error.message;
      toast(error.message);
    } finally {
      input.value = '';
    }
  });
}

for (const imageId of ['logoImage', 'backgroundImage', 'heroImage', 'aboutImage', 'itemImage', 'promotionImage']) {
  $(`#${imageId}`).addEventListener('input', renderImagePreviews);
}

$('#deliverySettingsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#saveDeliverySettingsBtn');
  const error = $('#deliverySettingsError');
  button.disabled = true;
  error.textContent = '';
  const latitude = $('#deliveryAreaLatitude').value;
  const longitude = $('#deliveryAreaLongitude').value;
  const radius = $('#deliveryAreaRadius').value;
  if ([latitude, longitude, radius].some(Boolean) && ![latitude, longitude, radius].every(Boolean)) {
    error.textContent = 'Enter all three delivery-area values, or leave all three blank to disable the area limit.';
    button.disabled = false;
    return;
  }
  try {
    deliverySettings = await api('/api/admin/delivery-settings', {
      method: 'PUT',
      body: JSON.stringify({
        deliveryFee: Number($('#deliveryFee').value),
        minimumOrder: Number($('#minimumOrder').value),
        pickupEnabled: $('#pickupEnabled').checked,
        dineInEnabled: $('#dineInEnabled').checked,
        deliveryArea: latitude ? { latitude: Number(latitude), longitude: Number(longitude), radiusKm: Number(radius) } : null
      })
    });
    renderDeliverySettings();
    toast('Delivery settings saved');
  } catch (error) {
    $('#deliverySettingsError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#tableForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#createTableBtn');
  button.disabled = true;
  $('#tableError').textContent = '';
  try {
    await api('/api/admin/tables', {
      method: 'POST',
      body: JSON.stringify({ number: $('#tableNumber').value })
    });
    event.target.reset();
    await loadData();
    toast('Table added');
  } catch (error) {
    $('#tableError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#tableList').addEventListener('click', async event => {
  const reserve = event.target.closest('[data-table-reserve]');
  const remove = event.target.closest('[data-table-delete]');
  const button = reserve || remove;
  if (!button) return;
  if (remove && !window.confirm('Remove this table?')) return;
  button.disabled = true;
  try {
    if (reserve) {
      const table = tables.find(item => item.id === reserve.dataset.tableReserve);
      await api(`/api/admin/tables/${encodeURIComponent(table.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ number: table.number, reserved: reserve.dataset.reserved === 'true' })
      });
    } else {
      await api(`/api/admin/tables/${encodeURIComponent(remove.dataset.tableDelete)}`, { method: 'DELETE' });
    }
    await loadData();
    toast(reserve ? 'Table availability updated' : 'Table removed');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
});

$('#staffForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#createStaffBtn');
  button.disabled = true;
  $('#staffError').textContent = '';
  try {
    await api('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#staffName').value,
        email: $('#staffEmail').value,
        password: $('#staffPassword').value,
        role: $('#staffRole').value
      })
    });
    event.target.reset();
    await loadData();
    toast('Staff account created');
  } catch (error) {
    $('#staffError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#staffList').addEventListener('click', async event => {
  const active = event.target.closest('[data-staff-active]');
  const remove = event.target.closest('[data-staff-delete]');
  const button = active || remove;
  if (!button) return;
  if (remove && !window.confirm('Delete this staff account?')) return;
  button.disabled = true;
  try {
    if (active) {
      await api(`/api/admin/staff/${encodeURIComponent(active.dataset.staffActive)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: active.dataset.active === 'true' })
      });
    } else {
      await api(`/api/admin/staff/${encodeURIComponent(remove.dataset.staffDelete)}`, { method: 'DELETE' });
    }
    await loadData();
    toast(active ? 'Staff permissions updated' : 'Staff account deleted');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
});

$('#ordersList').addEventListener('change', async event => {
  const driverSelect = event.target.closest('[data-driver-select]');
  if (!driverSelect || !driverSelect.value) return;
  driverSelect.disabled = true;
  try {
    await api(`/api/admin/orders/${encodeURIComponent(driverSelect.dataset.driverSelect)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ driverId: driverSelect.value })
    });
    await loadData();
    toast('Delivery assigned to driver');
  } catch (error) {
    toast(error.message);
    driverSelect.disabled = false;
  }
});

$('#ordersList').addEventListener('click', async event => {
  const statusAction = event.target.closest('[data-order-action]');
  const payment = event.target.closest('[data-payment-confirm]');
  const print = event.target.closest('[data-print]');
  if (statusAction) {
    await updateOrderStatus(statusAction.dataset.orderId, statusAction.dataset.orderAction, statusAction,
      statusAction.dataset.orderAction === 'Confirmed' ? 'Order accepted' : 'Order rejected');
  } else if (payment) {
    payment.disabled = true;
    try {
      await api(`/api/staff/orders/${encodeURIComponent(payment.dataset.paymentConfirm)}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus: 'Paid' })
      });
      await loadData();
      toast('Cash payment confirmed');
    } catch (error) {
      toast(error.message);
      payment.disabled = false;
    }
  } else if (print) {
    const order = orders.find(item => item.id === print.dataset.print);
    if (order) printOrder(order);
  }
});

function resetPromotionForm() {
  $('#promotionForm').reset();
  $('#promotionId').value = '';
  $('#savePromotionBtn').textContent = 'Add offer';
  $('#cancelPromotionEditBtn').classList.add('hidden');
  $('#promotionError').textContent = '';
  $('#promotionImage').value = '';
  $('#promotionUpload').value = '';
  $('#promotionUploadProgress').textContent = '';
  renderImagePreviews();
}

$('#promotionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#promotionId').value;
  const button = $('#savePromotionBtn');
  button.disabled = true;
  $('#promotionError').textContent = '';
  try {
    const image = $('#promotionImage').value;
    const previousImage = promotions.find(item => item.id === id)?.image || '';
    await api(id ? `/api/admin/promotions/${encodeURIComponent(id)}` : '/api/admin/promotions', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        title: $('#promotionTitle').value,
        description: $('#promotionDescription').value,
        image,
        startsAt: $('#promotionStartsAt').value,
        endsAt: $('#promotionEndsAt').value
      })
    });
    resetPromotionForm();
    await loadData();
    if (previousImage && previousImage !== image) await deleteUnusedImage(previousImage);
    toast(id ? 'Offer updated' : 'Offer added');
  } catch (error) {
    $('#promotionError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#cancelPromotionEditBtn').addEventListener('click', resetPromotionForm);
$('#promotionList').addEventListener('click', async event => {
  const edit = event.target.closest('[data-promotion-edit]');
  const remove = event.target.closest('[data-promotion-delete]');
  if (edit) {
    const promotion = promotions.find(item => item.id === edit.dataset.promotionEdit);
    if (!promotion) return;
    $('#promotionId').value = promotion.id;
    $('#promotionTitle').value = promotion.title;
    $('#promotionDescription').value = promotion.description;
    $('#promotionImage').value = promotion.image || '';
    $('#promotionStartsAt').value = dateTimeInput(promotion.startsAt);
    $('#promotionEndsAt').value = dateTimeInput(promotion.endsAt);
    $('#savePromotionBtn').textContent = 'Save offer';
    $('#cancelPromotionEditBtn').classList.remove('hidden');
    renderImagePreviews();
    $('#promotionForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (!remove || !window.confirm('Delete this offer?')) return;
  remove.disabled = true;
  try {
    await api(`/api/admin/promotions/${encodeURIComponent(remove.dataset.promotionDelete)}`, { method: 'DELETE' });
    await loadData();
    toast('Offer deleted');
  } catch (error) {
    toast(error.message);
    remove.disabled = false;
  }
});

function resetCouponForm() {
  $('#couponForm').reset();
  $('#couponId').value = '';
  $('#couponCustomerLimit').value = '1';
  $('#couponMinimum').value = '0';
  $('#couponActive').checked = true;
  [...$('#couponOrderTypes').options].forEach(option => { option.selected = true; });
  $('#saveCouponBtn').textContent = 'Create coupon';
  $('#cancelCouponEditBtn').classList.add('hidden');
  $('#couponError').textContent = '';
}

$('#couponForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#couponId').value;
  const button = $('#saveCouponBtn');
  button.disabled = true;
  $('#couponError').textContent = '';
  try {
    await api(id ? `/api/admin/coupons/${encodeURIComponent(id)}` : '/api/admin/coupons', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({
        code: $('#couponCode').value,
        discountType: $('#couponDiscountType').value,
        amount: Number($('#couponAmount').value),
        minimumSubtotal: Number($('#couponMinimum').value),
        usageLimit: $('#couponUsageLimit').value || null,
        perCustomerLimit: Number($('#couponCustomerLimit').value),
        startsAt: $('#couponStartsAt').value,
        endsAt: $('#couponEndsAt').value,
        deliveryTypes: [...$('#couponOrderTypes').selectedOptions].map(option => option.value),
        active: $('#couponActive').checked
      })
    });
    resetCouponForm();
    await loadData();
    toast(id ? 'Coupon updated' : 'Coupon created');
  } catch (error) {
    $('#couponError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#cancelCouponEditBtn').addEventListener('click', resetCouponForm);
$('#couponList').addEventListener('click', async event => {
  const edit = event.target.closest('[data-coupon-edit]');
  const remove = event.target.closest('[data-coupon-delete]');
  if (edit) {
    const coupon = coupons.find(item => item.id === edit.dataset.couponEdit);
    if (!coupon) return;
    $('#couponId').value = coupon.id;
    $('#couponCode').value = coupon.code;
    $('#couponDiscountType').value = coupon.discountType;
    $('#couponAmount').value = coupon.amount;
    $('#couponMinimum').value = coupon.minimumSubtotal;
    $('#couponUsageLimit').value = coupon.usageLimit ?? '';
    $('#couponCustomerLimit').value = coupon.perCustomerLimit;
    $('#couponStartsAt').value = dateTimeInput(coupon.startsAt);
    $('#couponEndsAt').value = dateTimeInput(coupon.endsAt);
    $('#couponActive').checked = coupon.active;
    [...$('#couponOrderTypes').options].forEach(option => { option.selected = coupon.deliveryTypes.includes(option.value); });
    $('#saveCouponBtn').textContent = 'Save coupon';
    $('#cancelCouponEditBtn').classList.remove('hidden');
    $('#couponForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (!remove || !window.confirm('Delete this coupon? Existing orders keep their recorded discount.')) return;
  remove.disabled = true;
  try {
    await api(`/api/admin/coupons/${encodeURIComponent(remove.dataset.couponDelete)}`, { method: 'DELETE' });
    await loadData();
    toast('Coupon deleted');
  } catch (error) {
    toast(error.message);
    remove.disabled = false;
  }
});

$('#reviewAdminList').addEventListener('click', async event => {
  const approve = event.target.closest('[data-review-approve]');
  const remove = event.target.closest('[data-review-delete]');
  if (!approve && !remove) return;
  const button = approve || remove;
  button.disabled = true;
  try {
    if (approve) {
      await api(`/api/admin/reviews/${encodeURIComponent(approve.dataset.reviewApprove)}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: approve.dataset.approved === 'true' })
      });
    } else {
      if (!window.confirm('Delete this customer review?')) {
        button.disabled = false;
        return;
      }
      await api(`/api/admin/reviews/${encodeURIComponent(remove.dataset.reviewDelete)}`, { method: 'DELETE' });
    }
    await loadData();
    toast(approve ? 'Review moderation saved' : 'Review deleted');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
});

$('#menuList').addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) {
    const item = menu.find(menuItem => menuItem.id === Number(editButton.dataset.edit));
    if (item) editMenuItem(item);
  }
  if (deleteButton && window.confirm('Delete this menu item? Existing orders will keep their item details.')) {
    deleteButton.disabled = true;
    try {
      await api(`/api/admin/menu/${encodeURIComponent(deleteButton.dataset.delete)}`, { method: 'DELETE' });
      await loadData();
      toast('Menu item deleted');
    } catch (error) {
      toast(error.message);
      deleteButton.disabled = false;
    }
  }
});

$('#ordersList').addEventListener('change', async event => {
  const select = event.target.closest('[data-status]');
  if (!select) return;
  await updateOrderStatus(select.dataset.status, select.value, select);
});

$('#orderSearch').addEventListener('input', renderOrders);
$('#orderTypeFilter').addEventListener('change', renderOrders);
$('#orderPaymentFilter').addEventListener('change', renderOrders);

$('#refreshBtn').addEventListener('click', async () => {
  try {
    await loadData();
    toast('Data refreshed');
  } catch (error) {
    toast(error.message);
  }
});

$('#reportFilters').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await loadData();
  } catch (error) {
    toast(error.message);
  }
});

$('#reportFilters').addEventListener('reset', () => {
  setTimeout(() => loadData().catch(error => toast(error.message)), 0);
});

$('#cancelEditBtn').addEventListener('click', resetMenuForm);
$('#logoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST' });
    resetMenuForm();
    await showLogin();
  } catch (error) {
    toast(error.message);
  }
});
async function initialize() {
  try {
    const session = await api('/api/admin/session');
    if (session.authenticated) await showAdmin();
    else await showLogin();
  } catch (error) {
    await showLogin();
    $('#setupHint').textContent = `Could not connect to the restaurant server: ${error.message}`;
  }
}

initialize();
setInterval(() => {
  if (!$('#adminPanel').classList.contains('hidden')) loadData().catch(error => toast(error.message));
}, 15000);
