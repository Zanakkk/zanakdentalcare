#!/usr/bin/env node
/* ============================================================
   build-blog.mjs — generator blog Zanak Dental Care

   Cara pakai:
     1. Tulis artikel baru di blog/posts/<slug>.md (lihat README).
     2. Jalankan:  node tools/build-blog.mjs
     3. Commit semua perubahan di public/ lalu push.

   Yang dihasilkan otomatis:
     - public/blog/<slug>.html   halaman artikel
     - public/blog.html          daftar artikel (/blog)
     - public/blog/feed.xml      RSS
     - public/sitemap.xml        sitemap lengkap (halaman statis + artikel)
     - blok "Artikel terbaru" di beranda dan "Artikel terkait" di
       halaman tindakan (di antara penanda BLOG:...:START/END)

   Tanpa dependensi — cukup Node 18+.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = join(ROOT, 'blog', 'posts');
const PUBLIC = join(ROOT, 'public');
const SITE = 'https://zanakdentalcare.web.app';
const ASSET_V = '20261024a';
const OG_IMAGE = `${SITE}/assets/images/og-zanak.jpg`;

/* Halaman statis untuk sitemap. Perbarui lastmod bila isi halaman berubah. */
const STATIC_PAGES = [
  { path: '/', lastmod: '2026-10-24', changefreq: 'weekly', priority: '1.0' },
  { path: '/treatment', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.9' },
  { path: '/scaling-gigi-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/tambal-gigi-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/cabut-gigi-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/saluran-akar-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/odontektomi-gigi-bungsu-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/kawat-gigi-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/gigi-tiruan-payakumbuh', lastmod: '2026-10-24', changefreq: 'monthly', priority: '0.8' },
  { path: '/galeri', lastmod: '2026-10-24', changefreq: 'weekly', priority: '0.7' },
];

/* Nama tampilan halaman tindakan (dipakai kolom `service` di artikel). */
const SERVICES = {
  'scaling-gigi-payakumbuh': 'Scaling Gigi',
  'tambal-gigi-payakumbuh': 'Tambal Gigi',
  'cabut-gigi-payakumbuh': 'Cabut Gigi',
  'saluran-akar-payakumbuh': 'Perawatan Saluran Akar',
  'odontektomi-gigi-bungsu-payakumbuh': 'Odontektomi Gigi Bungsu',
  'kawat-gigi-payakumbuh': 'Kawat Gigi (Behel)',
  'gigi-tiruan-payakumbuh': 'Gigi Tiruan',
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const tanggal = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${BULAN[m - 1]} ${y}`; };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const jsonLd = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n  </script>`;

/* ── Front matter + markdown sederhana ─────────────────────── */
function parsePost(file) {
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: front matter (---) tidak ditemukan`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  meta.slug = meta.slug || file.replace(/\.md$/, '');
  for (const k of ['title', 'description', 'date', 'category']) {
    if (!meta[k]) throw new Error(`${file}: kolom "${k}" wajib diisi`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date harus YYYY-MM-DD`);
  if (meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) throw new Error(`${file}: updated harus YYYY-MM-DD`);
  if (meta.service && !SERVICES[meta.service]) throw new Error(`${file}: service "${meta.service}" tidak dikenal`);
  const body = m[2].trim();
  const { html, toc } = markdown(body);
  const words = body.replace(/[#>*\-\[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
  return { ...meta, html, toc, minutes: Math.max(1, Math.ceil(words / 180)), draft: meta.draft === 'true' };
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
}

function markdown(src) {
  const out = [];
  const toc = [];
  for (const block of src.split(/\n{2,}/)) {
    const lines = block.split('\n');
    const first = lines[0];
    if (first.startsWith('### ')) {
      out.push(`<h3>${inline(first.slice(4))}</h3>`);
      if (lines.length > 1) out.push(`<p>${inline(lines.slice(1).join(' '))}</p>`);
    } else if (first.startsWith('## ')) {
      const text = first.slice(3);
      const id = slugify(text);
      toc.push({ id, text });
      out.push(`<h2 id="${id}">${inline(text)}</h2>`);
      if (lines.length > 1) out.push(`<p>${inline(lines.slice(1).join(' '))}</p>`);
    } else if (lines.every((l) => /^- /.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`);
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`);
    } else if (lines.every((l) => l.startsWith('>'))) {
      const text = lines.map((l) => l.replace(/^>\s?/, '')).join(' ');
      const warn = /^\*\*(Segera|Darurat|Penting)/i.test(text);
      out.push(`<aside class="callout${warn ? ' callout--warn' : ''}"><p>${inline(text)}</p></aside>`);
    } else if (first.startsWith('<')) {
      out.push(block); // HTML mentah
    } else {
      out.push(`<p>${inline(lines.join(' '))}</p>`);
    }
  }
  return { html: out.join('\n'), toc };
}

/* ── Potongan halaman bersama ──────────────────────────────── */
const headCommon = `
  <link rel="icon" type="image/webp" href="/assets/images/logo.webp">
  <link rel="apple-touch-icon" href="/assets/images/logo.webp">
  <meta name="theme-color" content="#F3F1EC">
  <link rel="alternate" type="application/rss+xml" title="Blog Zanak Dental Care" href="${SITE}/blog/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdnjs.cloudflare.com">
  <link rel="preload" as="style"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&family=JetBrains+Mono:wght@500;600&display=swap"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&family=JetBrains+Mono:wght@500;600&display=swap"></noscript>
  <link rel="preload" as="style"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"></noscript>
  <link rel="stylesheet" href="/css/home.css?v=${ASSET_V}">`;

function metaTags({ title, description, url, type = 'website', published, modified }) {
  return `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Zanak Dental Care, klinik gigi di Payakumbuh">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Zanak Dental Care">
  <meta property="og:locale" content="id_ID">${published ? `
  <meta property="article:published_time" content="${published}">
  <meta property="article:modified_time" content="${modified}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <meta name="geo.region" content="ID-SB">
  <meta name="geo.placename" content="Payakumbuh">`;
}

const header = `
  <header class="nav" id="navbar">
    <div class="container nav-row">
      <a href="/" class="brand" aria-label="Zanak Dental Care — beranda">
        <span class="brand-mark"><img src="/assets/images/logo.webp" alt="" width="38" height="38"></span>
        <span class="brand-word">Zanak<small>Dental Care</small></span>
      </a>
      <nav class="nav-links" aria-label="Navigasi utama">
        <a href="/treatment">Layanan</a>
        <a href="/blog" class="active">Blog</a>
        <a href="/galeri">Galeri</a>
        <a href="/#dokter">Dokter</a>
        <a href="/#jadwal">Jadwal</a>
        <a href="/#lokasi">Lokasi</a>
      </nav>
      <div class="nav-cta">
        <a href="/#antrian-online" class="btn btn-primary btn-sm"><i class="fas fa-calendar-check"></i> Reservasi</a>
      </div>
      <button class="hamburger" id="hamburger" aria-label="Buka menu" aria-expanded="false" aria-controls="mobileMenu">
        <span></span><span></span><span></span>
      </button>
    </div>
    <nav class="mobile-menu" id="mobileMenu" aria-label="Menu">
      <a href="/" class="mobile-link">Beranda</a>
      <a href="/treatment" class="mobile-link">Layanan</a>
      <a href="/blog" class="mobile-link">Blog kesehatan gigi</a>
      <a href="/galeri" class="mobile-link">Galeri hasil perawatan</a>
      <a href="/#dokter" class="mobile-link">Dokter</a>
      <a href="/#lokasi" class="mobile-link">Lokasi</a>
      <a href="/#antrian-online" class="btn btn-primary btn-full mobile-link"><i class="fas fa-calendar-check"></i> Reservasi Sekarang</a>
    </nav>
  </header>`;

const footer = `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="/" class="brand">
            <span class="brand-mark"><img src="/assets/images/logo.webp" alt="" width="38" height="38" loading="lazy"></span>
            <span class="brand-word">Zanak<small>Dental Care</small></span>
          </a>
          <p class="footer-tagline">Zanak sado Urang</p>
          <p class="footer-desc">Klinik gigi keluarga di Payakumbuh Utara, melayani warga Kota Payakumbuh dan Kabupaten Lima Puluh Kota.</p>
          <div class="footer-sosmed">
            <a href="https://instagram.com/zanakdentalcare" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
            <a href="https://tiktok.com/@zanakdentalcare" target="_blank" rel="noopener" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
            <a href="https://wa.me/6289526697902" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
            <a href="mailto:zanakdentalcare@gmail.com" aria-label="Email"><i class="fas fa-envelope"></i></a>
          </div>
        </div>
        <div class="footer-links">
          <h4>Layanan</h4>
          <ul>
${Object.entries(SERVICES).map(([s, n]) => `            <li><a href="/${s}">${n}</a></li>`).join('\n')}
          </ul>
        </div>
        <div class="footer-links">
          <h4>Pasien</h4>
          <ul>
            <li><a href="/#antrian-online">Reservasi Online</a></li>
            <li><a href="/antrian-status">Cek Reservasi</a></li>
            <li><a href="/blog">Blog Kesehatan Gigi</a></li>
            <li><a href="/galeri">Galeri Hasil Perawatan</a></li>
            <li><a href="/#faq">FAQ</a></li>
          </ul>
        </div>
        <div class="footer-kontak">
          <h4>Kontak</h4>
          <p><i class="fas fa-map-marker-alt"></i> Jl. Sudirman No.7, Kaniang Bukik, Kec. Payakumbuh Utara, Kota Payakumbuh, Sumatera Barat</p>
          <p><i class="fab fa-whatsapp"></i> <a href="https://wa.me/6289526697902">0895-2669-7902</a></p>
          <p><i class="fas fa-clock"></i> Senin–Sabtu 10.00–21.00 · Minggu dengan reservasi</p>
          <p><i class="fas fa-envelope"></i> <a href="mailto:zanakdentalcare@gmail.com">zanakdentalcare@gmail.com</a></p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 <strong>Zanak Dental Care</strong> · Payakumbuh Utara, Sumatera Barat</span>
        <span><a href="/blog/feed.xml"><i class="fas fa-rss"></i> RSS blog</a></span>
      </div>
    </div>
  </footer>

  <div class="float-actions is-visible">
    <a href="/#antrian-online" class="qa-book"><i class="fas fa-calendar-check"></i> Reservasi</a>
    <a href="https://wa.me/6289526697902?text=Halo%20Zanak%20Dental%20Care%2C%20saya%20mau%20konsultasi%20setelah%20membaca%20blog"
       class="qa-wa" target="_blank" rel="noopener" aria-label="Chat WhatsApp Zanak Dental Care">
      <i class="fab fa-whatsapp"></i> <span>WhatsApp</span>
    </a>
  </div>

  <script src="/js/blog.js?v=${ASSET_V}" defer></script>`;

const ORG = {
  '@type': 'Dentist',
  '@id': `${SITE}/#klinik`,
  name: 'Zanak Dental Care',
  url: `${SITE}/`,
  logo: `${SITE}/assets/images/logo.webp`,
};

function card(p, headingTag = 'h3') {
  return `<a href="/blog/${p.slug}" class="post-card">
            <span class="post-cat">${esc(p.category)}</span>
            <${headingTag}>${esc(p.title)}</${headingTag}>
            <p>${esc(p.description)}</p>
            <span class="post-meta"><time datetime="${p.date}">${tanggal(p.date)}</time> · ${p.minutes} menit baca</span>
          </a>`;
}

/* ── Halaman artikel ───────────────────────────────────────── */
function renderPost(p, all) {
  const url = `${SITE}/blog/${p.slug}`;
  const modified = p.updated || p.date;
  const related = all.filter((o) => o.slug !== p.slug)
    .sort((a, b) => (b.category === p.category) - (a.category === p.category) || b.date.localeCompare(a.date))
    .slice(0, 3);
  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#artikel`,
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      dateModified: modified,
      inLanguage: 'id-ID',
      articleSection: p.category,
      image: OG_IMAGE,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'Tim Zanak Dental Care', url: `${SITE}/` },
      publisher: ORG,
      ...(p.service ? { about: { '@type': 'MedicalProcedure', name: SERVICES[p.service], url: `${SITE}/${p.service}` } } : {}),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ],
    },
  ];
  if (p.reviewer) {
    graph.push({
      '@type': 'MedicalWebPage',
      '@id': url,
      url,
      name: p.title,
      inLanguage: 'id-ID',
      lastReviewed: modified,
      reviewedBy: { '@type': 'Person', name: p.reviewer, jobTitle: 'Dokter Gigi', worksFor: ORG },
    });
  }

  const svc = p.service ? `
            <div class="post-service">
              <span class="eyebrow">Layanan terkait di Zanak</span>
              <h3>${SERVICES[p.service]} di Payakumbuh</h3>
              <p>Prosedur, durasi, dan perawatan setelah tindakan dijelaskan lengkap.</p>
              <a href="/${p.service}" class="btn btn-outline btn-sm">Lihat detail layanan <i class="fas fa-arrow-right"></i></a>
            </div>` : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${metaTags({ title: p.seoTitle || `${p.title} — Zanak Dental Care`, description: p.description, url, type: 'article', published: p.date, modified })}
  ${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}
