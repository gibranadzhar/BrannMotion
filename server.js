require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { execFile } = require('child_process');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Express Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Device-aware Route Handler for Landing Page
app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
  
  if (isMobile) {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'desktop.html'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Connection to MongoDB (non-blocking at startup)
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('MongoDB Atlas Connected successfully at startup');
      seedData();
    })
    .catch(err => {
      console.error('MongoDB connection error at startup:', err);
    });
} else {
  console.warn('Warning: MONGODB_URI is not defined in environment variables.');
}

// ================= DATABASE SCHEMAS & MODELS =================

const AccountSchema = new mongoose.Schema({
  gmail: { type: String, required: true, unique: true },
  password: { type: String, default: '' },
  link_akses: { type: String, required: true },
  status: { type: String, enum: ['Aktif', 'Terpakai', 'Pending'], default: 'Aktif' },
  catatan_khusus: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const Account = mongoose.model('Account', AccountSchema);

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const Setting = mongoose.model('Setting', SettingSchema);

const PurchaseSchema = new mongoose.Schema({
  email: { type: String, required: true },
  whatsapp: { type: String, default: '' },
  ref_no: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  status: { type: String, enum: ['Pending', 'Success', 'Failed', 'Expired', 'Paid_Out_Of_Stock'], default: 'Pending' },
  gmail_assigned: { type: String, default: '' },
  password_assigned: { type: String, default: '' },
  link_assigned: { type: String, default: '' },
  accounts_assigned: [{
    gmail: String,
    link_akses: String
  }],
  timestamp: { type: Date, default: Date.now }
});

const Purchase = mongoose.model('Purchase', PurchaseSchema);

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ================= EMAIL SENDER FUNCTION =================
async function sendEmailWithCredentials(transaction) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    console.error("❌ Gagal mengirim email: Konfigurasi SMTP (.env / Environment Variables) belum diatur atau tidak lengkap. Pastikan SMTP_HOST, SMTP_PORT, SMTP_USER, dan SMTP_PASS telah dikonfigurasi.");
    return;
  }

  let from = process.env.SMTP_FROM || `"BrannMotion" <${user}>`;
  if (from && !from.includes('<') && !from.includes('@')) {
    from = `"${from.replace(/"/g, '')}" <${user}>`;
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass
    }
  });

  const accountsList = transaction.accounts_assigned && transaction.accounts_assigned.length > 0
    ? transaction.accounts_assigned
    : [{ gmail: transaction.gmail_assigned, link_akses: transaction.link_assigned }];

  // Get global note and login steps from DB
  let globalNote = '';
  let loginSteps = [];
  try {
    const global_note_doc = await Setting.findOne({ key: 'global_note' });
    if (global_note_doc) globalNote = global_note_doc.value;
    const login_steps_doc = await Setting.findOne({ key: 'login_steps' });
    if (login_steps_doc) loginSteps = login_steps_doc.value;
  } catch (err) {
    console.error('Error fetching settings for email:', err);
  }

  // Format accounts list HTML
  const accountsHtml = accountsList.map((acc, index) => {
    return `
      <div style="background: linear-gradient(135deg, #090e1a, #0b1426); border: 1px solid rgba(255, 94, 0, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 16px; color: #ffffff;">
        <div style="display: table; width: 100%; border-bottom: 1px dashed rgba(255, 94, 0, 0.15); padding-bottom: 10px; margin-bottom: 15px;">
          <div style="display: table-cell; font-family: monospace; font-size: 12px; font-weight: bold; color: #ff5e00; text-transform: uppercase; letter-spacing: 1.5px; width: 50%;">
            AKUN #${index + 1}
          </div>
          <div style="display: table-cell; text-align: right; width: 50%;">
            <span style="background-color: rgba(16, 185, 129, 0.1); color: #10b981; font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: bold; display: inline-block;">SIAP PAKAI</span>
          </div>
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; font-weight: bold;">Gmail Akun</label>
          <div style="font-family: monospace; font-size: 14px; color: #ffffff; background-color: #050811; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); word-break: break-all;">
            ${acc.gmail}
          </div>
        </div>
        
        <div>
          <label style="display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; font-weight: bold;">Link Akses / Aktivasi</label>
          <a href="${acc.link_akses}" style="display: block; text-decoration: none; font-family: monospace; font-size: 13px; color: #ff5e00; background-color: rgba(255, 94, 0, 0.04); padding: 10px 14px; border-radius: 8px; border: 1px dashed rgba(255, 94, 0, 0.3); word-break: break-all;">
            ${acc.link_akses}
          </a>
        </div>
      </div>
    `;
  }).join('');

  // Format login steps HTML
  const stepsHtml = loginSteps.map((step, idx) => {
    return `
      <div style="display: table; margin-bottom: 16px; width: 100%;">
        <div style="display: table-cell; width: 28px; vertical-align: top;">
          <div style="width: 22px; height: 22px; background-color: rgba(255, 94, 0, 0.08); border: 1px solid #ff5e00; border-radius: 50%; color: #ff5e00; font-size: 11px; font-weight: bold; text-align: center; line-height: 22px; font-family: monospace;">
            ${idx + 1}
          </div>
        </div>
        <div style="display: table-cell; padding-left: 10px; vertical-align: top;">
          <strong style="color: #ffffff; font-size: 13px; display: block; margin-bottom: 3px; font-family: sans-serif;">${step.title}</strong>
          <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.4; font-family: sans-serif;">${step.description}</p>
        </div>
      </div>
    `;
  }).join('');

  const mailOptions = {
    from,
    to: transaction.email,
    subject: `BrannMotion — Detail Akun Alight Motion Premium (${transaction.ref_no})`,
    html: `
      <div style="background-color: #050811; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto; border: 1px solid #141c2f; border-radius: 24px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 35px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
            BrannMotion <span style="color: #ff5e00;">Motion</span>
          </h1>
          <p style="color: #4b5563; font-size: 10px; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 2.5px; font-weight: bold;">Premium License Delivery</p>
        </div>
        
        <!-- Welcome text -->
        <div style="margin-bottom: 25px;">
          <p style="font-size: 14px; color: #9ca3af; line-height: 1.6; margin: 0;">
            Halo,<br><br>
            Terima kasih telah berbelanja di <strong>BrannMotion</strong>. Transaksi pembayaran Anda dengan Ref ID <span style="color: #ff5e00; font-family: monospace; font-weight: bold; background-color: rgba(255, 94, 0, 0.08); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255, 94, 0, 0.15); font-size: 12px;">${transaction.ref_no}</span> telah sukses diverifikasi secara instan.
          </p>
        </div>
        
        <!-- Accounts list -->
        ${accountsHtml}
        
        <!-- Special Note -->
        <div style="background-color: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 14px; padding: 16px; margin: 24px 0;">
          <strong style="color: #ef4444; display: block; font-size: 13px; margin-bottom: 6px; font-weight: bold;">⚠️ PENTING / CATATAN KHUSUS:</strong>
          <p style="margin: 0; font-size: 12px; color: #d1d5db; line-height: 1.5; font-style: italic;">
            ${globalNote}
          </p>
        </div>
        
        <!-- Login Steps -->
        <div style="background-color: #080d1a; border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 18px; padding: 20px; margin-top: 28px;">
          <h3 style="color: #ffffff; margin: 0 0 16px 0; font-size: 15px; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 10px; letter-spacing: 0.5px;">📋 TATA CARA LOGIN AKUN</h3>
          ${stepsHtml}
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 35px; border-top: 1px solid rgba(255, 255, 255, 0.04); padding-top: 25px; color: #4b5563; font-size: 11px;">
          <p style="margin: 0 0 8px 0; color: #6b7280;">Layanan transaksi otomatis aktif 24 jam non-stop.</p>
          <a href="https://BrannMotion" style="color: #ff5e00; text-decoration: none; font-weight: 800; font-size: 12px; letter-spacing: 0.5px;">BrannMotion</a>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email successfully sent to ${transaction.email}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Gagal mengirim email ke ${transaction.email}:`, error);
  }
}

