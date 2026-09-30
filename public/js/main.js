/* ============================================================
   ZANAK DENTAL CARE — main.js (khusus index.html)
   Vanilla JS, tanpa dependensi. Semua data klinik (jam buka,
   dokter & jadwal praktik, jam kosong, konten before–after)
   diambil lewat js/apex-api.js (window.ZDC_API) dari ApexRecord.
   ============================================================ */

'use strict';

const WA_NUMBER = '6289526697902';
const DAY_ID    = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const SCHEMA_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let clinicHours = null; // { senin: '08:00-17:00' | 'Tutup', … }

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initActiveNav();
  initReveal();
  initStatusLinks();
  initFloatActions();
  initReviews();
  initClinic();
  // Dokter, jam kosong & konten baru dimuat saat pengunjung mendekati
  // bagiannya — hemat kuota API untuk yang hanya melihat bagian atas.
  whenNear('jadwal', () => { loadDoctors(); loadNextSlots(); });
  whenNear('dokter', () => { loadDoctors(); loadStories(); });
});

/* ── Util ─────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const API = () => window.ZDC_API;
const fmtRange = (h) => `${h.open}–${h.close}`;
const todayIdx = () => (new Date().getDay() + 6) % 7; // Senin = 0
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function whenNear(id, fn) {
  const el = $(id);
  if (!el || !('IntersectionObserver' in window)) return fn();
  const obs = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); fn(); }
  }, { rootMargin: '600px 0px' });
  obs.observe(el);
}

/** Hari berurutan dengan jam sama digabung: [{ from, to, hours|null }]. */
function groupDays(map) {
  const runs = [];
  API().DAY_KEY.forEach((key, i) => {
    const h = API().parseHours(map?.[key]);
    const label = h ? fmtRange(h) : null;
    const last = runs[runs.length - 1];
    if (last && last.label === label) last.to = i;
    else runs.push({ from: i, to: i, hours: h, label });
  });
  return runs;
}
const runName = (r) => (r.from === r.to ? DAY_ID[r.from] : `${DAY_ID[r.from]}–${DAY_ID[r.to]}`);

/* ── Navigasi ─────────────────────────────────────────────── */
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

