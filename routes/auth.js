const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { get } = require('../database/database');

const router = express.Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba kembali beberapa menit lagi.' }
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null, csrfToken: req.session.csrfToken || null });
});

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || !password || username.length > 80 || password.length > 200) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const user = await get(
      'SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Username atau password tidak sesuai.' });
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      };
      req.session.csrfToken = randomBytes(32).toString('hex');
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ user: req.session.user });
      });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('tyre.sid');
    res.json({ message: 'Anda berhasil keluar.' });
  });
});

module.exports = router;
