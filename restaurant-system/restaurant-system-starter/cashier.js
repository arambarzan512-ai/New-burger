const $ = selector => document.querySelector(selector);
let orders = [];
let menu = [];
let tables = [];
let toastTimer;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const money = amount => `${new Intl.NumberFormat('en-US').format(amount)} IQD`;

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

function toast(message) {
  $('#cashierToast').textContent = message;
  $('#cashierToast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#cashierToast').classList.remove('show'), 2600);
}

function cashierStatuses(order) {
  if (order.status === 'Pending approval') return ['Confirmed', 'Cancelled'];
  if (order.status === 'Ready' && order.deliveryType === 'pickup') return ['Collected', 'Cancelled'];
  if (order.status === 'Ready' && order.deliveryType === 'dine-in') return ['Served', 'Cancelled'];
  if (order.status === 'Served' && order.deliveryType === 'dine-in') return ['Completed'];
  return [];
}

function renderOrders() {
  $('#cashierOrders').innerHTML = orders.length ? orders.map(order => {
    const address = order.address;
    return `<article class="admin-order-card">
      <div class="dashboard-top"><div><h2>${escapeHTML(order.id)}</h2><small>${new Date(order.createdAt).toLocaleString()}</small></div><b>${money(order.total)}</b></div>
      <p><b>${escapeHTML(order.customer.name)}</b>${order.customer.phone ? ` · <a href="tel:${encodeURIComponent(order.customer.phone)}" dir="ltr">${escapeHTML(order.customer.phone)}</a>` : ''}</p>
      <p>${order.items.map(item => `${item.quantity}× ${escapeHTML(item.name)}${item.extras?.length ? ` (+${item.extras.map(extra => escapeHTML(extra.name)).join(', ')})` : ''}${item.instructions ? ` · ${escapeHTML(item.instructions)}` : ''}`).join('<br>')}</p>
      <p><b>${order.deliveryType === 'delivery' ? 'Delivery' : order.deliveryType === 'dine-in' ? `Dine-in · Table ${escapeHTML(order.tableNumber)}` : 'Pickup / Takeaway'}</b> · ${escapeHTML(order.source || 'online')}</p>
      ${address ? `<p>${escapeHTML([address.label, address.building, address.street, address.city, address.unit].filter(Boolean).join(', '))}</p>${address.notes ? `<p class="hint">${escapeHTML(address.notes)}</p>` : ''}<a target="_blank" rel="noopener noreferrer" href="${escapeHTML(address.mapLink)}">Open delivery destination ↗</a>` : ''}
      <p>Payment: ${escapeHTML(order.payment)} · <b>${escapeHTML(order.paymentStatus)}</b></p>
      ${cashierStatuses(order).length ? `<label class="admin-order-status">Order status<select data-cashier-status="${escapeHTML(order.id)}"><option value="">Choose next status</option>${cashierStatuses(order).map(status => `<option>${status}</option>`).join('')}</select></label>` : `<p>Order status: <b>${escapeHTML(order.status)}</b></p>`}
      ${order.paymentStatus === 'Pending' ? `<button class="button button-outline" data-cashier-payment="${escapeHTML(order.id)}">Confirm cash received</button>` : ''}
      <button class="button button-outline print-order" data-cashier-print="${escapeHTML(order.id)}">Print receipt</button>
    </article>`;
  }).join('')   : '<p class="no-orders">There are no orders yet.</p>';
}

async function refreshOrders() {
  [orders, menu, tables] = await Promise.all([
  api('/api/staff/orders'),
  api('/api/menu'),
  api('/api/staff/tables')
  ]);
  renderOrders();
  renderWalkInTables();
}

function addWalkInLine() {
  const row = document.createElement('div');
  row.className = 'walkin-line';
  row.innerHTML = `<label>Product<select data-walkin-product required><option value="">Choose a product</option>${menu.map(item => `<option value="${item.id}" ${item.available === false ? 'disabled' : ''}>${escapeHTML(item.name)} · ${money(item.price)}${item.available === false ? ' · unavailable' : ''}</option>`).join('')}</select></label>
  <label>Quantity<input data-walkin-quantity type="number" min="1" max="99" value="1" required></label>
  <div data-walkin-extras></div>
  <label class="walkin-instructions">Preparation note<input data-walkin-instructions maxlength="250"></label>
  <button class="button button-outline" type="button" data-walkin-remove>Remove</button>`;
  $('#walkInLines').append(row);
}