function initActiveNav() {
  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${en.target.id}`));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => obs.observe(s));
}

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-visible'));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); obs.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => obs.observe(el));
}

/** Pasien yang baru reservasi di tab ini langsung dibawa ke status reservasinya. */
function initStatusLinks() {
  let token = null;
  try { token = JSON.parse(sessionStorage.getItem('zdc_reservasi') || 'null')?.token; } catch {}
  if (!token) return;
  document.querySelectorAll('.js-status-link').forEach((a) => {
    a.href = `antrian-status.html?t=${encodeURIComponent(token)}`;
  });
}

/** Tombol cepat muncul setelah hero terlewati; pesan WA menyesuaikan bagian. */
function initFloatActions() {
  const bar = $('floatActions');
  const wa = $('waFloat');
  if (!bar) return;
  const onScroll = () => bar.classList.toggle('is-visible', window.scrollY > 420);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const messages = {
    layanan: 'Halo Zanak, saya mau tanya soal layanan',
    jadwal:  'Halo Zanak, saya mau tanya jadwal klinik',
    dokter:  'Halo Zanak, saya mau konsultasi dengan dokter',
    lokasi:  'Halo Zanak, saya mau tanya arah ke klinik',
  };
  if (!wa || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const msg = messages[en.target.id] || 'Halo Zanak Dental Care, saya ingin buat janji';
      wa.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
    });
  }, { threshold: 0.3 });
  Object.keys(messages).forEach((id) => $(id) && obs.observe($(id)));
}

/** Ulasan: tampilkan sebagian dulu, sisanya lewat tombol (tanpa JS semua tampil). */
function initReviews() {
  const grid = $('testiGrid');
  const btn = $('testiToggle');
  if (!grid || !btn || !grid.querySelector('.testi--more')) return;
  const label = btn.innerHTML;
  grid.classList.add('is-collapsed');
  btn.hidden = false;
  btn.addEventListener('click', () => {
    const expand = grid.classList.contains('is-collapsed');
    grid.classList.toggle('is-collapsed', !expand);
    btn.setAttribute('aria-expanded', expand);
    btn.innerHTML = expand ? 'Tampilkan lebih sedikit <i class="fas fa-chevron-up"></i>' : label;
    if (!expand) $('testimoni')?.scrollIntoView({ behavior: 'smooth' });
  });
}

/* ── Jam buka & status ────────────────────────────────────── */
async function initClinic() {
  try {
    const clinic = await API().clinic();
    clinicHours = clinic.operationalHours || {};
  } catch (err) {
    console.error('[Klinik]', err);
    setText('statusText', 'Info jam buka tidak tersedia');
    setText('heroJamHariIni', 'Tanya via WhatsApp');
    setText('jadwalStatusChip', 'Offline');
    const list = $('jamJadwalList');
    if (list) list.innerHTML = '<div class="week-skeleton">Jadwal belum bisa dimuat. Silakan tanya via WhatsApp.</div>';
    ['footerJamDesktop', 'footerJamMobile'].forEach((id) => setText(id, 'Tanya jam buka via WhatsApp'));
    return;
  }
  renderStatus();
  setInterval(renderStatus, 60_000);
  renderWeek();
  renderFaqJam();
  updateStructuredData();
}

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }

/** Status saat ini: { open, text } — "Buka · tutup 17:00" / "Tutup · buka Senin 08:00". */
function currentStatus() {
  const now = new Date();
  const idx = todayIdx();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = API().parseHours(clinicHours[API().DAY_KEY[idx]]);

  if (today && mins >= toMin(today.open) && mins < toMin(today.close)) {
    return { open: true, text: `Buka sekarang · tutup ${today.close}` };
  }
  if (today && mins < toMin(today.open)) {
    return { open: false, text: `Tutup · buka hari ini ${today.open}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (idx + i) % 7;
    const h = API().parseHours(clinicHours[API().DAY_KEY[d]]);
    if (h) return { open: false, text: `Tutup · buka ${i === 1 ? 'besok' : DAY_ID[d]} ${h.open}` };
  }
  return { open: false, text: 'Tutup' };
}

function renderStatus() {
  if (!clinicHours) return;
  const s = currentStatus();
  setText('statusText', s.text);
  const dot = $('statusDot');
  if (dot) dot.className = `status-dot ${s.open ? 'is-open' : 'is-closed'}`;

  const chip = $('jadwalStatusChip');
  if (chip) {
    chip.className = `chip ${s.open ? 'chip--ok' : 'chip--closed'}`;
    chip.textContent = s.open ? 'Buka sekarang' : 'Sedang tutup';
  }

  const today = API().parseHours(clinicHours[API().DAY_KEY[todayIdx()]]);
  setText('heroJamHariIni', today ? `${fmtRange(today)} WIB` : 'Tutup hari ini');
  const footer = today ? `Buka ${fmtRange(today)} hari ini` : 'Tutup hari ini';
  setText('footerJamDesktop', footer);
  setText('footerJamMobile', footer);
}

function renderWeek() {
  const list = $('jamJadwalList');
  if (!list) return;
  const t = todayIdx();
  list.innerHTML = API().DAY_KEY.map((key, i) => {
    const h = API().parseHours(clinicHours[key]);
    const cls = ['week-row', i === t && 'week-row--today', !h && 'week-row--closed'].filter(Boolean).join(' ');
    return `<div class="${cls}">
        <span class="day">${DAY_ID[i]}${i === t ? '<span class="today-tag">Hari ini</span>' : ''}</span>
        <span class="hrs">${h ? fmtRange(h) : 'Tutup'}</span>
      </div>`;
  }).join('');
}

function renderFaqJam() {
  const el = $('faqJam');
  if (!el) return;
  const runs = groupDays(clinicHours);
  const open = runs.filter((r) => r.hours).map((r) => `${runName(r)} pukul ${r.label.replace(/:/g, '.')}`);
  const closed = runs.filter((r) => !r.hours).map(runName);
  if (!open.length) return;
  el.textContent = `${open.join(', ')}.${closed.length ? ` Tutup pada hari ${closed.join(' dan ')}.` : ''}` +
    ' Jadwal ini mengikuti sistem klinik dan selalu terbaru.';
}

