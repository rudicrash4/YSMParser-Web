# YSMParser Web 0.3.6 — Three.js Preview Edition

Antarmuka web statis untuk YSMParser 0.3.6. Aplikasi menjalankan build WebAssembly YSMParser yang disediakan oleh proyek upstream OpenYSM/YSMParser, lalu mengemas hasil konversi menjadi ZIP. Versi ini juga menyediakan pratinjau model 3D berbasis Three.js untuk file geometri JSON dan tekstur yang berhasil diekspor.

## Fitur

- Konversi satu atau beberapa file `.ysm` melalui build WebAssembly YSMParser 0.3.6.
- Pemrosesan dilakukan lokal di browser; file model tidak diunggah ke server.
- Ekspor semua hasil parser menjadi arsip ZIP.
- Pratinjau geometri model 3D melalui Three.js: orbit, zoom, pilihan model, pilihan tekstur, dan reset kamera.
- Layout responsif untuk desktop dan perangkat seluler.
- Tidak memerlukan backend.

## Struktur berkas

- `index.html` — halaman aplikasi.
- `styles.css` — gaya antarmuka.
- `app.js` — pemanggilan parser WASM, pengelolaan file, ZIP, dan integrasi pratinjau.
- `three-preview.js` — renderer geometri Bedrock JSON menggunakan Three.js.
- `zip.js` — pembuat ZIP lokal.
- `YSMParser.js` dan `YSMParser.wasm` — build WebAssembly upstream YSMParser 0.3.6.
- `LICENSE.txt` — lisensi asli dari repository upstream.
- `THIRD-PARTY-NOTICES.md` — informasi library pihak ketiga.

## Menjalankan lokal

Jangan membuka `index.html` langsung melalui `file://`. Jalankan server HTTP dari folder ini:

```bash
python3 -m http.server 8080
```

Kemudian buka `http://localhost:8080`.

## Hosting di GitHub Pages

1. Buat repository GitHub baru.
2. Ekstrak ZIP ini dan upload **seluruh isi folder** ke root repository. Pastikan `index.html`, `YSMParser.js`, dan `YSMParser.wasm` berada di root.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`, lalu simpan.
6. Tunggu proses deployment selesai, kemudian buka URL GitHub Pages.

Jangan memisahkan atau mengganti nama `YSMParser.js` dan `YSMParser.wasm`; loader mencari file WASM di lokasi relatif yang sama.

## Pratinjau 3D

Pratinjau membaca file model JSON di `models/` yang dihasilkan parser (format geometri `minecraft:geometry`) dan file PNG di `textures/`. Pemilihan tekstur awal mencoba mengikuti referensi `files.player.texture[0].uv` di `ysm.json`, lalu menggunakan tekstur pertama jika metadata tersebut tidak tersedia.

Three.js dan OrbitControls dimuat dari jsDelivr CDN dengan versi tetap `0.180.0`. Karena itu, **koneksi internet diperlukan untuk fitur pratinjau 3D**. Jika CDN tidak dapat diakses, konversi WASM dan unduhan ZIP tetap tersedia; hanya viewer 3D yang tidak aktif.

Pratinjau ini ditujukan sebagai viewer geometri statis. Animasi, controller, material khusus, render state, dan seluruh perilaku runtime YSM tidak disimulasikan. Pemetaan UV dan orientasi sumbu mungkin berbeda pada sebagian model kompleks.

## Catatan teknis

- Wrapper menjalankan CLI WASM dengan argumen `-i /ysm_input -o /ysm_output -v`.
- File hasil konversi disimpan sementara di memori browser untuk pratinjau dan pembuatan ZIP.
- Model besar dapat menggunakan memori cukup banyak.
- Hasil pratinjau bukan pengganti pemeriksaan proyek di Blockbench atau Minecraft.

## Lisensi dan atribusi

Mesin parser dan build WebAssembly berasal dari [OpenYSM/YSMParser](https://github.com/OpenYSM/YSMParser), versi 0.3.6. File `LICENSE.txt` disalin dari lisensi asli pada source repository upstream dan dipertahankan tanpa perubahan. Antarmuka web, integrasi viewer, dan dokumentasi tambahan adalah wrapper komunitas yang terpisah dan bukan rilis resmi upstream.

Lihat `THIRD-PARTY-NOTICES.md` untuk atribusi Three.js dan OrbitControls.
