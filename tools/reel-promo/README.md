# Reel Zanak Dental Care

Video vertikal 1080×1920 dengan animasi dan musik buatan sendiri, tanpa layanan berbayar.

- `reel.html`: reel promo layanan klinik (26 detik)
- `gusi-berdarah.html`: reel edukasi gusi berdarah (31 detik)
- Tiap halaman punya `render(t)` yang menggambar detik ke-t
- `music.py`: musik dan efek suara yang disintesis dengan numpy
- `render.mjs`: merender tiap frame lewat Chromium (Playwright), lalu menggabungkannya dengan ffmpeg

```
node render.mjs                                  # hasil: out/reel.mp4
node render.mjs gusi-berdarah.html               # hasil: out/gusi-berdarah.mp4
node render.mjs gusi-berdarah.html --stills 2,10 # cuplikan gambar untuk dicek
```

Untuk mengganti teks atau layanan, edit `reel.html` (daftar `SERVICES` dan teks di tiap `<section>`).
