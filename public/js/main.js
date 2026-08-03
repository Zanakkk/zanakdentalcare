/* ============================================================
   ZANAK DENTAL CARE — main.js
   Vanilla JS ES6+ | Zero dependencies (AOS loaded separately)
   v2.1 — carousel reusable + swipe, WA number disatukan
   ============================================================ */

'use strict';

/* ── CONSTANTS ───────────────────────────────────────────────── */
const WA_NUMBER = '6289526697902';

//  const BASE_URL  = 'https://apexrecord.my.id';
//  const BASE_URL  = 'http://210.79.190.195:3000';


const BASE_URL = 'https://api.apexrecord.my.id';
const CLINIC_ID = 1;
const EP_CLINIC_INFO = `${BASE_URL}/public/clinic-info?clinicId=${CLINIC_ID}`;

// NOTE INFRA: fetch ke IP mentah dengan HTTPS sering diblok browser
// karena sertifikat tidak valid untuk alamat IP. Kalau badge jam buka
// terus gagal, pindahkan backend ke domain asli dengan sertifikat
// valid (Let's Encrypt) atau proxy lewat Firebase Hosting rewrite.
// Sesudah
// ✅ BENAR — sesuai key dari API
const DAY_KEY = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const DAY_ID  = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

let clinicOperationalHours = null;

/* ── DOM READY ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initProgressBar();
  initNavbar();
  initHamburger();
  initSmoothScroll();
  initActiveNav();
  initClinicStatus();
  initCounters();
  initAOS();
  initWAFloat();
  initReservasiForm();
  initLazyImages();

  // Carousels
  initCarousel({ trackId: 'ltrack', prevId: 'lPrev', nextId: 'lNext', dotsId: 'lDots',
    breakpoints: { 0: 1, 640: 2, 900: 4 } });
  initCarousel({ trackId: 'ftrack', prevId: 'fPrev', nextId: 'fNext', dotsId: 'fDots',
    breakpoints: { 0: 1, 640: 2, 900: 3 } });
  initCarousel({ trackId: 'ttrack', prevId: 'tPrev', nextId: 'tNext', dotsId: 'tDots',
    breakpoints: { 0: 1, 640: 2, 900: 3 } });
});

/* ============================================================
   1. SCROLL PROGRESS BAR
   ============================================================ */
function initProgressBar() {
  const bar = document.createElement('div');
  bar.id = 'progressBar';
  document.body.prepend(bar);

  const update = () => {
    const scrolled = window.scrollY;
    const total    = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = total > 0 ? `${(scrolled / total) * 100}%` : '0%';
  };
  window.addEventListener('scroll', update, { passive: true });
}

/* ============================================================
   2. NAVBAR — scroll effect + hide/show on direction
   ============================================================ */
function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  let lastY   = 0;
  let ticking = false;

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        nav.classList.toggle('scrolled', y > 20);
        if (y > 80) {
          nav.style.transform = y > lastY ? 'translateY(-100%)' : 'translateY(0)';
        } else {
          nav.style.transform = 'translateY(0)';
        }
        lastY   = y;
        ticking = false;
      });
      ticking = true;
    }
  };

  nav.style.transition = 'transform .3s ease, background .25s ease, box-shadow .25s ease';
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ============================================================
   3. HAMBURGER MENU
   ============================================================ */
function initHamburger() {
  const btn  = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;

  const toggle = (force) => {
    const open = force !== undefined ? force : !btn.classList.contains('open');
    btn.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  btn.addEventListener('click', () => toggle());
  menu.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) toggle(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggle(false);
  });
}

/* ============================================================
   4. SMOOTH SCROLL — anchor links
   ============================================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ============================================================
   5. ACTIVE NAV LINK — Intersection Observer
   ============================================================ */
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.navbar-menu a[href^="#"]');
  if (!sections.length || !links.length) return;

  const setActive = id => {
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
  };

  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) setActive(en.target.id); });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
}

/* ============================================================
   6. CLINIC STATUS — real-time buka / tutup
   ============================================================ */
