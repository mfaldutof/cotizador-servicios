const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'quotes.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readQuotes() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeQuotes(quotes) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(quotes, null, 2));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/health', (req, res) => res.status(200).send('ok'));

app.post('/api/quotes', (req, res) => {
  const body = req.body || {};
  if (!body.clientName || !Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos básicos del cliente o servicios.' });
  }

  const quote = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    professional: {
      name: String(body.sellerName || '').slice(0, 120),
      phone: String(body.sellerPhone || '').slice(0, 60)
    },
    client: {
      name: String(body.clientName || '').slice(0, 120),
      phone: String(body.clientPhone || '').slice(0, 60)
    },
    quoteNumber: String(body.quoteNumber || '').slice(0, 40),
    quoteDate: String(body.quoteDate || '').slice(0, 40),
    currency: String(body.currency || '$').slice(0, 8),
    items: body.items.map(item => ({
      description: String(item.description || '').slice(0, 200),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0)
    })),
    taxRate: Number(body.taxRate || 0),
    note: String(body.note || '').slice(0, 400),
    totals: body.totals || {},
    consent: {
      accepted: Boolean(body.consentAccepted),
      text: String(body.consentText || '').slice(0, 800),
      acceptedAt: body.consentAccepted ? new Date().toISOString() : null
    }
  };

  const quotes = readQuotes();
  quotes.unshift(quote);
  writeQuotes(quotes);
  res.status(201).json({ ok: true, id: quote.id, saved: true });
});

app.get('/api/quotes', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.json(readQuotes());
});

app.listen(PORT, () => {
  console.log(`Cotizador corriendo en puerto ${PORT}`);
});
