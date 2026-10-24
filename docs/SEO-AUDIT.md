# Audit SEO — zanakdentalcare.web.app

Tanggal: 24 Oktober 2026 · Target: warga Indonesia, khususnya **Kota Payakumbuh** dan **Kabupaten Lima Puluh Kota**.

## Ringkasan

Fondasi situs sudah baik: HTML statis yang cepat, `lang="id"`, satu halaman per
tindakan dengan URL berkata kunci (`/scaling-gigi-payakumbuh`, dst.), schema
`Dentist` + `FAQPage`, sitemap, dan robots.txt. Kekurangan utamanya: sinyal
lokal hanya menyebut Payakumbuh Utara (Lima Puluh Kota tidak disebut sama
sekali), banyak tautan internal yang kena redirect, data NAP di schema tidak
sama dengan yang tampil, gambar share tidak sesuai, dan belum ada konten
edukasi (blog) untuk menangkap pencarian informasi.

## Yang sudah diperbaiki di branch ini

| # | Temuan | Dampak | Perbaikan |
|---|---|---|---|
| 1 | Semua tautan internal memakai `.html` (mis. `galeri.html`), padahal `cleanUrls` aktif → setiap klik & crawl kena **redirect 301** | Crawl budget terbuang, sinyal tautan melemah, halaman lebih lambat | Seluruh tautan di HTML & JS diganti ke URL bersih (`/galeri`, `/scaling-gigi-payakumbuh`, `/#jadwal`) |
| 2 | Kabupaten Lima Puluh Kota tidak disebut di mana pun | Tidak relevan untuk pencarian "dokter gigi lima puluh kota", "klinik gigi harau", dll. | Judul & deskripsi beranda, deskripsi 7 halaman layanan + halaman Layanan, teks Lokasi (menyebut kecamatan), FAQ lokasi, footer, `areaServed` schema |
| 3 | Schema `Dentist`: alamat "Jl. Jenderal Sudirman" tanpa nomor, sedangkan halaman menulis "Jl. Sudirman No.7, Kaniang Bukik" | Ketidakkonsistenan NAP (Name-Address-Phone) melemahkan peringkat lokal | Alamat diseragamkan di semua schema; ditambah `@id`, `logo`, `image`, `description`, `areaServed` (Kota Payakumbuh + Kab. Lima Puluh Kota), `availableService`, dokter |
| 4 | `og:image` memakai foto WebP potret 1086×1448 tapi meta menyatakan 1200×630 | Pratinjau link di WhatsApp/Facebook terpotong atau tidak muncul | Gambar share baru `og-zanak.jpg` 1200×630 (JPG), dipakai di semua halaman |
| 5 | Canonical beranda tanpa garis miring akhir, berbeda dari sitemap | Sinyal canonical ganda | Diseragamkan `https://zanakdentalcare.web.app/` |
| 6 | Halaman 404 punya canonical ke beranda | Membingungkan Google (noindex + canonical) | Canonical dihapus; path aset dibuat absolut agar 404 tetap tampil benar di `/blog/...` |
| 7 | Gambar fasilitas tanpa `width`/`height` | Layout bergeser (CLS — Core Web Vitals) | Dimensi ditambahkan, alt text diperjelas |
| 8 | Belum ada konten informasional | Hanya bisa muncul untuk pencarian "klinik gigi payakumbuh", bukan "gusi berdarah", "sakit gigi malam", dsb. | **Blog** `/blog` + 7 artikel, schema `BlogPosting` + `BreadcrumbList`, RSS, tautan silang ke halaman layanan & beranda |
| 9 | Sitemap ditulis manual, tanpa blog | Artikel baru lambat terindeks | Sitemap dibuat otomatis oleh `tools/build-blog.mjs` |
| 10 | Tidak ada schema `WebSite` | Kecil | Ditambahkan di beranda |

## Yang perlu dilakukan pemilik klinik (tidak bisa dari kode)

Urut dari dampak terbesar untuk pencarian lokal:

1. **Google Business Profile (Google Maps)** — faktor nomor satu untuk "dokter gigi dekat saya".
   - Pastikan nama, alamat (**Jl. Sudirman No.7, Kaniang Bukik, Payakumbuh Utara**) dan nomor WA *persis sama* dengan website.
   - Kategori utama: *Dokter Gigi*; kategori tambahan: *Klinik Gigi*.
   - Isi "Area layanan": Payakumbuh, Harau, Luak, Situjuah Limo Nagari, Akabiluru, Guguak, Lareh Sago Halaban, Suliki, dst.
   - Isi jam buka, layanan, foto (depan, ruang periksa, dokter), dan tautkan ke website.
   - Unggah foto & posting rutin (mis. bagikan artikel blog sebagai "Pembaruan").
2. **Perbaiki tombol "Tulis ulasan".** Tautan `https://g.page/r/zanakdentalcare/review` kemungkinan tidak valid
   (format resminya memakai kode unik). Ambil tautan asli dari Google Business Profile → *Minta ulasan*,
   lalu kirimkan ke saya untuk dipasang. Ulasan baru secara rutin sangat berpengaruh untuk peringkat Maps.
3. **Google Search Console** — daftarkan situs, kirim `https://zanakdentalcare.web.app/sitemap.xml`,
   lalu minta pengindeksan untuk `/blog` dan tiap artikel.
4. **Domain sendiri** (mis. `zanakdentalcare.com` atau `.id`). Subdomain `web.app` bisa dipakai,
   tetapi domain sendiri lebih dipercaya pasien dan lebih mudah diingat. Firebase Hosting
   mendukung domain kustom; setelah pindah, ganti konstanta `SITE` di `tools/build-blog.mjs` dan URL di meta tag.
5. **Direktori lokal & media sosial** — cantumkan NAP yang sama di Instagram, TikTok, Facebook,
   dan direktori kesehatan (Halodoc/Alodokter/Good Doctor bila tersedia). Tautkan balik ke website.
6. **Tinjauan medis artikel** — minta drg. Muhammad Daffa Safra membaca ketujuh artikel. Bila setuju,
   isi `reviewer: drg. Muhammad Daffa Safra` di setiap file `blog/posts/*.md` lalu build ulang;
   halaman akan menampilkan "Ditinjau oleh" dan schema `reviewedBy` (penting untuk konten kesehatan/E-E-A-T).
7. **Rutin menulis** — 2–4 artikel per bulan. Ide topik dengan permintaan tinggi:
   gigi sensitif, gigi berlubang pada anak, biaya/estimasi tindakan (bila mau dipublikasikan),
   bau mulut, gigi kuning, tambal gigi depan, gigi goyang, sariawan, perawatan gigi saat hamil,
   cabut gigi saat puasa, perawatan setelah cabut gigi.

## Catatan teknis lain (prioritas rendah)

- Halaman layanan masih memakai desain lama (`style.css`, font Poppins) berbeda dari beranda. Tidak
  memengaruhi SEO langsung, tetapi memuat dua keluarga font sekaligus bila pengunjung berpindah halaman.
- Font Awesome (±100 KB) dimuat penuh dari CDN hanya untuk beberapa ikon; bisa diganti SVG inline untuk performa.
- `meta keywords` diabaikan Google — aman dibiarkan.
- `FAQPage` schema tetap boleh, tetapi Google kini jarang menampilkan rich result FAQ untuk situs non-pemerintah.