function renderWalkInTables() {
  const available = tables.filter(table => table.status === 'Available');
  $('#walkInTable').innerHTML = available.length
  ? available.map(table => `<option value="${escapeHTML(table.id)}">Table ${escapeHTML(table.number)}</option>`).join('')
  : '<option value="">No available tables</option>';
  $('#walkInTable').disabled = !available.length;
  if (!$('#walkInLines').children.length && menu.length) addWalkInLine();
}

function toggleWalkInType() {
  const dineIn = $('#walkInType').value === 'dine-in';
  $('#walkInTableField').classList.toggle('hidden', !dineIn);
  $('#walkInTable').required = dineIn;
}

function printReceipt(order) {
  const receipt = window.open('', '_blank');
  if (!receipt) return toast('Allow pop-ups to print the receipt.');
  receipt.opener = null;
  const items = order.items.map(item => `<li>${item.quantity} × ${escapeHTML(item.name)}${item.instructions ? `<br><small>${escapeHTML(item.instructions)}</small>` : ''}</li>`).join('');
  const orderType = order.deliveryType === 'dine-in' ? `Dine-in · Table ${escapeHTML(order.tableNumber)}` : order.deliveryType === 'pickup' ? 'Pickup / Takeaway' : 'Delivery';
  const address = order.address
    ? `<p>${escapeHTML([order.address.label, order.address.building, order.address.street, order.address.city, order.address.unit, order.address.notes].filter(Boolean).join(', '))}</p>`
    : '';
  receipt.document.write(`<!doctype html><html><head><title>Receipt ${escapeHTML(order.id)}</title><style>body{font:16px Arial;max-width:600px;margin:32px auto;padding:0 20px}li{padding:10px 0;border-bottom:1px solid #ddd}</style></head><body><h1>${escapeHTML(order.id)}</h1><p>${new Date(order.createdAt).toLocaleString()}</p><p><b>${orderType}</b> · ${escapeHTML(order.source || 'online')}</p><p>${escapeHTML(order.customer.name)} ${order.customer.phone ? `· ${escapeHTML(order.customer.phone)}` : ''}</p>${address}<ul>${items}</ul><p>Subtotal ${money(order.subtotal)} · Delivery ${money(order.deliveryFee)}</p><b>Total ${money(order.total)}</b><p>${escapeHTML(order.payment)} · ${escapeHTML(order.paymentStatus)}</p><p>${escapeHTML(order.status)}</p><script>window.onload=()=>window.print()</script></body></html>`);
  receipt.document.close();
}

