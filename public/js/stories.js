/* ============================================================
   ZANAK DENTAL CARE — stories.js
   Konten before–after dari ApexRecord (menu Konten), dikelompokkan per
   tindakan. Dipakai beranda (main.js), galeri.html, dan halaman tindakan.
   Butuh apex-api.js dimuat lebih dulu.
   ============================================================ */

(function () {
  'use strict';

  const OTHER = 'Lainnya';
  const api = () => window.ZDC_API;

  /** Nama tindakan konten (template di ApexRecord), atau "Lainnya". */
  const groupName = (c) => (c.treatment && c.treatment.name) || OTHER;

  /** [{ name, items }] — urut sesuai konten terbaru, "Lainnya" paling akhir. */
  function group(items) {
    const map = new Map();
    items.forEach((c) => {
      const name = groupName(c);
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(c);
    });
    return [...map.entries()]
      .map(([name, list]) => ({ name, items: list }))
      .sort((a, b) => (a.name === OTHER) - (b.name === OTHER));
  }

  /** Cocok dengan halaman tindakan bila nama tindakan/judul memuat salah satu kata kunci. */
  function matches(c, keys) {
    const hay = `${groupName(c)} ${c.title || ''}`.toLowerCase();
    return keys.some((k) => hay.includes(k));
  }

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  /**
   * Kartu story (gambar 9:16). `href` → kartu jadi tautan; tanpa href →
   * tombol dengan data-story-id (dibuka di lightbox oleh galeri).
   */
  function card(c, { href, showGroup = true } = {}) {
    const { esc, fileUrl } = api();
    const title = c.title || 'Hasil perawatan';
    const inner = `
      ${c.imageUrl ? `<img src="${esc(fileUrl(c.imageUrl))}" alt="${esc(`Sebelum dan sesudah: ${title}`)}" loading="lazy" width="540" height="960">` : ''}
      <span class="story-body">
        ${showGroup && groupName(c) !== OTHER ? `<span class="story-tag">${esc(groupName(c))}</span>` : ''}
        <span class="story-title">${esc(title)}</span>
        ${c.caption ? `<span class="story-caption">${esc(c.caption)}</span>` : ''}
      </span>`;
    return href
      ? `<a class="story story--tall" href="${esc(href)}">${inner}</a>`
      : `<button type="button" class="story story--tall" data-story-id="${esc(c.id)}">${inner}</button>`;
  }

  window.ZDC_STORIES = { OTHER, groupName, group, matches, card, fmtDate };
})();
