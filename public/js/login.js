document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('loginForm');
  const errorNode = document.getElementById('loginError');
  const current = await window.TCM.request('/api/auth/me').catch(() => ({ user: null }));
  if (current.user) {
    window.location.href = current.user.role === 'admin' ? '/dashboard-admin.html' : '/dashboard-field.html';
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorNode.hidden = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await window.TCM.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.elements.username.value,
          password: form.elements.password.value
        })
      });
      window.location.href = result.user.role === 'admin' ? '/dashboard-admin.html' : '/dashboard-field.html';
    } catch (error) {
      errorNode.textContent = error.message;
      errorNode.hidden = false;
      form.elements.password.focus();
    } finally {
      button.disabled = false;
    }
  });
});