${headCommon}
</head>
<body class="home blog">
  <div class="bg-grid" aria-hidden="true"></div>
${header}

  <main>
    <article class="section post">
      <div class="container post-wrap">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="/">Beranda</a> <i class="fas fa-chevron-right"></i>
          <a href="/blog">Blog</a> <i class="fas fa-chevron-right"></i>
          <span aria-current="page">${esc(p.category)}</span>
        </nav>
        <header class="post-head">
          <span class="eyebrow">${esc(p.category)}</span>
          <h1>${esc(p.title)}</h1>
          <p class="post-lead">${esc(p.description)}</p>
          <p class="post-byline">
            <span><i class="fas fa-user-doctor"></i> Tim Zanak Dental Care${p.reviewer ? ` · Ditinjau oleh <strong>${esc(p.reviewer)}</strong>` : ''}</span>
            <span><i class="far fa-calendar"></i> <time datetime="${p.date}">${tanggal(p.date)}</time>${p.updated ? ` · diperbarui <time datetime="${p.updated}">${tanggal(p.updated)}</time>` : ''}</span>
            <span><i class="far fa-clock"></i> ${p.minutes} menit baca</span>
          </p>
        </header>

        <div class="post-grid">
          <div class="prose">
${p.html}
            <div class="post-cta">
              <h2>Ada keluhan serupa?</h2>
              <p>Periksakan langsung ke drg. Muhammad Daffa Safra di Zanak Dental Care, Jl. Sudirman No.7, Payakumbuh Utara. Pilih jam kosong sendiri secara online — mudah dijangkau dari seluruh Kota Payakumbuh dan Kabupaten Lima Puluh Kota.</p>
              <div class="hero-ctas">
                <a href="/#antrian-online" class="btn btn-white"><i class="fas fa-calendar-check"></i> Reservasi online</a>
                <a href="https://wa.me/6289526697902?text=${encodeURIComponent(`Halo Zanak, saya baru baca artikel "${p.title}" dan mau konsultasi`)}" class="btn btn-wa" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Tanya via WhatsApp</a>
              </div>
            </div>
            <p class="post-disclaimer"><i class="fas fa-circle-info"></i> Artikel ini untuk edukasi umum dan tidak menggantikan pemeriksaan langsung oleh dokter gigi. Kondisi tiap orang berbeda.</p>
          </div>

          <aside class="post-side">${p.toc.length > 2 ? `
            <details class="post-toc" id="postToc">
              <summary class="eyebrow">Daftar isi</summary>
              <ol>
${p.toc.map((t) => `                <li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('\n')}
              </ol>
            </details>` : ''}${svc}
          </aside>
        </div>
      </div>
    </article>
${related.length ? `
    <section class="section section--soft">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Baca juga</span>
          <h2>Artikel lainnya</h2>
        </div>
        <div class="post-list">
          ${related.map((r) => card(r)).join('\n          ')}
        </div>
      </div>
    </section>` : ''}
  </main>
${footer}
</body>
</html>
`;
}

