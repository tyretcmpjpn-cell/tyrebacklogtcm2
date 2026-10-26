# TYRE BACKLOG TCM

Aplikasi web untuk pencatatan backlog tyre Tyre Section. Aplikasi menggunakan Node.js, Express, SQLite, session login, unggah foto yang hanya dapat diakses setelah autentikasi, dan ekspor Excel.

## Persyaratan

- Node.js 18 atau lebih baru dan npm.
- Browser modern.

## Menjalankan di VS Code

1. Buka folder project ini di VS Code.
2. Salin `.env.example` menjadi `.env`.
3. Isi `SESSION_SECRET` dengan nilai acak rahasia minimal 32 karakter. Ubah `BOOTSTRAP_ADMIN_PASSWORD` menjadi password unik minimal 12 karakter.
4. Buka terminal di VS Code dan jalankan:

   ```powershell
   npm install
   npm start
   ```

5. Buka alamat `http://localhost:3000` di browser. Login memakai username dan password admin bootstrap pada `.env`.
6. Setelah login pertama berhasil, hapus `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, dan `BOOTSTRAP_ADMIN_NAME` dari `.env`. Akun admin yang sudah tersimpan tidak ikut terhapus. Admin dapat membuat akun Team Lapangan melalui bagian **Buat akun Team Lapangan** pada dashboard.

Untuk pengembangan dengan restart otomatis, jalankan `npm run dev`.

## Menggunakan di Android melalui internet

Aplikasi dapat dipasang dari Chrome sebagai Progressive Web App (PWA); tidak perlu APK atau Google Play. Sebelum bisa diakses dari internet, deploy server Node.js ini ke layanan hosting yang:

- Menyediakan URL publik dengan HTTPS.
- Menjalankan proses Node.js terus-menerus.
- Menyediakan penyimpanan persisten untuk file SQLite (`data/`) dan foto (`uploads/tyre-backlog/`); penyimpanan sementara/ephemeral akan menghilangkan data saat aplikasi restart atau deploy.

Atur variabel environment di hosting, bukan dengan mengunggah `.env`. Gunakan `NODE_ENV=production`, `SESSION_SECRET` acak minimal 32 karakter, `SESSION_COOKIE_SECURE=true`, dan `TRUST_PROXY=true` hanya jika hosting berada di balik reverse proxy tepercaya. Bootstrap admin diatur melalui environment hosting pada deployment pertama. Jangan memublikasikan `.env`, database, atau foto unggahan. Atur backup untuk database dan foto.

Setelah situs online dengan HTTPS, buka URL-nya di Chrome Android, login, lalu pilih **⋮ > Tambahkan ke layar utama** atau **Install app**. Server tetap harus online agar login, data, foto, dan ekspor dapat digunakan; PWA ini tidak menyimpan data backlog untuk penggunaan offline.

## Konfigurasi

| Variabel | Kegunaan | Default |
| --- | --- | --- |
| `PORT` | Port HTTP | `3000` |
| `NODE_ENV` | Gunakan `production` saat deployment | `development` |
| `SESSION_SECRET` | Rahasia penandatanganan session | Rahasia development; wajib disetel di production |
| `SESSION_COOKIE_SECURE` | Cookie hanya melalui HTTPS | `false` |
| `TRUST_PROXY` | Aktifkan bila aplikasi berada di balik reverse proxy tepercaya | `false` |
| `DATABASE_FILE` | Lokasi database SQLite | `./data/tyre-backlog.sqlite` |
| `UPLOAD_DIR` | Lokasi penyimpanan foto privat | `./uploads/tyre-backlog` |
| `APP_TIMEZONE` | Zona waktu kalender/waktu pada Excel dan nama file | `Asia/Jakarta` |
| `BOOTSTRAP_ADMIN_USERNAME` | Username admin pertama | Tidak ada |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password admin pertama (min. 12 karakter) | Tidak ada |
| `BOOTSTRAP_ADMIN_NAME` | Nama tampilan admin pertama | `Administrator TCM` |

Simpan `.env`, direktori `data/`, dan foto unggahan dengan izin akses server yang sesuai. Atur `SESSION_COOKIE_SECURE=true` hanya saat situs dilayani melalui HTTPS. Jika server berada di balik reverse proxy HTTPS, konfigurasi `TRUST_PROXY=true` sesuai topologi deployment.

## Penyimpanan dan keamanan

- Tabel SQLite dibuat otomatis pada startup di `data/`.
- File foto tersimpan pada `uploads/tyre-backlog/` dengan nama acak dan tidak dipublikasikan sebagai static file. Foto dilayani melalui endpoint yang memeriksa role serta kepemilikan laporan.
- Setiap foto maksimal 8 MB; format yang diterima JPG/JPEG, PNG, dan WEBP. Satu laporan mendukung maksimal 5 foto.
- Password di-hash menggunakan bcrypt. Session tersimpan di SQLite dan cookie bersifat HttpOnly serta SameSite Strict.
- Endpoint backlog lapangan membatasi akses ke laporan milik pengguna tersebut. Endpoint ringkasan, manajemen akun, filter admin, dan export dibatasi ke role Admin.
- Lakukan backup berkala terhadap database dan folder foto, serta uji pemulihannya. Untuk penggunaan banyak pengguna bersamaan/operasi site, gunakan server HTTPS dan penyimpanan backup terkelola.

## Alur penggunaan

1. Admin bootstrap login dan membuat akun Team Lapangan.
2. Team Lapangan login, mengisi Serial Number, Unit, Manpower, HM Unit, tanggal/waktu, remarks, dan minimal satu foto. Manpower serta HM Unit dapat diisi manual dan bersifat opsional; tanggal/waktu awal diisi otomatis dan dapat disesuaikan.
3. Penginput dapat melihat detail dan memperbarui laporan miliknya, termasuk menambahkan foto sampai total lima.
4. Admin memantau, mencari, memfilter berdasarkan Serial Number, Unit, nama penginput, rentang tanggal, melihat detail/foto, dan mengunduh Excel.

Filter tanggal mengikuti zona waktu browser yang mengirim filter. Nilai tanggal/waktu disimpan dalam database dalam format ISO 8601 UTC.

## Struktur utama

```text
server.js
database/database.js
middleware/auth.js
routes/{auth,backlogs,admin,export}.js
public/{login,dashboard-field,dashboard-admin,backlog-form,backlog-detail}.html
public/css/style.css
public/js/{common,login,field,admin,backlog,detail}.js
data/                         # dibuat saat aplikasi berjalan
uploads/tyre-backlog/         # dibuat saat aplikasi berjalan
```