// ================= DATA SEEDER =================
async function seedData() {
  try {
    // 1. Seed Accounts if empty
    // Clean up old seeded accounts to avoid email collisions or duplicates
    await Account.deleteMany({ gmail: { $in: ["rehan.premium1@gmail.com", "fathir.alight@gmail.com", "motion.pro99@gmail.com", "glowing.edit@gmail.com", "cc.alightx@gmail.com"] } });

    const accountCount = await Account.countDocuments();
    if (accountCount === 0) {
      const initialAccounts = [
        { gmail: "brannmotion.premium001@gmail.com", password: "password1234", link_akses: "https://alight.link/activation1", status: "Aktif", catatan_khusus: "Durasi 1 Tahun" },
        { gmail: "brannmotion.premium002@gmail.com", password: "fathir2026", link_akses: "https://alight.link/activation2", status: "Terpakai", catatan_khusus: "Buyer: customer.fathir@gmail.com" },
        { gmail: "brannmotion.premium003@gmail.com", password: "proalight99", link_akses: "https://alight.link/activation3", status: "Aktif", catatan_khusus: "Durasi 1 Bulan" },
        { gmail: "brannmotion.premium004@gmail.com", password: "glowedit00", link_akses: "https://alight.link/activation4", status: "Pending", catatan_khusus: "Menunggu Transfer" },
        { gmail: "brannmotion.premium005@gmail.com", password: "ccalightx", link_akses: "https://alight.link/activation5", status: "Terpakai", catatan_khusus: "Buyer: customer.cc@gmail.com" }
      ];
      await Account.insertMany(initialAccounts);
      console.log('Seeded default Accounts data');
    }

    // 2. Seed Settings (Global Note & Steps) if empty
    const globalNoteSetting = await Setting.findOne({ key: 'global_note' });
    if (!globalNoteSetting) {
      await Setting.create({
        key: 'global_note',
        value: "Dilarang mengganti password atau mengedit informasi akun. Garansi hangus seketika jika melanggar ketentuan ini. Silakan gunakan link aktivasi di atas untuk langsung login."
      });
      console.log('Seeded default Global Note');
    }

    const loginStepsSetting = await Setting.findOne({ key: 'login_steps' });
    if (!loginStepsSetting) {
      await Setting.create({
        key: 'login_steps',
        value: [
          { id: "1", title: "Buka Aplikasi Alight Motion", description: "Pastikan Anda sudah mengunduh aplikasi Alight Motion versi terbaru dari Play Store atau App Store." },
          { id: "2", title: "Klik Link Aktivasi", description: "Buka Link Aktivasi/Akses yang kami kirim menggunakan peramban (browser) HP Anda untuk login otomatis." },
          { id: "3", title: "Selesai", description: "Masuk ke menu Profil untuk memeriksa apakah status premium Anda sudah aktif." }
        ]
      });
      console.log('Seeded default Login Steps');
    }

    // 3. Seed Purchases if empty (for the "10 Pembelian Terakhir" visual)
    // Clear legacy seeded purchases to ensure new distinct emails are seeded correctly
    await Purchase.deleteMany({ ref_no: { $in: ["QR100001", "QR100002", "QR100003", "QR100004", "QR100005"] } });
    await Purchase.deleteMany({ email: { $in: ["reha****@gmail.com", "fath****@gmail.com", "santi****@gmail.com", "dani****@gmail.com", "andi****@gmail.com"] } });
    
    const seededPurchasesCount = await Purchase.countDocuments({ ref_no: { $in: ["QR100001", "QR100002", "QR100003", "QR100004", "QR100005"] } });
    if (seededPurchasesCount === 0) {
      const initialPurchases = [
        { 
          email: "customer.rehan@gmail.com", 
          ref_no: "QR100001", 
          amount: 3000, 
          status: "Success", 
          gmail_assigned: "brannmotion.premium001@gmail.com", 
          link_assigned: "https://alight.link/activation1",
          accounts_assigned: [{ gmail: "brannmotion.premium001@gmail.com", link_akses: "https://alight.link/activation1" }],
          timestamp: new Date(Date.now() - 30 * 1000) 
        },
        { 
          email: "customer.fathir@gmail.com", 
          ref_no: "QR100002", 
          amount: 3000, 
          status: "Success", 
          gmail_assigned: "brannmotion.premium002@gmail.com", 
          link_assigned: "https://alight.link/activation2",
          accounts_assigned: [{ gmail: "brannmotion.premium002@gmail.com", link_akses: "https://alight.link/activation2" }],
          timestamp: new Date(Date.now() - 180 * 1000) 
        },
        { 
          email: "customer.motion@gmail.com", 
          ref_no: "QR100003", 
          amount: 3000, 
          status: "Success", 
          gmail_assigned: "brannmotion.premium003@gmail.com", 
          link_assigned: "https://alight.link/activation3",
          accounts_assigned: [{ gmail: "brannmotion.premium003@gmail.com", link_akses: "https://alight.link/activation3" }],
          timestamp: new Date(Date.now() - 420 * 1000) 
        },
        { 
          email: "customer.glowing@gmail.com", 
          ref_no: "QR100004", 
          amount: 3000, 
          status: "Success", 
          gmail_assigned: "brannmotion.premium004@gmail.com", 
          link_assigned: "https://alight.link/activation4",
          accounts_assigned: [{ gmail: "brannmotion.premium004@gmail.com", link_akses: "https://alight.link/activation4" }],
          timestamp: new Date(Date.now() - 720 * 1000) 
        },
        { 
          email: "customer.cc@gmail.com", 
          ref_no: "QR100005", 
          amount: 3000, 
          status: "Success", 
          gmail_assigned: "brannmotion.premium005@gmail.com", 
          link_assigned: "https://alight.link/activation5",
          accounts_assigned: [{ gmail: "brannmotion.premium005@gmail.com", link_akses: "https://alight.link/activation5" }],
          timestamp: new Date(Date.now() - 1080 * 1000) 
        }
      ];
      await Purchase.insertMany(initialPurchases);
      console.log('Seeded default Purchases log');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

// ================= API ENDPOINTS =================

// Hashing Helpers using Node.js native crypto
const crypto = require('crypto');
const QRCode = require('qrcode');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  try {
    const [salt, hash] = storedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch (err) {
    return false;
  }
}

// Custom JWT Helpers using crypto
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const stringifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = process.env.JWT_SECRET || 'brannmotion-secret-change-me';
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${stringifiedPayload}`).digest('base64url');
  return `${header}.${stringifiedPayload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const secret = process.env.JWT_SECRET || 'brannmotion-secret-change-me';
    const verifySig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    if (signature !== verifySig) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}

// User auth middleware
const requireUserAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan, silakan login kembali.' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Sesi habis atau token tidak valid. Silakan login kembali.' });
  }
  req.user = decoded;
  next();
};

