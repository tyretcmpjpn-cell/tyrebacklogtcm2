const express = require('express');
const ExcelJS = require('exceljs');
const { all } = require('../database/database');
const { requireRole } = require('../middleware/auth');
const { validateDateRange, excelDate, dateInTimeZone } = require('../utils/dates');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const dateRange = validateDateRange(req.query);
    if (dateRange.error) return res.status(400).json({ error: dateRange.error });
    const conditions = [];
    const params = [];
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
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await all(
      `SELECT b.id, b.serial_number, b.unit, b.manpower, b.hm_unit, b.input_datetime, b.remarks, b.created_at, b.updated_at,
              u.full_name AS inputter_name,
              (SELECT group_concat('/api/backlogs/photos/' || p.id, ', ')
               FROM tyre_backlog_photos p WHERE p.backlog_id = b.id) AS photo_refs
       FROM tyre_backlogs b JOIN users u ON u.id = b.created_by ${where}
       ORDER BY b.input_datetime DESC, b.id DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TYRE BACKLOG TCM';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Data Backlog', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Nomor', key: 'number', width: 9 },
      { header: 'Tanggal Input', key: 'inputDate', width: 16 },
      { header: 'Waktu Input', key: 'inputTime', width: 14 },
      { header: 'Serial Number', key: 'serialNumber', width: 22 },
      { header: 'Unit', key: 'unit', width: 18 },
      { header: 'Manpower', key: 'manpower', width: 24 },
      { header: 'HM Unit', key: 'hmUnit', width: 16 },
      { header: 'Remarks / Keterangan Luka', key: 'remarks', width: 42 },
      { header: 'Nama Penginput', key: 'inputter', width: 24 },
      { header: 'Tanggal Dibuat', key: 'createdAt', width: 22 },
      { header: 'Tanggal Diperbarui', key: 'updatedAt', width: 22 },
      { header: 'Referensi Foto', key: 'photoRefs', width: 45 }
    ];
    rows.forEach((row, index) => {
      const inputTime = excelDate(row.input_datetime);
      sheet.addRow({
        number: index + 1,
        inputDate: inputTime,
        inputTime: inputTime,
        serialNumber: row.serial_number,
        unit: row.unit,
        manpower: row.manpower || '',
        hmUnit: row.hm_unit || '',
        remarks: row.remarks,
        inputter: row.inputter_name,
        createdAt: excelDate(row.created_at),
        updatedAt: excelDate(row.updated_at),
        photoRefs: row.photo_refs || ''
      });
    });
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12304A' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    sheet.autoFilter = { from: 'A1', to: 'L1' };
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9E1E8' } },
          left: { style: 'thin', color: { argb: 'FFD9E1E8' } },
          bottom: { style: 'thin', color: { argb: 'FFD9E1E8' } },
          right: { style: 'thin', color: { argb: 'FFD9E1E8' } }
        };
        if (rowNumber > 1) cell.alignment = { vertical: 'top', wrapText: true };
      });
    });
    sheet.getColumn('inputDate').numFmt = 'dd/mm/yyyy';
    sheet.getColumn('inputTime').numFmt = 'hh:mm:ss';
    sheet.getColumn('createdAt').numFmt = 'dd/mm/yyyy hh:mm:ss';
    sheet.getColumn('updatedAt').numFmt = 'dd/mm/yyyy hh:mm:ss';

    const date = dateInTimeZone();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="TYRE_BACKLOG_TCM_${date}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
