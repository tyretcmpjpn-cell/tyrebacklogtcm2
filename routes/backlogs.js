const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const fileType = require('file-type');
const { all, get, run, transaction } = require('../database/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateDateRange } = require('../utils/dates');

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/tyre-backlog');
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, _file, callback) => callback(null, `${randomUUID()}.upload`)
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const validExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
    if (!validExtension || !allowedMime.has(file.mimetype)) {
      return callback(new Error('Foto harus berformat JPG, JPEG, PNG, atau WEBP.'));
    }
    callback(null, true);
  }
});

function optionalText(body, field) {
  return typeof body[field] === 'string' ? body[field].trim() : '';
}

function validateFields(body) {
  const serialNumber = typeof body.serialNumber === 'string' ? body.serialNumber.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  const manpower = optionalText(body, 'manpower');
  const hmUnit = optionalText(body, 'hmUnit');
  const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
  const inputDateTime = typeof body.inputDateTime === 'string' ? body.inputDateTime : '';
  if (!serialNumber || serialNumber.length > 100) return 'Serial Number wajib diisi (maksimal 100 karakter).';
  if (!unit || unit.length > 100) return 'Unit wajib diisi (maksimal 100 karakter).';
  if (manpower.length > 200) return 'Manpower maksimal 200 karakter.';
  if (hmUnit.length > 50) return 'HM Unit maksimal 50 karakter.';
  if (!remarks || remarks.length > 2000) return 'Remarks wajib diisi (maksimal 2.000 karakter).';
  if (!inputDateTime || Number.isNaN(Date.parse(inputDateTime))) return 'Tanggal dan waktu input tidak valid.';
  return null;
}

async function verifyPhotos(files) {
  for (const file of files) {
    const detected = await fileType.fromFile(file.path);
    const expectedExtension = path.extname(file.originalname).toLowerCase();
    const expectedMime = expectedExtension === '.png' ? 'image/png'
      : expectedExtension === '.webp' ? 'image/webp' : 'image/jpeg';
    if (!detected || detected.mime !== expectedMime || file.mimetype !== expectedMime) {
      throw new Error('Isi foto tidak sesuai dengan format berkas yang diizinkan.');
    }
    const fileName = `${randomUUID()}${expectedExtension === '.jpeg' ? '.jpg' : expectedExtension}`;
    const finalPath = path.join(uploadDir, fileName);
    await fs.rename(file.path, finalPath);
    file.fileName = fileName;
    file.finalPath = finalPath;
  }
}

async function removeFiles(files) {
  const outcomes = await Promise.allSettled(files.map((file) => fs.unlink(file.finalPath || file.path)));
  outcomes.filter((outcome) => outcome.status === 'rejected').forEach((outcome) => {
    if (outcome.reason.code !== 'ENOENT') console.error('Gagal membersihkan file foto sementara:', outcome.reason.message);
  });
}

async function attachPhotos(backlogId, files, execute = run) {
  for (const file of files) {
    await execute(
      'INSERT INTO tyre_backlog_photos (backlog_id, file_name, file_path, uploaded_at) VALUES (?, ?, ?, ?)',
      [backlogId, file.fileName, file.finalPath, new Date().toISOString()]
    );
  }
}

async function getBacklog(id, query = get, queryAll = all) {
  const backlog = await query(
    `SELECT b.*, u.full_name AS inputter_name
     FROM tyre_backlogs b JOIN users u ON u.id = b.created_by WHERE b.id = ?`,
    [id]
  );
  if (!backlog) return null;
  backlog.photos = await queryAll(
    'SELECT id, file_name, uploaded_at FROM tyre_backlog_photos WHERE backlog_id = ? ORDER BY id',
    [id]
  );
  return backlog;
}

