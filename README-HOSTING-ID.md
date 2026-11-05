# YSMParser Web 0.3.6

Antarmuka statis untuk build WebAssembly YSMParser 0.3.6.

## Isi folder

- `index.html` — halaman aplikasi.
- `styles.css` — tampilan responsif.
- `app.js` — integrasi UI, filesystem virtual Emscripten, dan pemanggilan CLI.
- `zip.js` — pembuat arsip ZIP mandiri tanpa dependensi CDN.
- `YSMParser.js` dan `YSMParser.wasm` — build WebAssembly asli dari arsip `YSMParser-0.3.6-wasm-web.tar.gz`.
- `LICENSE.txt` — lisensi yang disertakan dalam arsip upstream.

## Menjalankan lokal

Jangan membuka `index.html` langsung dengan `file://`. Jalankan server HTTP lokal dari folder ini, misalnya:

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Hosting dengan GitHub Pages

1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke root repository (pastikan `index.html` berada di root).
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`, lalu Save.
6. Tunggu deployment selesai dan buka URL Pages yang diberikan GitHub.

Jangan mengganti nama atau memisahkan `YSMParser.js` dan `YSMParser.wasm`; keduanya harus dapat diakses dari folder yang sama. Hosting harus menyajikan file `.wasm` dengan MIME type `application/wasm` untuk streaming compilation yang optimal. Loader Emscripten memiliki fallback ke pemuatan ArrayBuffer jika streaming gagal.

## Catatan teknis dan batasan

- File `.ysm` diproses di browser; aplikasi tidak mengunggah file model ke backend.
- UI memanggil CLI WASM dengan argumen `-i /ysm_input -o /ysm_output -v`, mengikuti dokumentasi CLI upstream.
- UI mengemas seluruh file yang ditemukan pada direktori output menjadi ZIP.
- Build upstream yang tersedia hanya menyediakan CLI WASM, bukan API parser browser khusus. Karena itu, keberhasilan integrasi harus diuji menggunakan file `.ysm` yang valid. Jika build ini tidak menerima `callMain` berulang kali, atau CLI memiliki perilaku output berbeda, integrasi perlu disesuaikan berdasarkan log dan sampel uji.
- ZIP dibuat di browser menggunakan `zip.js`, tanpa backend atau dependensi CDN tambahan.
- Untuk file besar, penggunaan memori browser dapat meningkat karena file input, output virtual, dan ZIP berada di memori.

## Sumber

Mesin parser dan build WASM berasal dari OpenYSM/YSMParser, versi 0.3.6. Antarmuka web di folder ini adalah wrapper tambahan, bukan bagian dari rilis upstream.
