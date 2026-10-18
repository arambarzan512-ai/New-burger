const $ = selector => document.querySelector(selector);
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
  $('#driverToast').textContent = message;
  $('#driverToast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#driverToast').classList.remove('show'), 2600);
}

function renderOrders(orders) {
  $('#driverOrders').innerHTML = orders.length ? orders.map(order => {
    const address = order.address;
    const nextAction = order.status === 'Assigned'
      ? `<button class="button button-dark" data-driver-status="Picked Up" data-order-id="${escapeHTML(order.id)}">Picked up</button>`
      : order.status === 'Picked Up'
        ? `<button class="button button-outline" data-driver-status="Out for delivery" data-order-id="${escapeHTML(order.id)}">Out for delivery</button><button class="button button-dark" data-driver-status="Delivered" data-order-id="${escapeHTML(order.id)}">Delivered</button>`
        : order.status === 'Out for delivery'
          ? `<button class="button button-dark" data-driver-status="Delivered" data-order-id="${escapeHTML(order.id)}">Delivered</button>`
          : '';
    return `<article class="admin-order-card">
      <div class="dashboard-top"><h2>${escapeHTML(order.id)}</h2><span class="status-pill">${escapeHTML(order.status)}</span></div>
      <p><b>${escapeHTML(order.customer.name)}</b> · <a href="tel:${encodeURIComponent(order.customer.phone)}" dir="ltr">${escapeHTML(order.customer.phone)}</a></p>
      <p>${order.items.map(item => `${item.quantity}× ${escapeHTML(item.name)}${item.instructions ? ` · ${escapeHTML(item.instructions)}` : ''}`).join('<br>')}</p>
      <p><b>${escapeHTML([address?.label, address?.building, address?.street, address?.city, address?.unit].filter(Boolean).join(', '))}</b></p>
      ${address?.mapAddress ? `<p>${escapeHTML(address.mapAddress)}</p>` : ''}${address?.notes ? `<p class="hint">${escapeHTML(address.notes)}</p>` : ''}
      ${address?.mapLink ? `<a class="button button-outline" target="_blank" rel="noopener noreferrer" href="${escapeHTML(address.mapLink)}">Navigate to destination ↗</a>` : '<p class="form-error">No map pin is saved for this delivery.</p>'}
      ${order.deliveryProblem ? `<p class="form-error">${escapeHTML(order.deliveryProblem.message)}</p>` : ''}
      <div class="admin-item-actions">${nextAction}<button class="button button-outline" data-driver-problem="${escapeHTML(order.id)}">Report delivery problem</button></div>
    </article>`;
  }).join('') : '<p class="no-orders">No deliveries are assigned to your account.</p>';
}

async function refreshOrders() {
  renderOrders(await api('/api/driver/orders'));
}

$('#driverLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  $('#driverLoginError').textContent = '';
  try {
    const result = await api('/api/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#driverEmail').value, password: $('#driverPassword').value })
    });
    if (result.role !== 'driver') throw new Error('This sign-in is not a driver account. Open the cashier page if your role is Cashier.');
    await initialize();
  } catch (error) {
    $('#driverLoginError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#driverOrders').addEventListener('click', async event => {
  const status = event.target.closest('[data-driver-status]');
  const problem = event.target.closest('[data-driver-problem]');
  if (status) {
    status.disabled = true;
    try {
      await api(`/api/driver/orders/${encodeURIComponent(status.dataset.orderId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: status.dataset.driverStatus })
      });
      await refreshOrders();
      toast('Delivery status updated');
    } catch (error) {
      toast(error.message);
      status.disabled = false;
    }
  } else if (problem) {
    const message = window.prompt('Describe the delivery problem for restaurant staff:');
    if (!message?.trim()) return;
    problem.disabled = true;
    try {
      await api(`/api/driver/orders/${encodeURIComponent(problem.dataset.driverProblem)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Delivery problem', problem: message.trim() })
      });
      await refreshOrders();
      toast('Delivery problem reported');
    } catch (error) {
      toast(error.message);
      problem.disabled = false;
    }
  }
});

$('#driverRefreshBtn').addEventListener('click', () => refreshOrders().catch(error => toast(error.message)));
$('#driverLogoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/staff/logout', { method: 'POST' });
    $('#driverPanel').classList.add('hidden');
    $('#driverLoginPanel').classList.remove('hidden');
    $('#driverLogoutBtn').classList.add('hidden');
  } catch (error) {
    toast(error.message);
  }
});

async function initialize() {
  try {
    const session = await api('/api/staff/session');
    if (session.role !== 'driver') throw new Error('This page is for driver accounts only.');
    $('#driverLoginPanel').classList.add('hidden');
    $('#driverPanel').classList.remove('hidden');
    $('#driverLogoutBtn').classList.remove('hidden');
    await refreshOrders();
  } catch {
    $('#driverPanel').classList.add('hidden');
    $('#driverLoginPanel').classList.remove('hidden');
    $('#driverLogoutBtn').classList.add('hidden');
  }
}

initialize();
setInterval(() => {
  if (!$('#driverPanel').classList.contains('hidden')) refreshOrders().catch(error => toast(error.message));
}, 15000);
