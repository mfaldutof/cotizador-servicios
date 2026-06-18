const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'quotes.json');
const hasDatabase = Boolean(process.env.DATABASE_URL);
const pool = hasDatabase ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
let dbReady = false;

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'profesional';
}

function professionalKeyFromBody(body = {}) {
  return normalizeKey([body.sellerName, body.sellerPhone, body.profession].filter(Boolean).join('-'));
}

function formatQuoteNumber(sequence) {
  return `COT-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`;
}

function parseQuoteSequence(quoteNumber) {
  const match = String(quoteNumber || '').match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function initDb() {
  if (!pool || dbReady) return;
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS professionals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      professional_key TEXT UNIQUE NOT NULL,
      name TEXT,
      phone TEXT,
      category TEXT,
      city TEXT,
      next_quote_number INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      professional_id UUID REFERENCES professionals(id),
      quote_number TEXT NOT NULL,
      quote_date TEXT,
      valid_until TEXT,
      currency TEXT,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      tax_rate NUMERIC NOT NULL DEFAULT 0,
      note TEXT,
      totals JSONB NOT NULL DEFAULT '{}'::jsonb,
      consent JSONB NOT NULL DEFAULT '{}'::jsonb,
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_professional_created ON quotes(professional_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quotes_client_name ON quotes(client_name);
  `);
  dbReady = true;
}

async function getOrCreateProfessional(body = {}) {
  await initDb();
  const key = professionalKeyFromBody(body);
  const values = [
    key,
    String(body.sellerName || '').slice(0, 120),
    String(body.sellerPhone || '').slice(0, 60),
    String(body.profession || '').slice(0, 80),
    String(body.city || '').slice(0, 80)
  ];
  const result = await pool.query(`
    INSERT INTO professionals (professional_key, name, phone, category, city)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (professional_key)
    DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      category = EXCLUDED.category,
      city = EXCLUDED.city,
      updated_at = NOW()
    RETURNING *;
  `, values);
  return result.rows[0];
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readQuotes() {
  ensureStore();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}

function writeQuotes(quotes) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(quotes, null, 2));
}

function buildQuoteObject(body, quoteNumberValue) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    professional: {
      name: String(body.sellerName || '').slice(0, 120),
      phone: String(body.sellerPhone || '').slice(0, 60),
      category: String(body.profession || '').slice(0, 80),
      city: String(body.city || '').slice(0, 80)
    },
    client: {
      name: String(body.clientName || '').slice(0, 120),
      phone: String(body.clientPhone || '').slice(0, 60)
    },
    quoteNumber: String(quoteNumberValue || body.quoteNumber || '').slice(0, 40),
    quoteDate: String(body.quoteDate || '').slice(0, 40),
    validUntil: String(body.validUntil || '').slice(0, 40),
    currency: String(body.currency || '$').slice(0, 8),
    items: body.items.map((item) => ({
      description: String(item.description || '').slice(0, 220),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0)
    })),
    taxRate: Number(body.taxRate || 0),
    note: String(body.note || '').slice(0, 500),
    totals: body.totals || {},
    consent: {
      accepted: Boolean(body.consentAccepted),
      text: String(body.consentText || '').slice(0, 900),
      acceptedAt: body.consentAccepted ? new Date().toISOString() : null
    }
  };
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/health', (req, res) => res.status(200).send('ok'));

app.get('/api/next-quote-number', async (req, res) => {
  try {
    const body = req.query || {};
    if (hasDatabase) {
      const professional = await getOrCreateProfessional(body);
      return res.json({ quoteNumber: formatQuoteNumber(professional.next_quote_number), next: professional.next_quote_number, persistent: true });
    }

    const quotes = readQuotes();
    const key = professionalKeyFromBody(body);
    const numbers = quotes
      .filter((q) => normalizeKey([q.professional?.name, q.professional?.phone, q.professional?.category].filter(Boolean).join('-')) === key)
      .map((q) => parseQuoteSequence(q.quoteNumber))
      .filter(Boolean);
    const next = numbers.length ? Math.max(...numbers) + 1 : 1;
    return res.json({ quoteNumber: formatQuoteNumber(next), next, persistent: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo obtener el número de cotización.' });
  }
});

app.post('/api/quotes', async (req, res) => {
  const body = req.body || {};
  if (!body.clientName || !Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos básicos del cliente o servicios.' });
  }

  try {
    if (hasDatabase) {
      const professional = await getOrCreateProfessional(body);
      const requestedSequence = parseQuoteSequence(body.quoteNumber);
      const sequence = requestedSequence || professional.next_quote_number;
      const finalQuoteNumber = body.quoteNumber || formatQuoteNumber(sequence);
      const quote = buildQuoteObject(body, finalQuoteNumber);

      const inserted = await pool.query(`
        INSERT INTO quotes (
          professional_id, quote_number, quote_date, valid_until, currency,
          client_name, client_phone, items, tax_rate, note, totals, consent, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb)
        RETURNING id;
      `, [
        professional.id,
        quote.quoteNumber,
        quote.quoteDate,
        quote.validUntil,
        quote.currency,
        quote.client.name,
        quote.client.phone,
        JSON.stringify(quote.items),
        quote.taxRate,
        quote.note,
        JSON.stringify(quote.totals),
        JSON.stringify(quote.consent),
        JSON.stringify(quote)
      ]);

      const nextNumber = Math.max(professional.next_quote_number, sequence + 1);
      await pool.query('UPDATE professionals SET next_quote_number = $1, updated_at = NOW() WHERE id = $2', [nextNumber, professional.id]);

      return res.status(201).json({ ok: true, id: inserted.rows[0].id, quoteNumber: quote.quoteNumber, nextQuoteNumber: formatQuoteNumber(nextNumber), saved: true, persistent: true });
    }

    const quotes = readQuotes();
    const quote = buildQuoteObject(body, body.quoteNumber);
    quotes.unshift(quote);
    writeQuotes(quotes);
    res.status(201).json({ ok: true, id: quote.id, quoteNumber: quote.quoteNumber, saved: true, persistent: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo guardar la cotización.' });
  }
});

app.get('/api/quotes', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    if (hasDatabase) {
      await initDb();
      const result = await pool.query(`
        SELECT
          q.id,
          q.quote_number AS "quoteNumber",
          q.created_at AS "createdAt",
          q.client_name AS "clientName",
          q.client_phone AS "clientPhone",
          q.currency,
          q.totals,
          q.items,
          q.consent,
          p.name AS "sellerName",
          p.phone AS "sellerPhone",
          p.category AS profession,
          p.city
        FROM quotes q
        LEFT JOIN professionals p ON p.id = q.professional_id
        ORDER BY q.created_at DESC
        LIMIT 500;
      `);
      return res.json(result.rows);
    }
    res.json(readQuotes());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron leer las cotizaciones.' });
  }
});

app.listen(PORT, async () => {
  if (hasDatabase) {
    try {
      await initDb();
      console.log('Base de datos PostgreSQL conectada.');
    } catch (error) {
      console.error('Error conectando PostgreSQL:', error.message);
    }
  } else {
    console.log('Sin DATABASE_URL: usando data/quotes.json como respaldo temporal.');
  }
  console.log(`Cotizador corriendo en puerto ${PORT}`);
});
