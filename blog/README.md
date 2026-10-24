# Blog Zanak Dental Care

Artikel ditulis sebagai file Markdown di `blog/posts/`, lalu diubah menjadi
halaman HTML oleh `tools/build-blog.mjs`. Tidak perlu install apa pun selain Node.js.

## Menambah artikel

1. Buat file baru `blog/posts/<slug>.md`. Slug = alamat artikel, mis.
   `gigi-sensitif` → `https://zanakdentalcare.web.app/blog/gigi-sensitif`.
   Pakai huruf kecil dan tanda hubung, sebaiknya memuat kata kunci.
2. Isi bagian atas (front matter):

   ```
   ---
   title: Judul yang tampil di halaman
   seoTitle: Judul untuk Google (opsional, maks. ±60 karakter)
   description: Ringkasan 1–2 kalimat (±150 karakter) — tampil di Google & WhatsApp
   date: 2026-11-01
   updated: 2026-12-01            (opsional, isi bila artikel direvisi)
   category: Pencegahan
   service: scaling-gigi-payakumbuh   (opsional, halaman layanan terkait)
   alsoService: tambal-gigi-payakumbuh (opsional, dipisah koma)
   reviewer: drg. Muhammad Daffa Safra (opsional, isi bila dokter sudah meninjau)
   draft: true                     (opsional, artikel tidak diterbitkan)
   ---
   ```

   Nilai `service`: `scaling-gigi-payakumbuh`, `tambal-gigi-payakumbuh`,
   `cabut-gigi-payakumbuh`, `saluran-akar-payakumbuh`,
   `odontektomi-gigi-bungsu-payakumbuh`, `kawat-gigi-payakumbuh`,
   `gigi-tiruan-payakumbuh`.

3. Tulis isi di bawahnya:

   | Tulis | Hasil |
   |---|---|
   | `## Subjudul` | subjudul (masuk daftar isi) |
   | `### Sub-subjudul` | subjudul kecil |
   | `- butir` | daftar berbutir |
   | `1. langkah` | daftar bernomor |
   | `**tebal**`, `*miring*` | **tebal**, *miring* |
   | `[teks](/scaling-gigi-payakumbuh)` | tautan |
   | `> teks` | kotak catatan biru |
   | `> **Segera** …` / `> **Darurat** …` / `> **Penting** …` | kotak peringatan merah |

   Pisahkan paragraf dengan satu baris kosong.

4. Jalankan dari folder repo:

   ```bash
   node tools/build-blog.mjs
   ```

   Ini membuat ulang halaman artikel, `/blog`, RSS, `sitemap.xml`, blok
   "Artikel terbaru" di beranda, dan "Artikel terkait" di halaman layanan.

5. Commit dan push. Setelah digabung ke `main`, GitHub Actions men-deploy ke Firebase.

## Tips menulis agar mudah ditemukan warga Payakumbuh & Lima Puluh Kota

- Jawab satu pertanyaan nyata pasien per artikel (mis. "gigi sensitif setelah scaling").
- Sebut lokasi secara wajar di pembuka atau penutup, jangan dijejalkan.
- Tautkan ke halaman layanan yang relevan dan ke artikel lain.
- Minta drg. Daffa membaca dan mengisi `reviewer` — kredibilitas medis
  penting untuk artikel kesehatan di Google.
- Jangan edit file di `public/blog/` secara langsung; akan tertimpa saat build.
