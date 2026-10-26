document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.TCM.loadUser();
  if (!user) return;
  const dashboardLink = document.getElementById('dashboardLink');
  const backLink = document.getElementById('backLink');
  const roleLabel = document.getElementById('roleLabel');
  if (user.role === 'admin') {
    dashboardLink.href = '/dashboard-admin.html';
    dashboardLink.lastChild.textContent = ' Dashboard Admin';
    backLink.href = '/dashboard-admin.html';
    roleLabel.textContent = 'TEAM ADMIN';
    roleLabel.classList.add('admin-pill');
  } else {
    backLink.href = '/dashboard-field.html';
    roleLabel.textContent = 'TEAM LAPANGAN';
  }

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !/^\d+$/.test(id)) {
    window.TCM.toast('ID backlog tidak valid.', 'error');
    return;
  }
  try {
    const { item } = await window.TCM.request(`/api/backlogs/${encodeURIComponent(id)}`);
    document.getElementById('detailSerial').textContent = item.serial_number;
    document.getElementById('serial').textContent = item.serial_number;
    document.getElementById('unit').textContent = item.unit;
    document.getElementById('manpower').textContent = item.manpower || '—';
    document.getElementById('hmUnit').textContent = item.hm_unit || '—';
    document.getElementById('inputTime').textContent = window.TCM.formatDate(item.input_datetime);
    document.getElementById('inputter').textContent = item.inputter_name;
    document.getElementById('remarks').textContent = item.remarks;
    document.getElementById('createdAt').textContent = window.TCM.formatDate(item.created_at);
    document.getElementById('updatedAt').textContent = window.TCM.formatDate(item.updated_at);
    if (user.role === 'field' && item.created_by === user.id) {
      const edit = document.getElementById('editLink');
      edit.href = `/backlog-form.html?id=${item.id}`;
      edit.hidden = false;
    }
    const gallery = document.getElementById('photoGallery');
    gallery.replaceChildren();
    item.photos.forEach((photo) => {
      const link = document.createElement('a');
      link.href = `/api/backlogs/photos/${photo.id}`;
      link.target = '_blank';
      link.rel = 'noopener';
      const image = document.createElement('img');
      image.src = link.href;
      image.alt = `Foto luka tyre ${item.serial_number}`;
      link.append(image);
      gallery.append(link);
    });
  } catch (error) {
    window.TCM.toast(error.message, 'error');
  }
});