/* ── Halaman daftar /blog ──────────────────────────────────── */
function renderIndex(posts) {
  const url = `${SITE}/blog`;
  const cats = [...new Set(posts.map((p) => p.category))];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${url}#blog`,
        name: 'Blog Kesehatan Gigi Zanak Dental Care',
        url,
        inLanguage: 'id-ID',
        description: 'Artikel kesehatan gigi dan mulut dari Zanak Dental Care Payakumbuh untuk warga Payakumbuh dan Kabupaten Lima Puluh Kota.',
        publisher: ORG,
        blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: url },
        ],
      },
    ],
  };
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${metaTags({ title: 'Blog Kesehatan Gigi — Zanak Dental Care Payakumbuh', description: 'Tips dan informasi kesehatan gigi dari dokter gigi di Payakumbuh: sakit gigi, karang gigi, gigi anak, behel, gigi bungsu. Untuk warga Payakumbuh dan Lima Puluh Kota.', url })}
  ${jsonLd(ld)}
${headCommon}
</head>
<body class="home blog">
  <div class="bg-grid" aria-hidden="true"></div>
${header}

  <main>
    <section class="section blog-page">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="/">Beranda</a> <i class="fas fa-chevron-right"></i>
          <span aria-current="page">Blog</span>
        </nav>
        <div class="section-head">
          <span class="eyebrow">Blog kesehatan gigi</span>
          <h1>Cerita &amp; tips gigi sehat dari Payakumbuh</h1>
          <p>Penjelasan sederhana seputar keluhan gigi yang paling sering kami temui di klinik — ditulis untuk warga Kota Payakumbuh dan Kabupaten Lima Puluh Kota.</p>
        </div>
        <div class="gallery-filter" role="group" aria-label="Pilih topik">
          <button type="button" class="filter-chip on" aria-pressed="true" data-cat="">Semua <span>${posts.length}</span></button>