async function initClinicStatus() {
  const badge = document.getElementById('statusBadge');
  const text  = document.getElementById('statusText');
  const dot   = badge?.querySelector('.status-dot');
  const jamEl = document.getElementById('statusJam');
  if (!badge || !text || !dot) return;

  try {
    const res  = await fetch(EP_CLINIC_INFO, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Gagal memuat jam operasional');
    clinicOperationalHours = data.data.operationalHours;
  } catch (err) {
    console.error('[ClinicStatus]', err);
    text.textContent = 'Jam operasional tidak tersedia';
    if (jamEl) jamEl.textContent = 'Info jam tidak tersedia';

    const list = document.getElementById('jamJadwalList');
    if (list) list.innerHTML = '<div class="jam-week-row jam-week-row--skeleton"><span>Jadwal tidak tersedia</span></div>';

    return;
  }

  const update = () => renderClinicStatus(badge, text, dot, jamEl);
  update();
  setInterval(update, 60_000);

  renderJamMingguan();
  renderFooterJam();
}

function renderJamMingguan() {
  const list = document.getElementById('jamJadwalList');
  if (!list || !clinicOperationalHours) return;

  const jsDay    = new Date().getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;

  // Paksa render sesuai urutan DAY_KEY (Senin→Minggu), abaikan urutan dari API
  list.innerHTML = DAY_KEY.map((key, idx) => {
    const raw      = clinicOperationalHours[key];
    const isToday  = idx === todayIdx;
    const isClosed = !raw || raw.toLowerCase() === 'tutup';
    const isSunday = key === 'sunday';
    const jamText  = isClosed ? 'Tutup' : raw.replace('-', ' – ');

    const classes = [
      'jam-week-row',
      isToday  ? 'jam-week-row--today'  : '',
      isClosed ? 'jam-week-row--closed' : '',
      isSunday ? 'jam-week-row--sunday' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="${classes}">
        <span class="jam-week-day">
          <span class="jam-week-day-name">${DAY_ID[idx]}</span>
          ${isToday ? '<span class="jam-week-today-tag">Hari Ini</span>' : ''}
        </span>
        <span class="jam-week-hours">${jamText}</span>
      </div>`;
  }).join('');
}

function renderFooterJam() {
  const mobileEl  = document.getElementById('footerJamMobile');
  const desktopEl = document.getElementById('footerJamDesktop');
  if (!clinicOperationalHours) return;

  // Konversi getDay() ke index array baru (Senin=0...Sabtu=5, Minggu=6)
  const jsDay    = new Date().getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const raw      = clinicOperationalHours[DAY_KEY[todayIdx]];

  const text = (!raw || raw.toLowerCase() === 'tutup')
    ? 'Tutup hari ini'
    : `Buka ${raw.replace('-', ' – ')} hari ini`;

  if (mobileEl)  mobileEl.textContent  = text;
  if (desktopEl) desktopEl.textContent = text;
}

function renderClinicStatus(badge, text, dot, jamEl) {
  if (!clinicOperationalHours) return;

  const now      = new Date();
  const jsDay    = now.getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1; // ← konversi
  const total    = now.getHours() * 60 + now.getMinutes();

  const dayKey = DAY_KEY[todayIdx]; // ← pakai index baru
  const raw    = clinicOperationalHours[dayKey];

  let open = false;
  let nextInfo = '';

  if (raw && raw.toLowerCase() !== 'tutup') {
    const [openStr, closeStr] = raw.split('-');
    const [oh, om] = openStr.split(':').map(Number);
    const [ch, cm] = closeStr.split(':').map(Number);
    const start = oh * 60 + om;
    const end   = ch * 60 + cm;

    if (total >= start && total < end) {
      open = true;
    } else if (total < start) {
      nextInfo = ` · Buka pukul ${openStr} hari ini`;
    }
  }

  if (!open && !nextInfo) {
    const next = findNextOpenDay(todayIdx); // ← pakai index baru
    if (next) nextInfo = ` · Buka ${DAY_ID[next.idx]} pukul ${next.open}`;
  }

  if (open) {
    text.textContent = 'Buka Sekarang';
    dot.className    = 'status-dot';
    if (jamEl) jamEl.textContent = 'Buka Sekarang ✓';
  } else {
    text.textContent = `Tutup${nextInfo}`;
    dot.className    = 'status-dot closed';
    if (jamEl) jamEl.textContent = `Tutup${nextInfo}`;
  }
}

function findNextOpenDay(fromIdx) {
  for (let i = 1; i <= 7; i++) {
    const idx = (fromIdx + i) % 7;
    const raw = clinicOperationalHours[DAY_KEY[idx]];
    if (raw && raw.toLowerCase() !== 'tutup') {
      return { idx, open: raw.split('-')[0] };
    }
  }
  return null;
}

/* ============================================================
   7. ANIMATED COUNTERS
   ============================================================ */
function initCounters() {
  const els = document.querySelectorAll('.counter[data-target]');
  if (!els.length) return;

  const animate = (el) => {
    const target = parseInt(el.dataset.target, 10);
    const dur    = 2000;
    const step   = 16;
    const inc    = target / (dur / step);
    let current  = 0;

    const tick = () => {
      current += inc;
      if (current >= target) { el.textContent = target.toLocaleString('id-ID'); return; }
      el.textContent = Math.floor(current).toLocaleString('id-ID');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { animate(en.target); obs.unobserve(en.target); }
    });
  }, { threshold: 0.5 });

  els.forEach(el => obs.observe(el));
}

/* ============================================================
   8. AOS INIT
   ============================================================ */
function initAOS() {
  const tryInit = () => {
    if (typeof AOS !== 'undefined') {
      AOS.init({ duration: 650, easing: 'ease-out-cubic', once: true, offset: 60, delay: 0 });
    } else {
      setTimeout(tryInit, 100);
    }
  };
  tryInit();
}

/* ============================================================
   9. WA FLOAT — show after scroll, message tergantung section
   ============================================================ */
function initWAFloat() {
  const btn = document.getElementById('waFloat');
  if (!btn) return;

  btn.style.opacity    = '0';
  btn.style.transform  = 'translateY(20px)';
  btn.style.transition = 'opacity .4s ease, transform .4s ease';

  const show = () => { btn.style.opacity = '1'; btn.style.transform = 'translateY(0)'; };
  setTimeout(show, 2000);
  window.addEventListener('scroll', show, { once: true, passive: true });

  const sections = {
    layanan:    `Halo%20Zanak%2C%20saya%20mau%20tanya%20soal%20layanan`,
    dokter:     `Halo%20Zanak%2C%20saya%20mau%20konsultasi%20dengan%20dokter`,
    'jam-buka': `Halo%20Zanak%2C%20saya%20mau%20tanya%20jadwal%20klinik`,
    testimoni:  `Halo%20Zanak%2C%20saya%20mau%20buat%20janji`,
    lokasi:     `Halo%20Zanak%2C%20saya%20mau%20tanya%20arah%20ke%20klinik`,
  };

  const updateMsg = (id) => {
    const msg = sections[id] || `Halo%20Zanak%20Dental%20Care%2C%20saya%20mau%20buat%20janji`;
    btn.href = `https://wa.me/${WA_NUMBER}?text=${msg}`;
  };

  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) updateMsg(en.target.id); });
  }, { threshold: 0.3 });

  Object.keys(sections).forEach(id => {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
}

/* ============================================================
   10. CAROUSEL — reusable untuk Layanan / Fasilitas / Testimoni
   Fitur: paging responsif, dots, prev/next, drag & swipe (mouse+touch)
   ============================================================ */
function initCarousel({ trackId, prevId, nextId, dotsId, gap = 16, breakpoints = { 0: 1, 640: 2, 900: 4 } }) {
  const track  = document.getElementById(trackId);
  const prev   = document.getElementById(prevId);
  const next   = document.getElementById(nextId);
  const dotsEl = document.getElementById(dotsId);
  if (!track) return;

  const cards = track.children;
  let page = 0;

  const bpKeys = Object.keys(breakpoints).map(Number).sort((a, b) => a - b);
  const perPage = () => {
    let v = breakpoints[bpKeys[0]];
    for (const k of bpKeys) if (window.innerWidth >= k) v = breakpoints[k];
    return v;
  };
  const totalPages = () => Math.max(1, Math.ceil(cards.length / perPage()));

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    for (let i = 0; i < totalPages(); i++) {
      const d = document.createElement('span');
      d.className = 'lnav-dot' + (i === page ? ' active' : '');
      d.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(d);
    }
  }

  function goTo(p) {
    page = Math.max(0, Math.min(p, totalPages() - 1));
    const pp = perPage();
    const w  = track.parentElement.offsetWidth;
    const cardW = (w - gap * (pp - 1)) / pp;
    track.style.transform = `translateX(-${page * (cardW + gap) * pp}px)`;
    if (prev) prev.disabled = page === 0;
    if (next) next.disabled = page >= totalPages() - 1;
    dotsEl?.querySelectorAll('.lnav-dot').forEach((d, i) => d.classList.toggle('active', i === page));
  }

  prev?.addEventListener('click', () => goTo(page - 1));
  next?.addEventListener('click', () => goTo(page + 1));

  // ── Swipe / drag support (mouse + touch) ──
  let startX = 0, currentX = 0, dragging = false;

  const getX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);

  const onDown = (e) => {
    dragging = true;
    startX = currentX = getX(e);
    track.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!dragging) return;
    currentX = getX(e);
    const pp = perPage();
    const w  = track.parentElement.offsetWidth;
    const cardW = (w - gap * (pp - 1)) / pp;
    const base = -(page * (cardW + gap) * pp);
    track.style.transform = `translateX(${base + (currentX - startX)}px)`;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    track.style.transition = '';
    const dx = currentX - startX;
    if (Math.abs(dx) > 50) {
      goTo(dx < 0 ? page + 1 : page - 1);
    } else {
      goTo(page); // snap back
    }
  };

  track.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  track.addEventListener('touchstart', onDown, { passive: true });
  track.addEventListener('touchmove', onMove, { passive: true });
  track.addEventListener('touchend', onUp);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { page = 0; buildDots(); goTo(0); }, 150);
  });

  buildDots();
  goTo(0);
}