function permitted(req, backlog) {
  return req.session.user.role === 'admin' || backlog.created_by === req.session.user.id;
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const dateRange = req.session.user.role === 'admin' ? validateDateRange(req.query) : { from: null, to: null };
    if (dateRange.error) return res.status(400).json({ error: dateRange.error });
    const params = [];
    const conditions = [];
    if (req.session.user.role !== 'admin') {
      conditions.push('b.created_by = ?');
      params.push(req.session.user.id);
    } else {
      if (req.query.serialNumber) {
        conditions.push('b.serial_number LIKE ?');
        params.push(`%${String(req.query.serialNumber).slice(0, 100)}%`);
      }
      if (req.query.unit) {
        conditions.push('b.unit LIKE ?');
        params.push(`%${String(req.query.unit).slice(0, 100)}%`);
      }
      if (req.query.inputter) {
        conditions.push('u.full_name LIKE ?');
        params.push(`%${String(req.query.inputter).slice(0, 100)}%`);
      }
      if (req.query.from) {
        conditions.push('b.input_datetime >= ?');
        params.push(dateRange.from);
      }
      if (req.query.to) {
        conditions.push('b.input_datetime <= ?');
        params.push(dateRange.to);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const count = await get(
      `SELECT COUNT(*) AS total FROM tyre_backlogs b JOIN users u ON u.id = b.created_by ${where}`,
      params
    );
    const items = await all(
      `SELECT b.id, b.serial_number, b.unit, b.manpower, b.hm_unit, b.input_datetime, b.remarks, b.created_at, b.updated_at,
              u.full_name AS inputter_name,
              (SELECT COUNT(*) FROM tyre_backlog_photos p WHERE p.backlog_id = b.id) AS photo_count
       FROM tyre_backlogs b JOIN users u ON u.id = b.created_by ${where}
       ORDER BY b.input_datetime DESC, b.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    res.json({ items, total: count.total, page, limit, pages: Math.ceil(count.total / limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const backlog = await getBacklog(Number.parseInt(req.params.id, 10));
    if (!backlog) return res.status(404).json({ error: 'Data backlog tidak ditemukan.' });
    if (!permitted(req, backlog)) return res.status(403).json({ error: 'Anda tidak memiliki izin melihat laporan ini.' });
    res.json({ item: backlog });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('field'), upload.array('photos', 5), async (req, res, next) => {
  const files = req.files || [];
  try {
    const validationError = validateFields(req.body);
    if (validationError) {
      await removeFiles(files);
      return res.status(400).json({ error: validationError });
    }
    if (files.length < 1) {
      return res.status(400).json({ error: 'Lampirkan minimal satu foto luka tyre.' });
    }
    await verifyPhotos(files);
    const item = await transaction(async (tx) => {
      const now = new Date().toISOString();
      const result = await tx.run(
        `INSERT INTO tyre_backlogs (serial_number, unit, manpower, hm_unit, input_datetime, remarks, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.body.serialNumber.trim(),
          req.body.unit.trim(),
          optionalText(req.body, 'manpower') || null,
          optionalText(req.body, 'hmUnit') || null,
          new Date(req.body.inputDateTime).toISOString(),
          req.body.remarks.trim(),
          req.session.user.id,
          now,
          now
        ]
      );
      await attachPhotos(result.lastID, files, tx.run);
      return getBacklog(result.lastID, tx.get, tx.all);
    });
    res.status(201).json({ item, message: 'Data backlog berhasil disimpan.' });
  } catch (error) {
    await removeFiles(files);
    next(error);
  }
});

router.put('/:id', requireRole('field'), upload.array('photos', 5), async (req, res, next) => {
  const files = req.files || [];
  try {
    const validationError = validateFields(req.body);
    if (validationError) {
      await removeFiles(files);
      return res.status(400).json({ error: validationError });
    }
    const id = Number.parseInt(req.params.id, 10);
    const backlog = await getBacklog(id);
    if (!backlog) {
      await removeFiles(files);
      return res.status(404).json({ error: 'Data backlog tidak ditemukan.' });
    }
    if (!permitted(req, backlog)) {
      await removeFiles(files);
      return res.status(403).json({ error: 'Anda hanya dapat mengubah laporan milik sendiri.' });
    }
    if (backlog.photos.length + files.length < 1 || backlog.photos.length + files.length > 5) {
      await removeFiles(files);
      return res.status(400).json({ error: 'Setiap laporan harus memiliki 1 sampai 5 foto.' });
    }
    await verifyPhotos(files);
    const item = await transaction(async (tx) => {
      await tx.run(
        `UPDATE tyre_backlogs SET serial_number = ?, unit = ?, manpower = ?, hm_unit = ?, input_datetime = ?, remarks = ?, updated_at = ?
         WHERE id = ?`,
        [
          req.body.serialNumber.trim(),
          req.body.unit.trim(),
          optionalText(req.body, 'manpower') || null,
          optionalText(req.body, 'hmUnit') || null,
          new Date(req.body.inputDateTime).toISOString(),
          req.body.remarks.trim(),
          new Date().toISOString(),
          id
        ]
      );
      await attachPhotos(id, files, tx.run);
      return getBacklog(id, tx.get, tx.all);
    });
    res.json({ item, message: 'Data backlog berhasil diperbarui.' });
  } catch (error) {
    await removeFiles(files);
    next(error);
  }
});

router.get('/photos/:photoId', async (req, res, next) => {
  try {
    const photo = await get(
      `SELECT p.file_path, b.created_by FROM tyre_backlog_photos p
       JOIN tyre_backlogs b ON b.id = p.backlog_id WHERE p.id = ?`,
      [Number.parseInt(req.params.photoId, 10)]
    );
    if (!photo) return res.status(404).json({ error: 'Foto tidak ditemukan.' });
    if (req.session.user.role !== 'admin' && photo.created_by !== req.session.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin melihat foto ini.' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.resolve(photo.file_path), (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { router, uploadDir };
