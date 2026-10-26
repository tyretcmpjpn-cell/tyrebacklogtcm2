document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.TCM.loadUser(['field']);
  if (!user) return;
  const form = document.getElementById('backlogForm');
  const fileInput = document.getElementById('photos');
  const preview = document.getElementById('photoPreview');
  const existingPhotos = document.getElementById('existingPhotos');
  const saveButton = document.getElementById('saveButton');
  const id = new URLSearchParams(window.location.search).get('id');
  let existingPhotoCount = 0;

  function localDateTimeValue(value) {
    const date = value ? new Date(value) : new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function renderNewPhotos() {
    preview.replaceChildren();
    Array.from(fileInput.files || []).forEach((file) => {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = URL.createObjectURL(file);
      image.alt = file.name;
      const caption = document.createElement('figcaption');
      caption.textContent = file.name;
      figure.append(image, caption);
      preview.append(figure);
    });
  }
  fileInput.addEventListener('change', renderNewPhotos);

  if (id) {
    document.getElementById('pageTitle').textContent = 'Perbaiki Tyre Backlog';
    const data = await window.TCM.request(`/api/backlogs/${encodeURIComponent(id)}`);
    const item = data.item;
    form.elements.serialNumber.value = item.serial_number;
    form.elements.unit.value = item.unit;
    form.elements.manpower.value = item.manpower || '';
    form.elements.hmUnit.value = item.hm_unit || '';
    form.elements.inputDateTime.value = localDateTimeValue(item.input_datetime);
    form.elements.remarks.value = item.remarks;
    existingPhotoCount = item.photos.length;
    existingPhotos.replaceChildren();
    item.photos.forEach((photo) => {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = `/api/backlogs/photos/${photo.id}`;
      image.alt = `Foto ${photo.file_name}`;
      const caption = document.createElement('figcaption');
      caption.textContent = photo.file_name;
      figure.append(image, caption);
      existingPhotos.append(figure);
    });
    fileInput.required = false;
    saveButton.textContent = 'Simpan Perubahan';
  } else {
    form.elements.inputDateTime.value = localDateTimeValue();
  }

  document.getElementById('resetForm').addEventListener('click', (event) => {
    event.preventDefault();
    form.reset();
    form.elements.inputDateTime.value = localDateTimeValue();
    fileInput.value = '';
    renderNewPhotos();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const files = Array.from(fileInput.files || []);
    if ((!id && files.length < 1) || (id && existingPhotoCount + files.length < 1)) {
      window.TCM.toast('Lampirkan minimal satu foto luka tyre.', 'error');
      return;
    }
    if (existingPhotoCount + files.length > 5 || (!id && files.length > 5)) {
      window.TCM.toast('Maksimal 5 foto untuk satu laporan.', 'error');
      return;
    }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      window.TCM.toast('Ukuran tiap foto maksimal 8 MB.', 'error');
      return;
    }
    saveButton.disabled = true;
    const body = new FormData();
    body.append('serialNumber', form.elements.serialNumber.value);
    body.append('unit', form.elements.unit.value);
    body.append('manpower', form.elements.manpower.value);
    body.append('hmUnit', form.elements.hmUnit.value);
    body.append('inputDateTime', new Date(form.elements.inputDateTime.value).toISOString());
    body.append('remarks', form.elements.remarks.value);
    files.forEach((file) => body.append('photos', file));

    try {
      const result = await window.TCM.request(id ? `/api/backlogs/${encodeURIComponent(id)}` : '/api/backlogs', {
        method: id ? 'PUT' : 'POST',
        body
      });
      window.TCM.toast(result.message);
      window.location.href = `/backlog-detail.html?id=${result.item.id}`;
    } catch (error) {
      window.TCM.toast(error.message, 'error');
    } finally {
      saveButton.disabled = false;
    }
  });
});