${cats.map((c) => `          <button type="button" class="filter-chip" aria-pressed="false" data-cat="${esc(c)}">${esc(c)} <span>${posts.filter((p) => p.category === c).length}</span></button>`).join('\n')}
        </div>
        <div class="post-list" id="postList">
          ${posts.map((p) => card(p, 'h2').replace('class="post-card"', `class="post-card" data-cat="${esc(p.category)}"`)).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="cta-box">
          <h2>Daripada menebak-nebak, periksa saja.</h2>
          <p>Pilih tanggal dan jam kosong dari HP, lalu datang ke Jl. Sudirman No.7, Payakumbuh Utara.</p>
          <div class="hero-ctas">
            <a href="/#antrian-online" class="btn btn-white btn-lg"><i class="fas fa-calendar-check"></i> Reservasi Sekarang</a>
            <a href="https://wa.me/6289526697902?text=Halo%20Zanak%20Dental%20Care%2C%20saya%20mau%20bertanya" class="btn btn-wa btn-lg" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Chat WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  </main>
${footer}
</body>
</html>
`;
}

/* ── RSS & sitemap ─────────────────────────────────────────── */
function renderFeed(posts) {
  const items = posts.map((p) => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.date}T08:00:00+07:00`).toUTCString()}</pubDate>
      <category>${esc(p.category)}</category>
      <description>${esc(p.description)}</description>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Kesehatan Gigi — Zanak Dental Care</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Tips kesehatan gigi dari Zanak Dental Care, klinik gigi di Payakumbuh.</description>
    <language>id</language>${items}
  </channel>
