const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';

function parseDateFilter(value, endOfDay) {
  if (value === undefined || value === '') return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(text)) return false;
  if (!text.includes('T')) {
    const date = new Date(`${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text
      ? false
      : date.toISOString();
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? false : date.toISOString();
}

function validateDateRange(query) {
  const from = parseDateFilter(query.from, false);
  const to = parseDateFilter(query.to, true);
  if (from === false || to === false) return { error: 'Format tanggal filter tidak valid.' };
  if (from && to && from > to) return { error: 'Tanggal awal tidak boleh setelah tanggal akhir.' };
  return { from, to };
}

function excelDate(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
    return result;
  }, {});
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds()
  ));
}

function dateInTimeZone(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = { parseDateFilter, validateDateRange, excelDate, dateInTimeZone };
