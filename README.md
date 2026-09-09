# BrannMotion — Digital Store + QRIS + Admin Dashboard

BrannMotion adalah versi rebrand dari Ryuzo Motion. Sistem ini tetap menyediakan toko digital, stok akun, checkout QRIS, dashboard admin, riwayat transaksi, dan pengiriman data akun.

## Payment

Payment **tidak lagi menggunakan Mustika Payment**.

Alurnya:
1. Customer memilih quantity.
2. Backend mengambil QRIS statis milik toko dari `QRIS_STATIS_BASE`.
3. Backend mengubah QRIS menjadi **dynamic QRIS dengan nominal** menggunakan tag 54 + CRC16.
4. QR image dibuat server-side menggunakan package `qrcode`.
5. Transaksi pending disimpan ke MongoDB dengan `ref_no`.
6. Backend mengecek `GOPAY_HISTORY_API` secara berkala.
7. Jika ditemukan transaksi sukses dengan nominal yang sama, stok akun otomatis diberikan.

> Penting: API riwayat pembayaran yang hanya mengembalikan nominal dapat berisiko mencocokkan pembayaran lama dengan nominal identik. Untuk produksi, paling aman jika API merchant juga mengembalikan transaction ID/timestamp unik sehingga verifikasi dapat dibuat one-to-one.

### Endpoint API yang bisa dipakai script lain

**Create QRIS**
`POST /api/payment/create-qris`

Body JSON:
```json
{
  "email": "buyer@example.com",
  "whatsapp": "628xxxxxxxxxx",
  "quantity": 1
}
```

Response berisi:
- `success`
- `ref_no`
- `qr_url`
- `qris_payload`
- `amount`
- `quantity`

**Check order**
`GET /api/payment/check-status/:ref_no`

**Verify order**
`GET /api/payment/verify?ref_no=BM...&amount=3000`

**Health**
`GET /api/health`

## Admin

Login menggunakan:
- Username: `branndigitalhub`
- Password: `branndigitalhub2202`

Untuk deployment, kredensial tersebut disimpan sebagai Railway Environment Variables, bukan di frontend.

Set:
```env
ADMIN_USERNAME=branndigitalhub
ADMIN_PASSWORD=branndigitalhub2202
JWT_SECRET=buat-random-secret-yang-panjang
```

## Railway Deployment

### Opsi A — GitHub (paling mudah)

1. Upload project ini ke repository GitHub.
2. Buka Railway dan buat **New Project** → **Deploy from GitHub Repo**.
3. Pilih repository BrannMotion.
4. Railway akan membaca `package.json` dan menjalankan:
   - Build: `npm install`
   - Start: `npm start`
5. Tambahkan Variables berikut di Railway:

```env
MONGODB_URI=...
PRODUCT_PRICE=3000
QRIS_STATIS_BASE=...
GOPAY_HISTORY_API=https://brann-merchant-production.up.railway.app/api/history/auto
ADMIN_USERNAME=branndigitalhub
ADMIN_PASSWORD=branndigitalhub2202
JWT_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=BrannMotion
```

**Jangan upload file `.env` ke GitHub.** Railway Variables menggantikan `.env`.

### Opsi B — Railway CLI

```bash
npm install
npm start
```

Untuk deploy dari folder project:
```bash
railway login
railway init
railway up
```

Setelah deploy, Railway memberikan domain HTTPS. Gunakan domain tersebut sebagai website toko dan base URL API.

## MongoDB

Gunakan MongoDB Atlas dan masukkan connection string ke:
```env
MONGODB_URI=...
```

## Struktur

```text
brannmotion/
├── public/
│   ├── css/style.css
│   ├── js/app.js
│   ├── desktop.html
│   └── mobile.html
├── server.js
├── package.json
├── package-lock.json
├── Dockerfile
└── .env.example
```

## Catatan

- Port mengikuti `process.env.PORT`, sehingga cocok dengan Railway.
- QRIS dibuat di backend; API key/payment secret tidak dikirim ke browser.
- Admin API memakai signed token setelah login.
- Animasi UI diperbarui tanpa mengubah alur utama toko.
