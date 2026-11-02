# Reel promo Zanak Dental Care

Video vertikal 1080×1920 (26 detik) dengan animasi dan musik buatan sendiri, tanpa layanan berbayar.

- `reel.html`: semua adegan dan animasinya (`render(t)` menggambar detik ke-t)
- `music.py`: musik dan efek suara yang disintesis dengan numpy
- `render.mjs`: merender tiap frame lewat Chromium (Playwright), lalu menggabungkannya dengan ffmpeg

```
node render.mjs                     # hasil: out/reel.mp4
node render.mjs --stills 2,10,20    # cuplikan gambar untuk dicek
```

Untuk mengganti teks atau layanan, edit `reel.html` (daftar `SERVICES` dan teks di tiap `<section>`).
