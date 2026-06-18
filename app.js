const form = document.getElementById('quoteForm');
const itemsEl = document.getElementById('items');
const statusEl = document.getElementById('status');
const quoteNumber = document.getElementById('quoteNumber');
const consentText = 'Acepto que la información de esta cotización pueda usarse de forma agregada y anónima para estadísticas internas del mercado de servicios. No se publicarán datos personales del cliente.';

quoteNumber.value = `COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

function money(value, currency = '$') {
  return `${currency}${Number(value || 0).toFixed(2)}`;
}

function addItem(description = '', quantity = 1, price = 0) {
  const row = document.createElement('div');
  row.className = 'item';
  row.innerHTML = `
    <label class="item-field item-service">Servicio
      <span>Describe qué trabajo vas a realizar.</span>
      <input class="item-description" placeholder="Ej. Instalación de toma corriente" value="${description}">
    </label>
    <label class="item-field">Cantidad
      <span>Unidades, horas, visitas, días o piezas.</span>
      <input class="item-quantity" type="number" min="0" step="0.01" value="${quantity}">
    </label>
    <label class="item-field">Monto unitario
      <span>Precio por cada unidad, hora o servicio.</span>
      <input class="item-price" type="number" min="0" step="0.01" value="${price}">
    </label>
    <button type="button" class="remove" title="Eliminar servicio">×</button>
  `;
  row.querySelector('.remove').addEventListener('click', () => { row.remove(); updatePreview(); });
  row.querySelectorAll('input').forEach(input => input.addEventListener('input', updatePreview));
  itemsEl.appendChild(row);
  updatePreview();
}

function getItems() {
  return [...itemsEl.querySelectorAll('.item')].map(row => ({
    description: row.querySelector('.item-description').value.trim(),
    quantity: Number(row.querySelector('.item-quantity').value || 0),
    price: Number(row.querySelector('.item-price').value || 0)
  })).filter(item => item.description && item.quantity > 0);
}

function calculate(items, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const tax = subtotal * (Number(taxRate || 0) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

function updatePreview() {
  const data = Object.fromEntries(new FormData(form).entries());
  const items = getItems();
  const currency = data.currency || '$';
  const totals = calculate(items, data.taxRate);

  document.getElementById('summaryCount').textContent = `${items.length} servicio${items.length === 1 ? '' : 's'} agregado${items.length === 1 ? '' : 's'}`;
  document.getElementById('summaryTotal').textContent = `Total: ${money(totals.total, currency)}`;
  document.getElementById('pSeller').textContent = data.sellerName || 'Tu negocio';
  document.getElementById('pSellerMeta').textContent = [data.sellerPhone, data.city].filter(Boolean).join(' · ') || 'Teléfono · Ciudad';
  document.getElementById('pQuoteNumber').textContent = data.quoteNumber || 'COT-0001';
  document.getElementById('pClient').textContent = data.clientName || 'Nombre del cliente';
  document.getElementById('pDate').textContent = `Emitida: ${new Date().toLocaleDateString('es-PA')}${data.validUntil ? ` · Válida hasta: ${data.validUntil}` : ''}`;
  document.getElementById('pSubtotal').textContent = money(totals.subtotal, currency);
  document.getElementById('pTax').textContent = money(totals.tax, currency);
  document.getElementById('pTotal').textContent = money(totals.total, currency);
  document.getElementById('pNote').textContent = data.note || 'Notas de la cotización.';

  const body = document.getElementById('pItems');
  body.innerHTML = items.length ? items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td>${item.quantity}</td>
      <td>${money(item.price, currency)}</td>
      <td>${money(item.quantity * item.price, currency)}</td>
    </tr>
  `).join('') : '<tr><td colspan="4">Agrega servicios para ver el detalle.</td></tr>';
}

document.getElementById('addItem').addEventListener('click', () => addItem());
document.getElementById('printQuote').addEventListener('click', () => window.print());
form.addEventListener('input', updatePreview);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const items = getItems();
  if (!data.clientName || items.length === 0) {
    statusEl.textContent = 'Agrega el cliente y al menos un servicio.';
    return;
  }
  const totals = calculate(items, data.taxRate);
  statusEl.textContent = 'Guardando...';
  try {
    const response = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, items, totals, consentAccepted: Boolean(data.consentAccepted), consentText })
    });
    if (!response.ok) throw new Error('No se pudo guardar');
    statusEl.textContent = 'Cotización guardada correctamente.';
  } catch (error) {
    statusEl.textContent = 'Error guardando la cotización.';
  }
});

addItem('Visita técnica / diagnóstico', 1, 25);
updatePreview();
