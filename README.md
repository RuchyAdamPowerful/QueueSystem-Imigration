# QMS Lokal — Kantor Imigrasi

Queue Management System yang berjalan di satu komputer/mini-PC di jaringan WiFi
kantor. Pemohon mengambil nomor antrean dengan memindai kode QR di layar Kiosk
menggunakan HP mereka sendiri.

## Cara menjalankan

1. Pastikan Node.js sudah terpasang (versi 18 ke atas disarankan).
2. Buka terminal di folder ini, lalu jalankan:

   ```
   npm install
   npm start
   ```

3. Terminal akan menampilkan sesuatu seperti:

   ```
   Di komputer ini : http://localhost:3000
   Di jaringan WiFi: http://192.168.1.20:3000
   ```

   Alamat "Di jaringan WiFi" itulah yang dipakai perangkat lain.

4. Buka di masing-masing perangkat (semuanya harus terhubung ke WiFi yang sama):
   - **Layar Kiosk** (tablet/PC di ruang tunggu): `http://<IP-server>:3000/kiosk`
   - **Dashboard Loket** (PC/laptop petugas): `http://<IP-server>:3000/loket`
   - **Layar Publik / TV**: `http://<IP-server>:3000/display`
   - **Ambil nomor**: pemohon tidak perlu buka manual — cukup pindai kode QR
     yang tampil di layar Kiosk dengan kamera HP.

## Jika server salah mendeteksi alamat IP

Kalau komputer server punya beberapa kartu jaringan (WiFi + Ethernet + VPN,
dsb.) dan alamat yang muncul salah, jalankan dengan menetapkan IP secara
manual:

```
LAN_IP=192.168.1.20 npm start
```

Ganti `192.168.1.20` dengan alamat IP WiFi komputer server yang sebenarnya
(cek lewat `ipconfig` di Windows atau `ifconfig`/`ip addr` di Mac/Linux).

## Mengganti port

Default port `3000`. Untuk mengganti:

```
PORT=8080 npm start
```

## Catatan

- Data antrean disimpan di memori server (bukan database) — jika server
  dimatikan/di-restart, data akan kembali kosong. Untuk kebutuhan produksi
  jangka panjang, tambahkan penyimpanan seperti SQLite/lowdb.
- Suara panggilan memakai Web Speech API bawaan browser (Bahasa Indonesia).
  Kualitas suara tergantung browser & sistem operasi yang dipakai untuk
  membuka halaman Loket dan Layar Publik.
- Tombol "Reset data hari ini" di halaman Loket akan mengosongkan seluruh
  tiket, penghitung nomor, dan riwayat.
