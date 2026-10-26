function requireAuth(req, res, next) {
  if (!req.session.user) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    return res.redirect('/login.html');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Anda tidak memiliki izin untuk mengakses fitur ini.' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
