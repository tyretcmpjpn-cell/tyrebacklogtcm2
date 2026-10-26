self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(() => new Response(
      '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tidak terhubung</title><body><h1>Tidak ada koneksi</h1><p>TYRE BACKLOG TCM memerlukan koneksi ke server. Periksa internet lalu coba lagi.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    ))
  );
});