/* ============================================================
   11. FORM RESERVASI LAMA → WhatsApp (fallback jika masih dipakai)
   ============================================================ */
function initReservasiForm() {
  const form = document.getElementById('reservasiForm');
  const btn  = document.getElementById('submitBtn');
  if (!form) return;

  const tgl = document.getElementById('tanggal');
  if (tgl) {
    const today = new Date().toISOString().split('T')[0];
    tgl.setAttribute('min', today);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const nama    = form.nama.value.trim();
    const wa      = form.wa.value.trim();
    const tanggal = form.tanggal.value;
    const jam     = form.jam.value;
    const layanan = form.layanan.value;
    const keluhan = form.keluhan.value.trim();

    const tglFmt = new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const msg = [
      `Halo Zanak Dental Care,`,
      ``,
      `Saya ingin melakukan reservasi kunjungan:`,
      ``,
      `Nama       : ${nama}`,
      `WhatsApp   : ${wa}`,
      `Tanggal    : ${tglFmt}`,
      `Jam        : ${jam} WIB`,
      `Layanan    : ${layanan}`,
      keluhan ? `Keluhan    : ${keluhan}` : '',
      ``,
      `Mohon dikonfirmasi ketersediaan jadwalnya. Terima kasih.`
    ].filter(Boolean).join('\n');

    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';

    setTimeout(() => {
      window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
      btn.disabled  = false;
      btn.innerHTML = '<i class="fab fa-whatsapp"></i> Kirim Reservasi via WhatsApp';
      form.reset();
      trackEvent('reservasi_submit', { layanan });
    }, 600);
  });
}

/* ============================================================
   12. LAZY IMAGE FALLBACK
   ============================================================ */
function initLazyImages() {
  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
  });
}

/* ============================================================
   13. UTILITY — debounce & throttle
   ============================================================ */
function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function throttle(fn, limit) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= limit) { last = now; fn(...args); }
  };
}

/* ============================================================
   14. GOOGLE ANALYTICS 4 — event helpers
   ============================================================ */
function trackEvent(name, params = {}) {
  if (typeof gtag === 'function') gtag('event', name, params);
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[href*="wa.me"]');
  if (!a) return;
  const section = a.closest('section')?.id || 'unknown';
  const label   = a.textContent.trim().slice(0, 50);
  trackEvent('whatsapp_click', { section, label });
});

document.addEventListener('click', e => {
  if (e.target.closest('a[href*="maps.google"]')) trackEvent('maps_click');
});

const depthMarks   = new Set();
const depthHandler = throttle(() => {
  const pct = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
  [25, 50, 75, 90].forEach(mark => {
    if (pct >= mark && !depthMarks.has(mark)) { depthMarks.add(mark); trackEvent('scroll_depth', { percent: mark }); }
  });
}, 500);

window.addEventListener('scroll', depthHandler, { passive: true });