// Middleware to authenticate admin requests.
// The browser receives a short-lived signed admin token after username/password login.
// The actual username/password stay server-side in environment variables.
const requireAdminAuth = (req, res, next) => {
  const token = req.headers['x-admin-key'];
  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login sebagai admin.' });
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'admin' || !decoded.exp || decoded.exp < Date.now()) {
    return res.status(401).json({ error: 'Sesi admin tidak valid atau sudah kedaluwarsa.' });
  }

  next();
};

// Middleware to ensure MongoDB connection on every API request (important for Serverless/Vercel)
app.use('/api', async (req, res, next) => {
  if (!process.env.MONGODB_URI) {
    return res.status(500).json({ error: 'Konfigurasi database MONGODB_URI tidak ditemukan di server.' });
  }
  
  if (mongoose.connection.readyState !== 1) {
    console.log('MongoDB not connected. Re-connecting on-demand...');
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected successfully on-demand');
      await seedData();
    } catch (err) {
      console.error('MongoDB connection error on-demand:', err);
      return res.status(500).json({ error: 'Gagal terhubung ke database: ' + err.message });
    }
  }
  next();
});

// Health check endpoint for deployment debugging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    vercel: !!process.env.VERCEL,
    hasMongoUri: !!process.env.MONGODB_URI,
    mongoState: mongoose.connection.readyState,
    mongoStateLabel: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
  });
});

