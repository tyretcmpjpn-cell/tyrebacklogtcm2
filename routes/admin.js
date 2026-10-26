const express = require('express');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../database/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/summary', async (_req, res, next) => {
  try {
    const summary = await get(`SELECT
      (SELECT COUNT(*) FROM tyre_backlogs) AS total_backlogs,
      (SELECT COUNT(DISTINCT unit) FROM tyre_backlogs) AS total_units,
      (SELECT COUNT(*) FROM tyre_backlogs WHERE date(input_datetime, 'localtime') = date('now', 'localtime')) AS today_backlogs,
      (SELECT COUNT(*) FROM users WHERE role = 'field' AND is_active = 1) AS total_field_users`);
    const latest = await all(`SELECT b.id, b.serial_number, b.unit, b.input_datetime, u.full_name AS inputter_name
      FROM tyre_backlogs b JOIN users u ON u.id = b.created_by
      ORDER BY b.input_datetime DESC, b.id DESC LIMIT 5`);
    res.json({ summary, latest });
  } catch (error) {
    next(error);
  }
});

router.get('/units', async (_req, res, next) => {
  try {
    const units = await all('SELECT DISTINCT unit FROM tyre_backlogs ORDER BY unit COLLATE NOCASE');
    res.json({ items: units.map((row) => row.unit) });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const users = await all(
      `SELECT id, username, full_name, role, created_at FROM users
       WHERE role = 'field' AND is_active = 1 ORDER BY full_name COLLATE NOCASE`
    );
    res.json({ items: users });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
      return res.status(400).json({ error: 'Username harus 3-80 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.' });
    }
    if (fullName.length < 2 || fullName.length > 120) {
      return res.status(400).json({ error: 'Nama lengkap harus 2-120 karakter.' });
    }
    if (password.length < 12 || password.length > 200) {
      return res.status(400).json({ error: 'Password harus terdiri dari minimal 12 karakter.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const createdAt = new Date().toISOString();
    const result = await run(
      `INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
       VALUES (?, ?, ?, 'field', 1, ?)`,
      [username, passwordHash, fullName, createdAt]
    );
    res.status(201).json({
      user: { id: result.lastID, username, fullName, role: 'field', createdAt },
      message: 'Akun Team Lapangan berhasil dibuat.'
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Username tersebut sudah digunakan.' });
    next(error);
  }
});

module.exports = router;
