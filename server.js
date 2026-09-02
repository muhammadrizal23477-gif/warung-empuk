// Warung Empuk — Buku Kas Digital
// Backend Express + PostgreSQL. Semua catatan disimpan di database
// supaya tidak hilang walau server restart atau redeploy.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum diatur. Tambahkan koneksi PostgreSQL di environment variables.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('masuk', 'keluar')),
      amount BIGINT NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Lainnya',
      tx_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions (tx_date);`);
  console.log('Database siap. Tabel transactions sudah ada.');
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    desc: row.description,
    category: row.category,
    date: row.tx_date instanceof Date ? row.tx_date.toISOString().slice(0, 10) : row.tx_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---- API routes ----

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'error', message: err.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM transactions ORDER BY tx_date DESC, created_at DESC'
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengambil data transaksi' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { type, amount, desc, category, date } = req.body;

    if (!['masuk', 'keluar'].includes(type)) {
      return res.status(400).json({ error: 'Jenis transaksi tidak valid' });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: 'Jumlah harus lebih dari 0' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Tanggal wajib diisi' });
    }

    const id = genId();
    const { rows } = await pool.query(
      `INSERT INTO transactions (id, type, amount, description, category, tx_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, type, amt, (desc || '').trim(), category || 'Lainnya', date]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan transaksi' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, desc, category, date } = req.body;

    if (!['masuk', 'keluar'].includes(type)) {
      return res.status(400).json({ error: 'Jenis transaksi tidak valid' });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: 'Jumlah harus lebih dari 0' });
    }

    const { rows } = await pool.query(
      `UPDATE transactions
       SET type = $1, amount = $2, description = $3, category = $4, tx_date = $5, updated_at = now()
       WHERE id = $6 RETURNING *`,
      [type, amt, (desc || '').trim(), category || 'Lainnya', date, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    res.json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memperbarui transaksi' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus transaksi' });
  }
});

// Fallback ke index.html untuk semua rute non-API (SPA sederhana)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Warung Empuk berjalan di port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Gagal menyiapkan database:', err);
    process.exit(1);
  });
