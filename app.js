const form = document.getElementById('quoteForm');
const itemsEl = document.getElementById('items');
const statusEl = document.getElementById('status');
const quoteNumber = document.getElementById('quoteNumber');
const professionSelect = document.getElementById('professionSelect');
const customProfession = document.getElementById('customProfession');
const consentText = 'Acepto que la información de esta cotización pueda usarse de forma agregada y anónima para estadísticas internas del mercado de servicios. No se publicarán datos personales del cliente.';
const PROFILE_KEY = 'cotizador_profile_v1';
const SEQUENCES_KEY = 'cotizador_sequences_v1';

function getProfessionalKey(data = getFormData()) {
  const identity = [data.sellerName, data.sellerPhone, data.profession].filter(Boolean).join('-') || 'profesional';
  return normalizeText(identity) || 'profesional';
}

function getSequences() {
  try { return JSON.parse(localStorage.getItem(SEQUENCES_KEY)) || {}; } catch { return {}; }
}

function saveSequences(sequences) {
  localStorage.setItem(SEQUENCES_KEY, JSON.stringify(sequences));
}

function formatQuoteNumber(sequence) {
  return `COT-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`;
}

function setNextQuoteNumber() {
  const sequences = getSequences();
  const key = getProfessionalKey();
  quoteNumber.value = formatQuoteNumber(sequences[key] || 1);
  updatePreview();
}

function saveProfessionalProfile() {
  const data = getFormData();
  const profile = {
    sellerName: data.sellerName || '',
    sellerPhone: data.sellerPhone || '',
    profession: professionSelect.value || '',
    customProfession: customProfession.value || '',
    city: data.city || ''
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function loadProfessionalProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (!profile) return;
    form.elements.sellerName.value = profile.sellerName || '';
    form.elements.sellerPhone.value = profile.sellerPhone || '';
    form.elements.city.value = profile.city || '';
    professionSelect.value = profile.profession || '';
    customProfession.value = profile.customProfession || '';
    toggleCustomProfession(false);
  } catch {}
}

function advanceQuoteNumberForProfessional() {
  const sequences = getSequences();
  const key = getProfessionalKey();
  const current = Number((quoteNumber.value.match(/(\d+)$/) || [])[1] || sequences[key] || 1);
  sequences[key] = current + 1;
  saveSequences(sequences);
  quoteNumber.value = formatQuoteNumber(sequences[key]);
}

function money(value, currency = '$') {
  return `${currency}${Number(value || 0).toFixed(2)}`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function getQuoteFileName() {
  const data = getFormData();
  const quoteName = data.quoteNumber || 'cotizacion';
  const clientName = data.clientName || 'cliente';
  return [quoteName, clientName].map(normalizeText).filter(Boolean).join('-') || 'cotizacion';
}

function getFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  if (data.profession === 'Otro') {
    data.profession = (data.customProfession || '').trim() || 'Otro';
  }
  return data;
}

function toggleCustomProfession(shouldUpdate = true) {
  const showCustom = professionSelect.value === 'Otro';
  customProfession.classList.toggle('hidden', !showCustom);
  if (!showCustom) customProfession.value = '';
  if (shouldUpdate) {
    saveProfessionalProfile();
    setNextQuoteNumber();
  }
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
  const data = getFormData();
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
document.getElementById('printQuote').addEventListener('click', () => {
  const previousTitle = document.title;
  document.title = getQuoteFileName();
  window.print();
  setTimeout(() => { document.title = previousTitle; }, 1000);
});

window.addEventListener('afterprint', () => {
  document.title = 'Cotizador Pro';
});

professionSelect.addEventListener('change', toggleCustomProfession);
['sellerName', 'sellerPhone', 'city'].forEach((name) => {
  form.elements[name].addEventListener('input', () => {
    saveProfessionalProfile();
    setNextQuoteNumber();
  });
});
customProfession.addEventListener('input', () => {
  saveProfessionalProfile();
  setNextQuoteNumber();
});
form.addEventListener('input', updatePreview);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = getFormData();
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
    saveProfessionalProfile();
    advanceQuoteNumberForProfessional();
    statusEl.textContent = 'Cotización guardada correctamente. Ya tienes listo el siguiente número correlativo.';
  } catch (error) {
    statusEl.textContent = 'Error guardando la cotización.';
  }
});

loadProfessionalProfile();
setNextQuoteNumber();
addItem('Visita técnica / diagnóstico', 1, 25);
updatePreview();
