/* ============================================================
   ZANAK DENTAL CARE — galeri.js
   Halaman galeri: semua konten before–after, dikelompokkan per tindakan,
   dengan filter (?tindakan=Tambal) dan tampilan besar (lightbox).
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const S = () => window.ZDC_STORIES;
  const api = () => window.ZDC_API;

  let items = [];
  let groups = [];
  let active = 'Semua';
  /** Konten yang sedang terlihat (sesuai filter), untuk panah di lightbox. */
  let visible = [];
  let current = -1;

  function initNav() {
    const btn = $('hamburger');
    const menu = $('mobileMenu');
    if (!btn || !menu) return;
    const toggle = (open = !menu.classList.contains('open')) => {
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    };
    btn.addEventListener('click', () => toggle());
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  }

  function renderFilter() {
    const { esc } = api();
    const chips = [{ name: 'Semua', count: items.length }, ...groups.map((g) => ({ name: g.name, count: g.items.length }))];
    $('galleryFilter').innerHTML = chips
      .map((c) => `<button type="button" class="filter-chip${c.name === active ? ' on' : ''}" aria-pressed="${c.name === active}" data-filter="${esc(c.name)}">${esc(c.name)} <span>${c.count}</span></button>`)
      .join('');
  }

  function renderGroups() {
    const { esc } = api();
    const shown = active === 'Semua' ? groups : groups.filter((g) => g.name === active);
    visible = shown.flatMap((g) => g.items);
    $('galleryGroups').innerHTML = shown
      .map((g) => `
        <section class="gallery-group" aria-labelledby="g-${esc(g.name)}">
          <div class="gallery-group-head">
            <h2 id="g-${esc(g.name)}">${esc(g.name)}</h2>
            <span>${g.items.length} cerita perawatan</span>
          </div>
          <div class="story-grid story-grid--tall">
            ${g.items.map((c) => S().card(c, { showGroup: false })).join('')}
          </div>
        </section>`)
      .join('');
  }

  function setFilter(name, push = true) {
    active = groups.some((g) => g.name === name) ? name : 'Semua';
    renderFilter();
    renderGroups();
    if (push) {
      const url = new URL(location.href);
      if (active === 'Semua') url.searchParams.delete('tindakan');
      else url.searchParams.set('tindakan', active);
      history.replaceState(null, '', url);
    }
  }

  function openStory(index) {
    const c = visible[index];
    const dlg = $('storyDialog');
    if (!c || !dlg) return;
    current = index;
    const { fileUrl } = api();
    $('dlgImage').src = c.imageUrl ? fileUrl(c.imageUrl) : '';
    $('dlgImage').alt = `Sebelum dan sesudah: ${c.title || 'Hasil perawatan'}`;
    $('dlgTag').textContent = S().groupName(c);
    $('dlgTitle').textContent = c.title || 'Hasil perawatan';
    $('dlgCaption').textContent = c.caption || '';
    $('dlgDate').textContent = S().fmtDate(c.publishedAt);
    $('dlgPrev').disabled = index <= 0;
    $('dlgNext').disabled = index >= visible.length - 1;
    $('dlgCount').textContent = `${index + 1} / ${visible.length}`;
    if (!dlg.open) dlg.showModal();
  }

  function initDialog() {
    const dlg = $('storyDialog');
    if (!dlg) return;
    $('dlgClose').addEventListener('click', () => dlg.close());
    $('dlgPrev').addEventListener('click', () => openStory(current - 1));
    $('dlgNext').addEventListener('click', () => openStory(current + 1));
    // Klik di luar gambar menutup.
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') openStory(current - 1);
      if (e.key === 'ArrowRight') openStory(current + 1);
    });
  }

  async function init() {
    initNav();
    initDialog();
    try {
      items = await api().contents();
    } catch (err) {
      console.error('[Galeri]', err);
      items = [];
    }
    $('galleryLoading').hidden = true;
    if (!Array.isArray(items) || !items.length) {
      $('galleryEmpty').hidden = false;
      return;
    }
    groups = S().group(items);
    setFilter(new URLSearchParams(location.search).get('tindakan') || 'Semua', false);

    $('galleryFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (b) setFilter(b.dataset.filter);
    });
    $('galleryGroups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-story-id]');
      if (!b) return;
      openStory(visible.findIndex((c) => String(c.id) === b.dataset.storyId));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