/** Jam buka di data terstruktur (Google) ikut jadwal ApexRecord. */
function updateStructuredData() {
  const el = $('ldDentist');
  if (!el) return;
  try {
    const data = JSON.parse(el.textContent);
    data.openingHoursSpecification = groupDays(clinicHours)
      .filter((r) => r.hours)
      .map((r) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: SCHEMA_DAY.slice(r.from, r.to + 1),
        opens: r.hours.open,
        closes: r.hours.close,
      }));
    el.textContent = JSON.stringify(data);
  } catch (err) {
    console.warn('[JSON-LD]', err);
  }
}

/* ── Dokter & jadwal praktik ──────────────────────────────── */
let doctorsPromise = null;
function loadDoctors() {
  if (!doctorsPromise) {
    // Dokter tanpa jadwal sendiri mengikuti jam klinik, jadi tunggu keduanya
    // (clinic() di-memo apex-api.js: tidak menambah request).
    doctorsPromise = Promise.all([API().practitioners(), API().clinic().catch(() => null)])
      .then(([list, clinic]) => {
        if (!clinicHours && clinic) clinicHours = clinic.operationalHours || {};
        const doctors = Array.isArray(list) ? list : [];
        renderDoctorCards(doctors);
        renderDoctorSchedules(doctors);
        return doctors;
      })
      .catch((err) => { console.error('[Dokter]', err); doctorsPromise = null; return []; });
  }
  return doctorsPromise;
}

/** Jadwal dokter; null (belum diatur) berarti mengikuti jam klinik. */
const doctorHours = (d) => d.jadwalPraktik || clinicHours || {};

function dayChips(hoursMap) {
  return API().DAY_KEY.map((key, i) => {
    const h = API().parseHours(hoursMap[key]);
    return `<span class="doc-day${h ? '' : ' doc-day--off'}"><b>${DAY_SHORT[i]}</b>${h ? fmtRange(h) : 'Libur'}</span>`;
  }).join('');
}

function renderDoctorCards(doctors) {
  const listEl = $('docList');
  if (!listEl || !doctors.length) return;
  const esc = API().esc;
  const staticCard = listEl.querySelector('[data-doctor="daffa"]');

  doctors.forEach((d) => {
    // Profil drg. Daffa sudah ditulis lengkap di HTML: cukup tambahkan jadwalnya.
    if (staticCard && /daffa/i.test(d.name)) {
      const days = staticCard.querySelector('[data-doc-days]');
      if (days) days.innerHTML = dayChips(doctorHours(d));
      return;
    }
    const photo = API().fileUrl(d.photoUrl);
    const card = document.createElement('article');
    card.className = 'doc-card reveal is-visible';
    card.innerHTML = `
      <div class="doc-photo">${photo
        ? `<img src="${esc(photo)}" alt="${esc(d.name)}" loading="lazy">`
        : '<i class="fas fa-user-doctor"></i>'}</div>
      <div>
        ${d.specialization ? `<div class="doc-badges"><span class="badge">${esc(d.specialization)}</span></div>` : ''}
        <h3 class="doc-name">${esc(d.name)}</h3>
        <div class="doc-days">${dayChips(doctorHours(d))}</div>
        <a href="#antrian-online" class="btn btn-primary"><i class="fas fa-calendar-check"></i> Buat janji</a>
      </div>`;
    listEl.appendChild(card);
  });
}

/** Di panel jadwal: jadwal praktik per dokter, bila ada yang berbeda dari jam klinik. */
function renderDoctorSchedules(doctors) {
  const box = $('docSched');
  // Satu dokter tanpa jadwal sendiri = sama dengan jam klinik, tak perlu diulang.
  if (!box || !doctors.length || (doctors.length === 1 && !doctors[0].jadwalPraktik)) return;
  const esc = API().esc;
  box.innerHTML = doctors.map((d) => {
    const runs = groupDays(doctorHours(d)).filter((r) => r.hours);
    const text = runs.length ? runs.map((r) => `${runName(r)} ${r.label}`).join(' · ') : 'Jadwal belum tersedia';
    const photo = API().fileUrl(d.photoUrl);
    return `<div class="doc-sched-row">
        <span class="av">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : '<i class="fas fa-user-doctor"></i>'}</span>
        <div><b>${esc(d.name)}</b><span>${esc(text)}${d.jadwalPraktik ? '' : ' (mengikuti jam klinik)'}</span></div>
      </div>`;
  }).join('');
  box.hidden = false;
}

