require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const { get, initialize, run } = require('./database/database');
const { requireAuth, requireRole } = require('./middleware/auth');
const { timingSafeEqual } = require('node:crypto');
const authRoutes = require('./routes/auth');
const backlogRoutes = require('./routes/backlogs');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataDir = path.resolve('./data');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/tyre-backlog');

async function bootstrapAdmin() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!username && !password) return;
  if (!username || !password || password.length < 12) {
    throw new Error('Konfigurasi admin awal tidak lengkap atau password kurang dari 12 karakter.');
  }
  const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await run(
    `INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
     VALUES (?, ?, ?, 'admin', 1, ?)`,
    [username, passwordHash, process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator TCM', new Date().toISOString()]
  );
  console.log(`Akun admin awal "${username}" berhasil dibuat. Hapus kredensial bootstrap dari konfigurasi setelah digunakan.`);
}

async function start() {
  if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET wajib diatur dengan nilai acak minimal 32 karakter di production.');
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  await initialize();
  await bootstrapAdmin();

  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    }
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(session({
    name: 'tyre.sid',
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: dataDir, table: 'sessions' }),
    secret: process.env.SESSION_SECRET || 'development-only-change-this-secret-before-deployment',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    }
  }));
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/auth/login') return next();
    if (!req.session.user) return next();
    const supplied = req.get('X-CSRF-Token') || '';
    const expected = req.session.csrfToken || '';
    const valid = /^[a-f0-9]{64}$/.test(supplied) && supplied.length === expected.length && expected.length > 0 &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!valid) return res.status(403).json({ error: 'Sesi keamanan tidak valid. Muat ulang halaman dan coba kembali.' });
    next();
  });

  app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login.html');
    return res.redirect(req.session.user.role === 'admin' ? '/dashboard-admin.html' : '/dashboard-field.html');
  });
  app.get('/login.html', (req, res, next) => {
    if (!req.session.user) return next();
    res.redirect(req.session.user.role === 'admin' ? '/dashboard-admin.html' : '/dashboard-field.html');
  });
  app.get('/dashboard-admin.html', requireAuth, requireRole('admin'), (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard-admin.html'));
  });
  app.get(['/dashboard-field.html', '/backlog-form.html', '/backlog-detail.html'], requireAuth, (req, res) => {
    if (req.path === '/dashboard-field.html' && req.session.user.role !== 'field') {
      return res.redirect('/dashboard-admin.html');
    }
    if (req.path !== '/dashboard-field.html' && req.session.user.role !== 'field' && req.session.user.role !== 'admin') {
      return res.status(403).send('Akses ditolak.');
    }
    res.sendFile(path.join(__dirname, 'public', path.basename(req.path)));
  });
  app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
  }));

  app.use('/api/auth', authRoutes);
  app.use('/api/backlogs', backlogRoutes.router);
  app.use('/api/admin', adminRoutes);
  app.use('/api/export', exportRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Halaman atau endpoint tidak ditemukan.' });
  });
  app.use((error, _req, res, _next) => {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Ukuran tiap foto maksimal 8 MB.' });
    if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Maksimal 5 foto dapat diunggah sekaligus.' });
    if (error.message && (
      error.message.startsWith('Foto harus') ||
      error.message.startsWith('Isi foto')
    )) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Terjadi kesalahan pada server. Silakan coba kembali.' });
  });

  app.listen(port, () => {
    console.log(`TYRE BACKLOG TCM berjalan di http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Aplikasi gagal dijalankan:', error.message);
  process.exitCode = 1;
});