// --- ACCOUNTS API ---

// Get stock count (public)
app.get('/api/accounts/stock', async (req, res) => {
  try {
    const activeCount = await Account.countDocuments({ status: 'Aktif' });
    res.json({ count: activeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all accounts
app.get('/api/accounts', requireAdminAuth, async (req, res) => {
  try {
    const list = await Account.find().sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add account
app.post('/api/accounts', requireAdminAuth, async (req, res) => {
  try {
    const { gmail, password, link_akses, status, catatan_khusus } = req.body;
    const newAcc = new Account({ gmail, password, link_akses, status, catatan_khusus });
    await newAcc.save();
    res.json(newAcc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update account
app.put('/api/accounts/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Account.findByIdAndUpdate(id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete account
app.delete('/api/accounts/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await Account.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import accounts (Bulk insert)
app.post('/api/accounts/import', requireAdminAuth, async (req, res) => {
  try {
    const { items } = req.body; // Array of accounts
    let added = [];
    for (const item of items) {
      // Avoid duplicate emails
      const exists = await Account.findOne({ gmail: item.gmail.toLowerCase() });
      if (!exists) {
        const addedAcc = await Account.create({
          gmail: item.gmail,
          password: item.password,
          link_akses: item.link_akses,
          status: 'Aktif',
          catatan_khusus: ''
        });
        added.push(addedAcc);
      }
    }
    res.json({ success: true, count: added.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- SETTINGS API ---

// Get all settings (global note, steps)
app.get('/api/settings', async (req, res) => {
  try {
    const global_note = await Setting.findOne({ key: 'global_note' });
    const login_steps = await Setting.findOne({ key: 'login_steps' });
    res.json({
      global_note: global_note ? global_note.value : '',
      login_steps: login_steps ? login_steps.value : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save global note
app.post('/api/settings/global-note', requireAdminAuth, async (req, res) => {
  try {
    const { note } = req.body;
    const updatedSetting = await Setting.findOneAndUpdate(
      { key: 'global_note' },
      { value: note },
      { upsert: true, new: true }
    );
    res.json({ success: true, value: updatedSetting.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save login steps
app.post('/api/settings/login-steps', requireAdminAuth, async (req, res) => {
  try {
    const { steps } = req.body;
    const updatedSetting = await Setting.findOneAndUpdate(
      { key: 'login_steps' },
      { value: steps },
      { upsert: true, new: true }
    );
    res.json({ success: true, value: updatedSetting.value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- RECENT PURCHASES LOG API ---
app.get('/api/purchases', async (req, res) => {
  try {
    const list = await Purchase.find({ status: 'Success' })
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Mask email for public viewing and format output
    const maskedList = list.map(item => {
      const parts = item.email.split('@');
      let maskedEmail = parts[0];
      if (parts[0].length > 4) {
        maskedEmail = parts[0].substring(0, 4) + '****';
      } else {
        maskedEmail = parts[0].substring(0, Math.max(1, parts[0].length - 1)) + '****';
      }
      maskedEmail += '@' + parts[1];

      // Format simple relative timestamp
      const diffMs = Date.now() - new Date(item.timestamp).getTime();
      const diffMins = Math.floor(diffMs / 1000 / 60);
      let timeText = 'baru saja';
      if (diffMins > 0 && diffMins < 60) {
        timeText = `${diffMins} menit lalu`;
      } else if (diffMins >= 60) {
        const hrs = Math.floor(diffMins / 60);
        timeText = `${hrs} jam lalu`;
      }

      return { email: maskedEmail, time: timeText };
    });

    res.json(maskedList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TOP PURCHASES (LEADERBOARD) API ---
app.get('/api/purchases/top', async (req, res) => {
  try {
    const topBuyers = await Purchase.aggregate([
      { $match: { status: 'Success' } },
      { $group: {
          _id: { $toLower: "$email" },
          total_qty: { $sum: { $ifNull: [ "$quantity", 1 ] } },
          total_spent: { $sum: "$amount" }
        }
      },
      { $sort: { total_qty: -1, total_spent: -1 } },
      { $limit: 5 }
    ]);

    const formattedList = topBuyers.map(item => {
      if (!item._id || !item._id.includes('@')) {
        return { email: 'unknown****@gmail.com', count: item.total_qty };
      }
      const parts = item._id.split('@');
      let maskedEmail = parts[0];
      if (parts[0].length > 4) {
        maskedEmail = parts[0].substring(0, 4) + '****';
      } else {
        maskedEmail = parts[0].substring(0, Math.max(1, parts[0].length - 1)) + '****';
      }
      maskedEmail += '@' + (parts[1] || 'gmail.com');

      return {
        email: maskedEmail,
        count: item.total_qty
      };
    });

    res.json(formattedList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PURCHASE HISTORY API ---
app.get('/api/purchases/history', async (req, res) => {
  try {
    const { search } = req.query;
    if (!search) {
      return res.status(400).json({ error: 'Email atau Ref ID pencarian wajib diisi.' });
    }

    const queryStr = search.trim();
    
    // Search by email (case-insensitive) or Ref ID
    const query = {
      status: 'Success',
      $or: [
        { ref_no: queryStr },
        { email: { $regex: new RegExp('^' + queryStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') } }
      ]
    };

    const history = await Purchase.find(query).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// --- ADMIN GET ALL USERS API ---
app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ created_at: -1 });
    const userPurchaseStats = await Purchase.aggregate([
      { $match: { status: 'Success' } },
      { $group: {
          _id: { $toLower: "$email" },
          total_purchases: { $sum: 1 },
          total_qty: { $sum: { $ifNull: ["$quantity", 1] } }
        }
      }
    ]);

    const statsMap = {};
    userPurchaseStats.forEach(stat => {
      statsMap[stat._id] = stat;
    });

    const formattedUsers = users.map(u => {
      const uStats = statsMap[u.email.toLowerCase()] || { total_purchases: 0, total_qty: 0 };
      return {
        _id: u._id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        total_purchases: uStats.total_purchases,
        total_qty: uStats.total_qty
      };
    });

    res.json(formattedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN GET ALL PURCHASES API ---
app.get('/api/admin/purchases', requireAdminAuth, async (req, res) => {
  try {
    const list = await Purchase.find().sort({ timestamp: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN AUTH API ---
app.post('/api/admin/auth', (req, res) => {
  const { username, password } = req.body || {};
  const adminUsername = process.env.ADMIN_USERNAME || 'branndigitalhub';
  const adminPassword = process.env.ADMIN_PASSWORD || 'branndigitalhub2202';

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ success: false, error: 'Username atau password admin salah!' });
  }

  const token = generateToken({
    role: 'admin',
    username: adminUsername,
    exp: Date.now() + (12 * 60 * 60 * 1000)
  });

  res.json({ success: true, token, expiresIn: 12 * 60 * 60 });
});

// --- BRANNMOTION QRIS PAYMENT GATEWAY ---
// Static QRIS is owned/configured by the store. The amount is injected into
// the QRIS payload using the standard EMVCo tag 54 + CRC16.
// Payment verification reads the owner's GoPay transaction-history API.
function convertCRC16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000)
        ? ((crc << 1) ^ 0x1021) & 0xFFFF
        : (crc << 1) & 0xFFFF;
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function generateQrisNominal(qrisStatis, nominal) {
  let qrisInput = qrisStatis || process.env.QRIS_STATIS_BASE || '';
  const amount = Number(nominal);

  if (!qrisInput || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('QRIS statis atau nominal tidak valid.');
  }

  let baseQris = String(qrisInput).trim();
  // Remove the final CRC (63 04 XXXX) if present.
  if (baseQris.length > 8 && /6304[0-9A-Fa-f]{4}$/.test(baseQris)) {
    baseQris = baseQris.slice(0, -8);
  }

  // 010211 = static QRIS; 010212 = dynamic QRIS.
  baseQris = baseQris.replace('010211', '010212');

  const amountStr = String(Math.round(amount));
  const tag54 = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;

  // Amount tag belongs before country code (58 02 ID).
  const countryIndex = baseQris.indexOf('5802ID');
  const stringToCrc = countryIndex >= 0
    ? baseQris.slice(0, countryIndex) + tag54 + baseQris.slice(countryIndex) + '6304'
    : baseQris + tag54 + '6304';

  return stringToCrc + convertCRC16(stringToCrc);
}

async function createQrisImage(qrisPayload) {
  return QRCode.toDataURL(qrisPayload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 600
  });
}

function makeRefNo() {
  return `BM${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function getGopayHistory() {
  const apiUrl = process.env.GOPAY_HISTORY_API ||
    'https://brann-merchant-production.up.railway.app/api/history/auto';

  const response = await axios.get(apiUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'BrannMotion/1.0',
      'Accept': 'application/json'
    }
  });

  return response.data;
}

function transactionAmountMatches(trx, targetAmount) {
  return Number(trx?.amount) === Number(targetAmount);
}

function transactionStatusMatches(trx) {
  const validStatuses = [
    'SUCCESS', 'SETTLEMENT', 'SUCCESSFUL', 'COMPLETED', 'BERHASIL', 'PAID'
  ];
  return validStatuses.includes(String(trx?.status || '').toUpperCase().trim());
}

async function verifyGopayPayment(targetAmount) {
  const json = await getGopayHistory();
  if (!json || json.success !== true || !Array.isArray(json.data)) return false;

  return json.data.some(trx =>
    transactionAmountMatches(trx, targetAmount) &&
    transactionStatusMatches(trx)
  );
}

// Create a pending order and return a dynamic QR image.
app.post('/api/payment/create-qris', async (req, res) => {
  try {
    const { email, whatsapp, quantity } = req.body || {};

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email penerima wajib diisi dengan format yang benar.' });
    }

    const qty = Math.max(1, Math.min(20, parseInt(quantity, 10) || 1));
    const activeCount = await Account.countDocuments({ status: 'Aktif' });

    if (activeCount < qty) {
      return res.status(400).json({
        error: `Stok tidak cukup. Hanya tersedia ${activeCount} akun.`
      });
    }

    const unitPrice = Number(process.env.PRODUCT_PRICE || 3000);
    const price = unitPrice * qty;
    const refNo = makeRefNo();
    const qrisPayload = generateQrisNominal(process.env.QRIS_STATIS_BASE, price);
    const qrUrl = await createQrisImage(qrisPayload);

    const newPurchase = new Purchase({
      email,
      whatsapp: whatsapp || '',
      ref_no: refNo,
      amount: price,
      quantity: qty,
      status: 'Pending'
    });

    await newPurchase.save();

    return res.json({
      success: true,
      ref_no: refNo,
      qr_url: qrUrl,
      payment_link: null,
      qris_payload: qrisPayload,
      amount: price,
      quantity: qty,
      expires_in: 30 * 60
    });
  } catch (err) {
    console.error('Create QRIS error:', err);
    return res.status(500).json({ error: 'Gagal membuat QRIS: ' + err.message });
  }
});

async function dispenseAccounts(transaction) {
  const qty = transaction.quantity || 1;
  const accountsToDispense = await Account.find({ status: 'Aktif' })
    .sort({ created_at: 1 })
    .limit(qty);

  if (accountsToDispense.length < qty) {
    return { success: false, outOfStock: true };
  }

  const assigned = [];
  for (const acc of accountsToDispense) {
    acc.status = 'Terpakai';
    acc.catatan_khusus = `Buyer: ${transaction.email}`;
    await acc.save();
    assigned.push({
      gmail: acc.gmail,
      link_akses: acc.link_akses
    });
  }

  transaction.status = 'Success';
  transaction.accounts_assigned = assigned;
  if (assigned[0]) {
    transaction.gmail_assigned = assigned[0].gmail;
    transaction.link_assigned = assigned[0].link_akses;
  }
  await transaction.save();

  // Email delivery remains optional; failures do not roll back the successful order.
  sendEmailWithCredentials(transaction).catch(err =>
    console.error('Email delivery failed:', err.message)
  );

  return { success: true, accounts: assigned };
}

// Check payment status against the owner's GoPay history API.
app.get('/api/payment/check-status/:ref_no', async (req, res) => {
  try {
    const { ref_no } = req.params;
    const transaction = await Purchase.findOne({ ref_no });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    if (transaction.status === 'Success') {
      const accountsList = transaction.accounts_assigned?.length
        ? transaction.accounts_assigned
        : [{ gmail: transaction.gmail_assigned, link_akses: transaction.link_assigned }];

      return res.json({ status: 'success', accounts: accountsList });
    }

    // Expire local pending orders after 30 minutes.
    if (Date.now() - new Date(transaction.timestamp || transaction.created_at || Date.now()).getTime() > 30 * 60 * 1000) {
      transaction.status = 'Expired';
      await transaction.save();
      return res.json({ status: 'expired' });
    }

    const paid = await verifyGopayPayment(transaction.amount);
    if (!paid) {
      return res.json({ status: 'pending' });
    }

    const result = await dispenseAccounts(transaction);
    if (result.outOfStock) {
      transaction.status = 'Paid_Out_Of_Stock';
      await transaction.save();
      return res.json({
        status: 'success_out_of_stock',
        message: 'Pembayaran terdeteksi, tetapi stok habis. Hubungi admin dan kirimkan Ref ID: ' + ref_no
      });
    }

    return res.json({
      status: 'success',
      accounts: result.accounts
    });
  } catch (err) {
    console.error('Check QRIS status error:', err.message);
    return res.json({ status: 'pending' });
  }
});

// Public API endpoint for external scripts to verify a transaction.
// Usage: GET /api/payment/verify?ref_no=BM...&amount=3000
app.get('/api/payment/verify', async (req, res) => {
  try {
    const { ref_no, amount } = req.query;
    if (!ref_no || !amount) {
      return res.status(400).json({ success: false, error: 'ref_no dan amount wajib diisi.' });
    }

    const transaction = await Purchase.findOne({ ref_no });
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaksi tidak ditemukan.' });
    }

    const paid = await verifyGopayPayment(transaction.amount);
    res.json({
      success: true,
      ref_no,
      amount: transaction.amount,
      paid,
      status: transaction.status
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: 'Gagal menghubungi API payment.',
      detail: err.message
    });
  }
});

// Fallback: Serve public HTML on any routing fallback based on device detection
app.get('*', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
  
  if (isMobile) {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'desktop.html'));
  }
});

// Export app for serverless deployments (like Vercel)
module.exports = app;

// Start Server locally or on non-serverless hosts
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