$('#cashierLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  $('#cashierLoginError').textContent = '';
  try {
    const result = await api('/api/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#cashierEmail').value, password: $('#cashierPassword').value })
    });
    if (result.role === 'kitchen') return window.location.assign('kitchen.html');
    if (result.role === 'driver') return window.location.assign('driver.html');
    if (!['cashier', 'owner'].includes(result.role)) throw new Error('This sign-in does not have cashier access.');
    await initialize();
  } catch (error) {
    $('#cashierLoginError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#cashierOrders').addEventListener('change', async event => {
  const select = event.target.closest('[data-cashier-status]');
  if (!select?.value) return;
  select.disabled = true;
  try {
    await api(`/api/staff/orders/${encodeURIComponent(select.dataset.cashierStatus)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: select.value })
    });
    await refreshOrders();
    toast('Order status updated');
  } catch (error) {
    toast(error.message);
    select.disabled = false;
  }
});

$('#newWalkInBtn').addEventListener('click', async () => {
  try {
    await refreshOrders();
    $('#walkInError').textContent = '';
    $('#walkInPanel').classList.remove('hidden');
    toggleWalkInType();
    $('#walkInPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    toast(error.message);
  }
});

$('#cancelWalkInBtn').addEventListener('click', () => {
  $('#walkInPanel').classList.add('hidden');
  $('#walkInForm').reset();
  $('#walkInLines').replaceChildren();
});

$('#walkInType').addEventListener('change', toggleWalkInType);
$('#addWalkInLineBtn').addEventListener('click', addWalkInLine);
$('#walkInLines').addEventListener('change', event => {
  const select = event.target.closest('[data-walkin-product]');
  if (!select) return;
  const item = menu.find(product => product.id === Number(select.value));
  const extras = select.closest('.walkin-line').querySelector('[data-walkin-extras]');
  extras.innerHTML = item?.extras?.length
    ? `<fieldset class="walkin-extras"><legend>Extras</legend>${item.extras.map(extra => `<label><input type="checkbox" data-walkin-extra value="${escapeHTML(extra.name)}"> ${escapeHTML(extra.name)} + ${money(extra.price)}</label>`).join('')}</fieldset>`
    : '';
});

$('#walkInLines').addEventListener('click', event => {
  const remove = event.target.closest('[data-walkin-remove]');
  if (!remove) return;
  if ($('#walkInLines').children.length === 1) return toast('An order needs at least one item.');
  remove.closest('.walkin-line').remove();
});

$('#walkInForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#placeWalkInBtn');
  button.disabled = true;
  $('#walkInError').textContent = '';
  try {
    const items = [...$('#walkInLines').querySelectorAll('.walkin-line')].map(row => ({
      id: Number(row.querySelector('[data-walkin-product]').value),
      quantity: Number(row.querySelector('[data-walkin-quantity]').value),
      extras: [...row.querySelectorAll('[data-walkin-extra]:checked')].map(input => input.value),
      instructions: row.querySelector('[data-walkin-instructions]').value.trim()
    }));
    const result = await api('/api/staff/walk-in-orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        deliveryType: $('#walkInType').value,
        tableId: $('#walkInType').value === 'dine-in' ? $('#walkInTable').value : '',
        customerName: $('#walkInCustomerName').value.trim(),
        customerPhone: $('#walkInCustomerPhone').value.trim(),
        paymentStatus: $('#walkInPaid').checked ? 'Paid' : 'Pending',
        items
      })
    });
    $('#walkInPanel').classList.add('hidden');
    $('#walkInForm').reset();
    $('#walkInLines').replaceChildren();
    await refreshOrders();
    toast(`Order ${result.order.id} created`);
  } catch (error) {
    $('#walkInError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#cashierOrders').addEventListener('click', async event => {
  const payment = event.target.closest('[data-cashier-payment]');
  const print = event.target.closest('[data-cashier-print]');
  if (payment) {
    payment.disabled = true;
    try {
      await api(`/api/staff/orders/${encodeURIComponent(payment.dataset.cashierPayment)}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus: 'Paid' })
      });
      await refreshOrders();
      toast('Cash payment confirmed');
    } catch (error) {
      toast(error.message);
      payment.disabled = false;
    }
  } else if (print) {
    const order = orders.find(item => item.id === print.dataset.cashierPrint);
    if (order) printReceipt(order);
  }
});

$('#cashierRefreshBtn').addEventListener('click', () => refreshOrders().catch(error => toast(error.message)));
$('#cashierLogoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/staff/logout', { method: 'POST' });
    $('#cashierPanel').classList.add('hidden');
    $('#cashierLoginPanel').classList.remove('hidden');
    $('#cashierLogoutBtn').classList.add('hidden');
  } catch (error) {
    toast(error.message);
  }
});

async function initialize() {
  try {
    const session = await api('/api/staff/session');
    if (session.role === 'kitchen') return window.location.assign('kitchen.html');
    if (session.role === 'driver') return window.location.assign('driver.html');
    if (!['cashier', 'owner'].includes(session.role)) throw new Error('This page is for cashier accounts only.');
    $('#cashierLoginPanel').classList.add('hidden');
    $('#cashierPanel').classList.remove('hidden');
    $('#cashierLogoutBtn').classList.remove('hidden');
    await refreshOrders();
  } catch {
    $('#cashierPanel').classList.add('hidden');
    $('#cashierLoginPanel').classList.remove('hidden');
    $('#cashierLogoutBtn').classList.add('hidden');
  }
}

initialize();
setInterval(() => {
  if (!$('#cashierPanel').classList.contains('hidden')) refreshOrders().catch(error => toast(error.message));
}, 15000);
