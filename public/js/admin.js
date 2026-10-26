document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.TCM.loadUser(['admin']);
  if (!user) return;
  const filterForm = document.getElementById('filterForm');
  const rowContainer = document.getElementById('backlogRows');
  let page = 1;
  let activeFilters = {};

  async function loadSummary() {
    const { summary } = await window.TCM.request('/api/admin/summary');
    document.getElementById('statBacklogs').textContent = summary.total_backlogs.toLocaleString('id-ID');
    document.getElementById('statUnits').textContent = summary.total_units.toLocaleString('id-ID');
    document.getElementById('statToday').textContent = summary.today_backlogs.toLocaleString('id-ID');
    document.getElementById('statUsers').textContent = summary.total_field_users.toLocaleString('id-ID');
  }

  function localDayStart(value) {
    return value ? new Date(`${value}T00:00:00`).toISOString() : '';
  }
  function localDayEnd(value) {
    return value ? new Date(`${value}T23:59:59.999`).toISOString() : '';
  }

  function queryString(filters, currentPage) {
    const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }

  async function loadBacklogs() {
    const data = await window.TCM.request(`/api/backlogs?${queryString(activeFilters, page)}`);
    rowContainer.replaceChildren();
    document.getElementById('emptyState').hidden = data.items.length > 0;
    document.getElementById('resultCount').textContent = `${data.total.toLocaleString('id-ID')} laporan`;
    data.items.forEach((item, index) => {
      const row = document.createElement('tr');
      row.append(
        window.TCM.element('td', 'muted', String((page - 1) * data.limit + index + 1)),
        window.TCM.element('td', 'nowrap', window.TCM.formatDate(item.input_datetime)),
        window.TCM.element('td', 'strong-cell', item.serial_number),
        window.TCM.element('td', '', item.unit),
        window.TCM.element('td', '', item.manpower || '—'),
        window.TCM.element('td', '', item.hm_unit || '—'),
        window.TCM.element('td', 'remarks-cell', item.remarks),
        window.TCM.element('td', '', item.inputter_name),
        window.TCM.element('td', '', `${item.photo_count} foto`)
      );
      const actionCell = document.createElement('td');
      const detailLink = window.TCM.element('a', 'button small-button outline', 'Detail');
      detailLink.href = `/backlog-detail.html?id=${item.id}`;
      actionCell.append(detailLink);
      row.append(actionCell);
      rowContainer.append(row);
    });
    const pagination = document.getElementById('pagination');
    pagination.replaceChildren();
    if (data.pages > 1) {
      const previous = window.TCM.element('button', 'button outline small-button', 'Sebelumnya');
      const status = window.TCM.element('span', '', `Halaman ${data.page} dari ${data.pages}`);
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

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    activeFilters = {
      serialNumber: filterForm.elements.serialNumber.value.trim(),
      unit: filterForm.elements.unit.value.trim(),
      inputter: filterForm.elements.inputter.value.trim(),
      from: localDayStart(filterForm.elements.from.value),
      to: localDayEnd(filterForm.elements.to.value)
    };
    page = 1;
    loadBacklogs().catch(showError);
  });
  document.getElementById('resetFilters').addEventListener('click', () => {
    filterForm.reset();
    activeFilters = {};
    page = 1;
    loadBacklogs().catch(showError);
  });
  document.getElementById('downloadExcel').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await fetch(`/api/export?${params.toString()}`, { credentials: 'same-origin' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Ekspor Excel gagal.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TYRE_BACKLOG_TCM_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      window.TCM.toast('File Excel berhasil diunduh.');
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById('userForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await window.TCM.request('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.elements.fullName.value,
          username: form.elements.username.value,
          password: form.elements.password.value
        })
      });
      form.reset();
      await loadSummary();
      window.TCM.toast('Akun Team Lapangan berhasil dibuat.');
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
    }
  });

  try {
    await Promise.all([loadSummary(), loadBacklogs()]);
  } catch (error) {
    showError(error);
  }
});
