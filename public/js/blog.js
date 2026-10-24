/* ============================================================
   ZANAK DENTAL CARE — blog.js (halaman /blog dan artikel)
   Menu HP + filter topik di daftar artikel. Halaman tetap
   terbaca penuh walau skrip ini gagal dimuat.
   ============================================================ */
(function () {
  'use strict';

  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (btn && menu) {
    const toggle = (open = !menu.classList.contains('open')) => {
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    };
    btn.addEventListener('click', () => toggle());
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  }

  // Daftar isi terbuka di layar lebar, terlipat di HP agar isi artikel langsung terlihat.
  const toc = document.getElementById('postToc');
  if (toc && window.matchMedia('(min-width: 960px)').matches) toc.open = true;

  const list = document.getElementById('postList');
  const chips = document.querySelectorAll('.filter-chip[data-cat]');
  if (list && chips.length) {
    chips.forEach((chip) => chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle('on', on);
        c.setAttribute('aria-pressed', on);
      });
      list.querySelectorAll('.post-card').forEach((card) => {
        card.hidden = !!cat && card.dataset.cat !== cat;
      });
    }));
  }
})();
