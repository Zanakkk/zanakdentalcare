/* ============================================================
   ZANAK DENTAL CARE — treatment-stories.js
   Halaman tindakan: tampilkan konten before–after dari ApexRecord yang
   tindakannya cocok dengan halaman ini (section#hasil[data-treatment]).
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const section = document.getElementById('hasil');
    const grid = document.getElementById('treatStories');
    if (!section || !grid || !window.ZDC_API || !window.ZDC_STORIES) return;
    const S = window.ZDC_STORIES;
    const keys = (section.dataset.treatment || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);

    let items = [];
    try { items = await window.ZDC_API.contents(); } catch (err) { console.error('[Konten]', err); }
    const mine = (Array.isArray(items) ? items : []).filter((c) => S.matches(c, keys));
    if (!mine.length) return;

    // Galeri dibuka di kelompok tindakannya (nama template di ApexRecord).
    const group = S.groupName(mine[0]);
    const href = group === S.OTHER ? 'galeri.html' : `galeri.html?tindakan=${encodeURIComponent(group)}`;
    grid.innerHTML = mine.slice(0, 4).map((c) => S.card(c, { href, showGroup: false })).join('');
    const more = document.getElementById('treatStoriesMore');
    if (more) more.href = href;
    section.hidden = false;
  });
})();
