# Warung Empuk — Buku Kas Digital

Aplikasi pencatatan kas warung: uang masuk, uang keluar, tren 7 hari, ringkasan
kategori, pencarian, ekspor CSV, dan edit transaksi. Sekarang datanya
tersimpan di **database PostgreSQL**, jadi catatan tidak akan hilang meski
server di-restart, browser diganti, atau di-deploy ulang.

## Struktur proyek

```
warung-empuk/
├── server.js           Backend Express + API + koneksi database
├── package.json
├── render.yaml          Blueprint untuk deploy 1-klik di Render
├── .env.example
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js         Logic frontend (fetch ke API, bukan localStorage lagi)
```

## Menjalankan di komputer lokal

1. Pastikan sudah terinstal Node.js 18+ dan PostgreSQL (atau punya connection
   string dari layanan lain).
2. Install dependency:
   ```bash
   npm install
   ```
3. Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` dengan
   koneksi PostgreSQL kamu.
4. Jalankan:
   ```bash
   npm start
   ```
5. Buka `http://localhost:3000`. Tabel `transactions` akan dibuat otomatis
   saat server pertama kali jalan.

## Deploy ke Render

### Cara termudah — pakai Blueprint (`render.yaml`)

1. Push folder ini ke repository GitHub (lihat langkah di bawah kalau belum
   pernah push ke GitHub).
2. Login ke [dashboard.render.com](https://dashboard.render.com).
3. Klik **New +** → **Blueprint**.
4. Pilih repository yang berisi proyek ini. Render akan membaca `render.yaml`
   dan otomatis membuat:
   - Satu **PostgreSQL database** gratis (`warung-empuk-db`)
   - Satu **Web Service** Node.js (`warung-empuk`) yang otomatis terhubung ke
     database tersebut lewat environment variable `DATABASE_URL`
5. Klik **Apply**. Tunggu proses build selesai (biasanya 2–5 menit).
6. Setelah selesai, buka URL yang diberikan Render (contoh:
   `https://warung-empuk.onrender.com`) — aplikasi siap dipakai.

### Cara manual (tanpa Blueprint)

1. Di dashboard Render, klik **New +** → **PostgreSQL**. Beri nama
   `warung-empuk-db`, pilih plan Free, lalu **Create Database**. Setelah
   dibuat, salin nilai **Internal Database URL**.
2. Klik **New +** → **Web Service**, hubungkan ke repository proyek ini.
   - Build Command: `npm install`
   - Start Command: `node server.js`
3. Di tab **Environment**, tambahkan variable `DATABASE_URL` dengan nilai
   Internal Database URL dari langkah 1.
4. Klik **Create Web Service** dan tunggu deploy selesai.

### Push proyek ini ke GitHub (kalau belum ada repo)

```bash
cd warung-empuk
git init
git add .
git commit -m "Warung Empuk - buku kas dengan database"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

## Catatan tentang plan gratis Render

- Database PostgreSQL **Free** di Render aktif selama 90 hari lalu perlu
  di-upgrade ke plan berbayar agar datanya tidak dihapus — cocok untuk uji
  coba; untuk pemakaian jangka panjang di warung sehari-hari, sebaiknya
  upgrade ke plan Starter database (biaya kecil) supaya data tetap aman
  selamanya.
- Web Service **Free** akan "tidur" setelah 15 menit tanpa aktivitas dan
  butuh beberapa detik untuk bangun lagi saat diakses — ini normal dan tidak
  memengaruhi data yang sudah tersimpan di database.

## API yang tersedia

| Method | Endpoint                | Keterangan                    |
|--------|--------------------------|--------------------------------|
| GET    | `/api/health`            | Cek koneksi database           |
| GET    | `/api/transactions`      | Ambil semua transaksi          |
| POST   | `/api/transactions`      | Tambah transaksi baru          |
| PUT    | `/api/transactions/:id`  | Perbarui transaksi             |
| DELETE | `/api/transactions/:id`  | Hapus transaksi                |