</rss>
`;
}

function renderSitemap(posts) {
  const newest = posts.reduce((m, p) => ((p.updated || p.date) > m ? (p.updated || p.date) : m), '2026-10-24');
  const urls = [
    ...STATIC_PAGES,
    { path: '/blog', lastmod: newest, changefreq: 'weekly', priority: '0.8' },
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updated || p.date, changefreq: 'monthly', priority: '0.7' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Dibuat otomatis oleh tools/build-blog.mjs — ubah STATIC_PAGES di sana, bukan di sini. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.path}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

/* ── Sisipan di halaman yang sudah ada ─────────────────────── */
function inject(file, name, html) {
  const path = join(PUBLIC, file);
  const src = readFileSync(path, 'utf8');
  const re = new RegExp(`(<!-- BLOG:${name}:START -->)[\\s\\S]*?(<!-- BLOG:${name}:END -->)`);
  if (!re.test(src)) { console.warn(`  ! penanda BLOG:${name} tidak ada di ${file}, dilewati`); return; }
  const out = src.replace(re, `$1\n${html}\n    $2`);
  if (out !== src) writeFileSync(path, out);
}

function latestBlock(posts) {
  return `    <section class="section section--soft" id="blog">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">Blog kesehatan gigi</span>
          <h2>Baca dulu sebelum ke dokter gigi</h2>
          <p>Tips singkat dari klinik untuk keluhan yang paling sering ditanyakan warga Payakumbuh dan Lima Puluh Kota.</p>
        </div>
        <div class="post-list reveal">
          ${posts.slice(0, 3).map((p) => card(p)).join('\n          ')}
        </div>
        <div class="story-more">
          <a href="/blog" class="btn btn-outline"><i class="fas fa-book-open"></i> Semua artikel</a>
        </div>
      </div>
    </section>`;
}

function relatedBlock(list) {
  if (!list.length) return '';
  return `    <section class="related-posts">
      <div class="container">
        <span class="section-tag">Baca juga</span>
        <h2>Artikel terkait</h2>
        <div class="related-grid">
