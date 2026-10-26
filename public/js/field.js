document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.TCM.loadUser(['field']);
  if (!user) return;
  document.getElementById('welcomeName').textContent = user.fullName;

  let page = 1;
  async function loadBacklogs() {
    const data = await window.TCM.request(`/api/backlogs?page=${page}&limit=15`);
    document.getElementById('totalBacklogs').textContent = data.total.toLocaleString('id-ID');
    const rows = document.getElementById('backlogRows');
    rows.replaceChildren();
    document.getElementById('emptyState').hidden = data.items.length > 0;
    data.items.forEach((item) => {
      const row = document.createElement('tr');
      const dateCell = window.TCM.element('td', 'nowrap', window.TCM.formatDate(item.input_datetime));
      const serial = window.TCM.element('td', 'strong-cell', item.serial_number);
      const unit = window.TCM.element('td', '', item.unit);
      const remarks = window.TCM.element('td', 'remarks-cell', item.remarks);
      const photo = window.TCM.element('td', '', `${item.photo_count} foto`);
      const actionCell = document.createElement('td');
      const detail = window.TCM.element('a', 'button small-button outline', 'Detail');
      detail.href = `/backlog-detail.html?id=${item.id}`;
      actionCell.append(detail);
      row.append(dateCell, serial, unit, remarks, photo, actionCell);
      rows.append(row);
    });
    const pagination = document.getElementById('pagination');
    pagination.replaceChildren();
    if (data.pages > 1) {
      const status = window.TCM.element('span', '', `Halaman ${data.page} dari ${data.pages}`);
      const previous = window.TCM.element('button', 'button outline small-button', 'Sebelumnya');
      const next = window.TCM.element('button', 'button outline small-button', 'Berikutnya');
      previous.disabled = page <= 1;
      next.disabled = page >= data.pages;
      previous.addEventListener('click', () => { page -= 1; loadBacklogs().catch(showError); });
      next.addEventListener('click', () => { page += 1; loadBacklogs().catch(showError); });
      pagination.append(previous, status, next);
    }
  }

  function showError(error) {
    window.TCM.toast(error.message, 'error');
  }
  loadBacklogs().catch(showError);
});