/* ── Jam kosong terdekat ──────────────────────────────────── */
async function loadNextSlots() {
  const dayEl = $('slotDay');
  const chips = $('slotChips');
  if (!dayEl || !chips) return;

  const doctors = await loadDoctors();
  const doctor = doctors[0] || null; // sama dengan dokter default di form reservasi
  const hoursMap = doctor ? doctorHours(doctor) : clinicHours || {};
  const MAX_CALLS = 3;
  let calls = 0;

  try {
    for (let i = 0; i < 14 && calls < MAX_CALLS; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const key = API().dayKey(date);
      if (Object.keys(hoursMap).length && !API().parseHours(hoursMap[key])) continue; // libur

      const dateStr = API().localDate(date);
      calls++;
      const res = await API().slots(dateStr, doctor?.id);
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const slots = (res?.isOpen ? res.slots || [] : [])
        .filter((t) => t.endsWith(':00'))                    // sama dengan form reservasi
        .filter((t) => i > 0 || toMin(t) > nowMin);          // jam yang sudah lewat hari ini
      if (!slots.length) continue;

      const label = i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : DAY_ID[(date.getDay() + 6) % 7];
      const tgl = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
      dayEl.innerHTML = `<b>${label}</b>, ${tgl} — ${slots.length} jam masih kosong`;
      chips.innerHTML = slots.slice(0, 8).map((t) =>
        `<button type="button" class="slot-chip" data-date="${dateStr}" data-time="${t}">${t}</button>`).join('');
      chips.querySelectorAll('.slot-chip').forEach((b) => b.addEventListener('click', () => pickSlot(b.dataset.date, b.dataset.time)));
      return;
    }
    dayEl.textContent = 'Belum ada jam kosong dalam beberapa hari ke depan.';
    chips.innerHTML = '<p class="slot-empty">Coba pilih tanggal lain di formulir, atau tanyakan via WhatsApp.</p>';
  } catch (err) {
    console.error('[Jam kosong]', err);
    dayEl.textContent = 'Jam kosong belum bisa dimuat.';
    chips.innerHTML = '<p class="slot-empty">Silakan pilih tanggal langsung di formulir reservasi.</p>';
  }
}

function pickSlot(date, time) {
  trackEvent('slot_quick_pick', { date, time });
  const section = $('antrian-online');
  if (typeof window.zdcPrefill === 'function' && section) {
    window.zdcPrefill(date, time);
  } else if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ── Hasil perawatan (konten ApexRecord) ──────────────────── */
async function loadStories() {
  const section = $('hasil');
  const grid = $('storyGrid');
  if (!section || !grid) return;
  let items = [];
  try { items = await API().contents(); } catch (err) { console.error('[Konten]', err); }
  if (!Array.isArray(items) || !items.length) return;

  const esc = API().esc;
  grid.innerHTML = items.slice(0, 6).map((c) => `
    <article class="story">
      ${c.imageUrl ? `<img src="${esc(API().fileUrl(c.imageUrl))}" alt="${esc(c.title || 'Hasil perawatan')}" loading="lazy">` : ''}
      <div class="story-body">
        <h3>${esc(c.title || 'Hasil perawatan')}</h3>
        ${c.caption ? `<p>${esc(c.caption)}</p>` : ''}
      </div>
    </article>`).join('');
  section.hidden = false;
}

/* ── Google Analytics 4 (bila gtag terpasang) ─────────────── */
function trackEvent(name, params = {}) {
  if (typeof gtag === 'function') gtag('event', name, params);
}

document.addEventListener('click', (e) => {
  const wa = e.target.closest('a[href*="wa.me"]');
  if (wa) trackEvent('whatsapp_click', { section: wa.closest('section')?.id || 'float', label: wa.textContent.trim().slice(0, 50) });
  if (e.target.closest('a[href*="maps.google"]')) trackEvent('maps_click');
});
