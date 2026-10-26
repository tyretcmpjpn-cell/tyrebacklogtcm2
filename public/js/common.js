(() => {
  const toastElement = document.getElementById('toast');
  let toastTimer;
  let csrfToken = '';

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (url === '/api/auth/me' && payload?.csrfToken) csrfToken = payload.csrfToken;
    if (response.status === 401 && url !== '/api/auth/login') {
      window.location.href = '/login.html';
      throw new Error('Sesi berakhir. Silakan login kembali.');
    }
    if (!response.ok) throw new Error(payload?.error || 'Permintaan tidak dapat diproses.');
    return payload;
  }

  function toast(message, type = 'success') {
    if (!toastElement) return;
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.className = `toast visible ${type === 'error' ? 'toast-error' : ''}`;
    toastTimer = window.setTimeout(() => {
      toastElement.className = 'toast';
    }, 3800);
  }

  function formatDate(value, withTime = true) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', withTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(date);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function loadUser(allowedRoles) {
    const { user } = await request('/api/auth/me');
    if (!user) {
      window.location.href = '/login.html';
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = user.role === 'admin' ? '/dashboard-admin.html' : '/dashboard-field.html';
      return null;
    }
    document.querySelectorAll('#userName').forEach((node) => { node.textContent = user.fullName; });
    document.querySelectorAll('#userAvatar').forEach((node) => { node.textContent = user.fullName.charAt(0).toUpperCase(); });
    return user;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', logout));
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .catch((error) => console.error('Pendaftaran service worker gagal:', error));
    });
  }
  window.TCM = { request, toast, formatDate, element, loadUser };
})();