${list.map((p) => `          <a href="/blog/${p.slug}" class="related-card">
            <span>${esc(p.category)} · ${p.minutes} menit baca</span>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.description)}</p>
          </a>`).join('\n')}
        </div>
        <a href="/blog" class="related-all">Semua artikel blog <i class="fas fa-arrow-right"></i></a>
      </div>
    </section>`;
}

/* ── Main ──────────────────────────────────────────────────── */
const posts = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))
  .map(parsePost)
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

const slugs = new Set();
for (const p of posts) {
  if (slugs.has(p.slug)) throw new Error(`slug ganda: ${p.slug}`);
  slugs.add(p.slug);
}

const outDir = join(PUBLIC, 'blog');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
for (const p of posts) writeFileSync(join(outDir, `${p.slug}.html`), renderPost(p, posts));
writeFileSync(join(PUBLIC, 'blog.html'), renderIndex(posts));
writeFileSync(join(outDir, 'feed.xml'), renderFeed(posts));
writeFileSync(join(PUBLIC, 'sitemap.xml'), renderSitemap(posts));

inject('index.html', 'LATEST', latestBlock(posts));
for (const svc of Object.keys(SERVICES)) {
  inject(`${svc}.html`, 'RELATED', relatedBlock(posts.filter((p) => p.service === svc || (p.alsoService || '').split(',').map((s) => s.trim()).includes(svc)).slice(0, 3)));
}

console.log(`Blog dibuat: ${posts.length} artikel → public/blog/, blog.html, feed.xml, sitemap.xml`);
