const $ = (id) => document.getElementById(id);
const itemsEl = $('items');
const itemTemplate = $('itemTemplate');
const statusEl = $('status');

const fields = ['sellerName','sellerPhone','clientName','clientPhone','quoteNumber','quoteDate','currency','taxRate','note'];

function today() { return new Date().toISOString().slice(0, 10); }
function quoteNo() { return 'COT-' + String(Date.now()).slice(-6); }
function money(value) { return `${$('currency').value}${Number(value || 0).toFixed(2)}`; }

function addItem(data = {}) {
  const node = itemTemplate.content.cloneNode(true);
  const row = node.querySelector('.item-row');
  row.querySelector('.desc').value = data.description || '';
  row.querySelector('.qty').value = data.quantity || 1;
  row.querySelector('.price').value = data.price || 0;
  row.querySelector('.remove').addEventListener('click', () => { row.remove(); updatePreview(); });
  row.querySelectorAll('input').forEach(input => input.addEventListener('input', updatePreview));
  itemsEl.appendChild(node);
  updatePreview();
}

function getItems() {
  return [...document.querySelectorAll('.item-row')].map(row => ({
    description: row.querySelector('.desc').value.trim() || 'Servicio',
    quantity: Number(row.querySelector('.qty').value || 0),
    price: Number(row.querySelector('.price').value || 0)
  })).filter(item => item.quantity > 0);
}

function calculateTotals() {
  const items = getItems();
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const taxRate = Number($('taxRate').value || 0);
  const tax = subtotal * taxRate / 100;
  return { subtotal, tax, total: subtotal + tax };
}

function updatePreview() {
  $('previewSeller').textContent = $('sellerName').value || 'Tu negocio';
  $('previewPhone').textContent = $('sellerPhone').value || 'Teléfono';
  $('previewClient').textContent = $('clientName').value || 'Nombre del cliente';
  $('previewNumber').textContent = '#' + ($('quoteNumber').value || '0001');
  $('previewDate').textContent = $('quoteDate').value || 'Fecha';
  $('previewNote').textContent = $('note').value || '';

  const tbody = $('previewItems');
  tbody.innerHTML = '';
  getItems().forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${item.description}</td><td>${item.quantity}</td><td>${money(item.price)}</td><td>${money(item.quantity * item.price)}</td>`;
    tbody.appendChild(tr);
  });

  const totals = calculateTotals();
  $('subtotal').textContent = money(totals.subtotal);
  $('tax').textContent = money(totals.tax);
  $('grandTotal').textContent = money(totals.total);
}

function payload() {
  const totals = calculateTotals();
  const consentText = 'Acepto que la información de esta cotización pueda almacenarse y utilizarse de forma interna para seguimiento, mejora del servicio y estadísticas agregadas. No debe venderse ni compartirse con terceros sin autorización.';
  return {
    sellerName: $('sellerName').value,
    sellerPhone: $('sellerPhone').value,
    clientName: $('clientName').value,
    clientPhone: $('clientPhone').value,
    quoteNumber: $('quoteNumber').value,
    quoteDate: $('quoteDate').value,
    currency: $('currency').value,
    items: getItems(),
    taxRate: Number($('taxRate').value || 0),
    note: $('note').value,
    totals,
    consentAccepted: $('consent').checked,
    consentText
  };
}

async function saveQuote() {
  statusEl.className = 'status';
  statusEl.textContent = '';
  const data = payload();
  if (!data.clientName.trim()) return showError('Agrega el nombre del cliente.');
  if (!data.items.length) return showError('Agrega al menos un servicio.');
  if (!data.consentAccepted) return showError('Marca el consentimiento para guardar la cotización.');

  const res = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) return showError(json.error || 'No se pudo guardar.');
  statusEl.className = 'status ok';
  statusEl.textContent = 'Cotización guardada correctamente.';
}

function showError(msg) {
  statusEl.className = 'status err';
  statusEl.textContent = msg;
}

function clearAll() {
  fields.forEach(id => $(id).value = '');
  $('quoteDate').value = today();
  $('quoteNumber').value = quoteNo();
  $('currency').value = '$';
  $('taxRate').value = 0;
  $('consent').checked = false;
  itemsEl.innerHTML = '';
  addItem();
  statusEl.textContent = '';
  updatePreview();
}

fields.forEach(id => $(id).addEventListener('input', updatePreview));
$('currency').addEventListener('change', updatePreview);
$('addItem').addEventListener('click', () => addItem());
$('printBtn').addEventListener('click', () => window.print());
$('clearBtn').addEventListener('click', clearAll);
$('saveBtn').addEventListener('click', saveQuote);

$('quoteDate').value = today();
$('quoteNumber').value = quoteNo();
addItem({ description: 'Servicio de ejemplo', quantity: 1, price: 25 });
updatePreview();
