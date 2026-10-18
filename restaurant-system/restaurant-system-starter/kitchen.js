const $ = selector => document.querySelector(selector);
let toastTimer;
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

function toast(message) {
  $('#kitchenToast').textContent = message;
  $('#kitchenToast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#kitchenToast').classList.remove('show'), 2600);
}

function renderOrders(orders) {
  $('#kitchenOrders').innerHTML = orders.length ? orders.map(order => {
    const type = order.orderType === 'dine-in'
      ? `Dine-in · Table ${escapeHTML(order.tableNumber)}`
      : order.orderType === 'delivery' ? 'Delivery' : 'Pickup / Takeaway';
    const nextStatus = order.status === 'Confirmed' ? 'Preparing' : order.status === 'Preparing' ? 'Ready' : '';
    return `<article class="admin-order-card kitchen-order">
      <div class="dashboard-top"><div><h2>${escapeHTML(order.id)}</h2><small>${new Date(order.createdAt).toLocaleString()}</small></div><span class="status-pill">${escapeHTML(order.status)}</span></div>
      <p><b>${type}</b></p>
      <ul class="kitchen-items">${order.items.map(item => `<li><b>${item.quantity} × ${escapeHTML(item.name)}</b>${item.extras?.length ? `<small>Extras: ${item.extras.map(extra => escapeHTML(extra.name)).join(', ')}</small>` : ''}${item.instructions ? `<small>Preparation: ${escapeHTML(item.instructions)}</small>` : ''}</li>`).join('')}</ul>
      ${nextStatus ? `<button class="button button-dark" data-kitchen-status="${escapeHTML(nextStatus)}" data-order-id="${escapeHTML(order.id)}">Mark ${escapeHTML(nextStatus)}</button>` : ''}
    </article>`;
  }).join('') : '<p class="no-orders">No confirmed orders are waiting for preparation.</p>';
}

async function refreshOrders() {
  renderOrders(await api('/api/kitchen/orders'));
}

$('#kitchenLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  $('#kitchenLoginError').textContent = '';
  try {
    const session = await api('/api/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#kitchenEmail').value, password: $('#kitchenPassword').value })
    });
    if (session.role === 'cashier') return window.location.assign('cashier.html');
    if (session.role === 'driver') return window.location.assign('driver.html');
    if (session.role !== 'kitchen' && session.role !== 'owner') throw new Error('This staff account has no kitchen access.');
    await initialize();
  } catch (error) {
    $('#kitchenLoginError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('#kitchenOrders').addEventListener('click', async event => {
  const button = event.target.closest('[data-kitchen-status]');
  if (!button) return;
  button.disabled = true;
  try {
    await api(`/api/kitchen/orders/${encodeURIComponent(button.dataset.orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: button.dataset.kitchenStatus })
    });
    await refreshOrders();
    toast(`Order marked ${button.dataset.kitchenStatus}`);
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
});

$('#kitchenRefreshBtn').addEventListener('click', () => refreshOrders().catch(error => toast(error.message)));
$('#kitchenLogoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/staff/logout', { method: 'POST' });
    $('#kitchenPanel').classList.add('hidden');
    $('#kitchenLoginPanel').classList.remove('hidden');
    $('#kitchenLogoutBtn').classList.add('hidden');
  } catch (error) {
    toast(error.message);
  }
});

async function initialize() {
  try {
    const session = await api('/api/staff/session');
    if (session.role === 'cashier') return window.location.assign('cashier.html');
    if (session.role === 'driver') return window.location.assign('driver.html');
    if (session.role !== 'kitchen' && session.role !== 'owner') throw new Error('This page is for kitchen staff only.');
    $('#kitchenLoginPanel').classList.add('hidden');
    $('#kitchenPanel').classList.remove('hidden');
    $('#kitchenLogoutBtn').classList.remove('hidden');
    await refreshOrders();
  } catch {
    $('#kitchenPanel').classList.add('hidden');
    $('#kitchenLoginPanel').classList.remove('hidden');
    $('#kitchenLogoutBtn').classList.add('hidden');
  }
}

initialize();
setInterval(() => {
  if (!$('#kitchenPanel').classList.contains('hidden')) refreshOrders().catch(error => toast(error.message));
}, 10000);
