// ============================================================
// js/antrian.js — Sistem Reservasi Online Zanak Dental Care
// v4.1 — dibungkus IIFE agar tidak bentrok scope dgn main.js
// ============================================================

(function () {
  'use strict';

  // Semua panggilan ke ApexRecord lewat js/apex-api.js (window.ZDC_API).
  const API = window.ZDC_API;
  const WA_NUMBER  = '089526697902'; // nomor WA resmi klinik (dikonfirmasi)
  const STATUS_URL = 'antrian-status.html';
  const esc = API.esc;

  // ── State
  let selectedDate    = null;
  let selectedSlot    = null;
  let clinicHours     = null;
  let isSubmitting    = false;
  let doctors         = [];   // dokter aktif dari ApexRecord
  let practitionerId  = null; // dokter terpilih (otomatis bila hanya satu)
  let doctorsReady    = null; // Promise, dimuat saat bagian reservasi mendekati layar

  async function initAntrian() {
    injectStyles();
    removeOldReservasi();
    renderAntrianSection();
    loadClinicInfo();
    loadDoctorsWhenNear();
  }

  // Data dokter baru diambil ketika pengunjung mendekati form reservasi
  // (atau langsung memilih tanggal) — pengunjung yang hanya membaca halaman
  // tidak memakan kuota API.
  function loadDoctorsWhenNear() {
    const section = document.getElementById('antrian-online');
    if (!section || !('IntersectionObserver' in window)) return ensureDoctors();
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); ensureDoctors(); }
    }, { rootMargin: '400px 0px' });
    obs.observe(section);
  }

  function ensureDoctors() {
    if (!doctorsReady) {
      doctorsReady = API.practitioners()
        .then((list) => {
          doctors = Array.isArray(list) ? list : [];
          if (doctors.length) practitionerId = doctors[0].id;
          renderDoctorPicker();
        })
        .catch((err) => {
          console.error('[Dokter]', err);
          doctorsReady = null; // coba lagi saat tanggal dipilih
        });
    }
    return doctorsReady;
  }

  function renderDoctorPicker() {
    const wrap = document.getElementById('zdcDokterWrap');
    const sel  = document.getElementById('zdcDokter');
    if (!wrap || !sel) return;
    // Satu dokter: tidak perlu memilih.
    wrap.classList.toggle('zdc-hidden', doctors.length < 2);
    sel.innerHTML = doctors.map((d) =>
      `<option value="${d.id}">${esc(d.name)}${d.specialization ? ` — ${esc(d.specialization)}` : ''}</option>`
    ).join('');
    if (practitionerId) sel.value = String(practitionerId);
  }

  function zdcOnDoctorChange(id) {
    practitionerId = Number(id) || null;
    // Jadwal tiap dokter bisa berbeda: cek ulang tanggal yang sudah dipilih.
    if (selectedDate) zdcOnDateChange(selectedDate);
  }

  function removeOldReservasi() {
    document.getElementById('reservasi')?.remove();
  }

  function renderAntrianSection() {
    const lokasiSec = document.getElementById('lokasi');
    if (!lokasiSec) return;

    const today = API.localDate();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const maxStr = API.localDate(maxDate);

    const wrap = document.createElement('section');
    wrap.className = 'section';
    wrap.id = 'antrian-online';
    wrap.innerHTML = `
      <div class="container">

        <div class="zdc-head" data-aos="fade-up">
          <div class="zdc-head-left">
            <span class="section-tag">Reservasi Online</span>
            <h2 style="margin-top:6px">Buat Janji Temu Sekarang</h2>
          </div>
          <div class="zdc-head-meta" id="zdcJamWrap">
            <i class="fas fa-clock"></i>
            <span id="zdcJamOperasional">Memuat jam operasional…</span>
          </div>
        </div>

        <div class="zdc-card" data-aos="fade-up" data-aos-delay="80">

          <div class="zdc-tabs" role="tablist">
            <button class="zdc-tab zdc-tab--active" data-tab="online" role="tab" aria-selected="true" onclick="zdcSwitchTab('online')">
              <i class="fas fa-calendar-check"></i> Reservasi Online
            </button>
            <button class="zdc-tab" data-tab="wa" role="tab" aria-selected="false" onclick="zdcSwitchTab('wa')">
              <i class="fab fa-whatsapp"></i> Reservasi via WhatsApp
            </button>
          </div>

          <!-- ═══ TAB ONLINE ═══ -->
          <div id="zdcTabOnline" class="zdc-pane">

            <div class="zdc-step zdc-step--active" id="zdcStep1">
              <div class="zdc-step-label"><span class="zdc-step-num">1</span> Pilih Tanggal</div>
              <div class="form-group zdc-hidden" id="zdcDokterWrap">
                <label for="zdcDokter">Dokter</label>
                <select id="zdcDokter" onchange="zdcOnDoctorChange(this.value)"></select>
              </div>
              <input type="date" id="zdcTanggalInput" class="zdc-date-input"
                     min="${today}" max="${maxStr}" onchange="zdcOnDateChange(this.value)">
              <p id="zdcTanggalWarning" class="zdc-warning zdc-hidden">
                <i class="fas fa-exclamation-circle"></i> Klinik tutup pada tanggal ini, silakan pilih tanggal lain.
              </p>
            </div>

            <div class="zdc-step zdc-hidden" id="zdcStepSlot">
              <div class="zdc-step-label"><span class="zdc-step-num">2</span> Pilih Jam</div>
              <div id="zdcSlotState" class="zdc-state zdc-hidden">
                <div class="zdc-spinner"></div><p>Memuat jam tersedia…</p>
              </div>
              <div id="zdcSlotGrid" class="zdc-slot-grid"></div>
            </div>

            <div class="zdc-step zdc-hidden" id="zdcStepData">
              <div class="zdc-step-label"><span class="zdc-step-num">3</span> Data Diri &amp; Keluhan</div>
              <div class="form-row">
                <div class="form-group">
                  <label for="zdcNama">Nama Lengkap <span class="req">*</span></label>
                  <input type="text" id="zdcNama" placeholder="Nama sesuai KTP" autocomplete="name">
                </div>
                <div class="form-group">
                  <label for="zdcHP">No. WhatsApp <span class="req">*</span></label>
                  <input type="tel" id="zdcHP" placeholder="08xxxxxxxxxx" autocomplete="tel">
                </div>
              </div>
              <div class="form-group">
                <label for="zdcLayanan">Layanan <span class="req">*</span></label>
                <select id="zdcLayanan">
                  <option value="" disabled selected>Pilih layanan</option>
                  <option>Konsultasi &amp; Pemeriksaan Awal</option>
                  <option>Scaling (Pembersihan Karang Gigi)</option>
                  <option>Tambal Gigi</option>
                  <option>Ekstraksi / Cabut Gigi</option>
                  <option>Perawatan Saluran Akar (PSA)</option>
                  <option>Odontektomi (Gigi Bungsu)</option>
                  <option>Kawat Gigi / Behel</option>
                  <option>Kontrol Kawat Gigi</option>
                  <option>Gigi Tiruan</option>
                  <option>Lainnya</option>
                </select>
              </div>
              <div class="form-group">
                <label for="zdcKeluhan">Keluhan <span class="opt">(opsional)</span></label>
                <textarea id="zdcKeluhan" rows="2" placeholder="Ceritakan keluhan gigi Anda…"></textarea>
              </div>
            </div>

            <div id="zdcSummary" class="zdc-summary zdc-hidden">
              <div class="zdc-summary-title"><i class="fas fa-clipboard-check"></i> Ringkasan Janji Temu</div>
              <div class="zdc-summary-body">
                <div class="zdc-sum-row"><span class="zdc-sum-lbl"><i class="fas fa-calendar-day"></i> Tanggal</span><span id="zdcSumTanggal" class="zdc-sum-val">—</span></div>
                <div class="zdc-sum-row"><span class="zdc-sum-lbl"><i class="fas fa-clock"></i> Jam</span><span id="zdcSumJam" class="zdc-sum-val">—</span></div>
              </div>
            </div>

            <button id="zdcBtnDaftar" class="btn btn-primary btn-full btn-lg zdc-hidden" onclick="zdcSubmitAntrian()">
              <i class="fas fa-calendar-check"></i> Buat Janji Temu
            </button>
            <p class="form-note zdc-hidden" id="zdcFormNote">
              Reservasi Anda berstatus <strong>menunggu konfirmasi</strong> dari klinik. Anda akan mendapat link untuk memantau statusnya.
            </p>
          </div>

          <!-- ═══ TAB WA ═══ -->
          <div id="zdcTabWa" class="zdc-pane zdc-hidden">
            <div class="zdc-wa-wrap">
              <div class="zdc-wa-info">
                <div class="zdc-wa-icon-wrap"><i class="fab fa-whatsapp"></i></div>
                <h3>Reservasi via WhatsApp</h3>
                <p>Pesan otomatis terkirim — dibalas dalam waktu singkat.</p>
                <div class="zdc-wa-benefits">
                  <div class="res-b"><i class="fas fa-check-circle"></i><span>Konfirmasi jadwal langsung</span></div>
                  <div class="res-b"><i class="fas fa-check-circle"></i><span>Tidak perlu antre di tempat</span></div>
                  <div class="res-b"><i class="fas fa-check-circle"></i><span>Reminder H-1 via WhatsApp</span></div>
                </div>
              </div>
              <div class="zdc-wa-form">
                <div class="form-group">
                  <label for="waNama">Nama Lengkap <span class="req">*</span></label>
                  <input type="text" id="waNama" placeholder="Nama sesuai KTP" autocomplete="name">
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="waTanggal">Tanggal <span class="req">*</span></label>
                    <input type="date" id="waTanggal" min="${today}" max="${maxStr}" onchange="zdcOnWaDateChange(this.value)">
                  </div>
                  <div class="form-group">
                    <label for="waJam">Jam <span class="req">*</span></label>
                    <select id="waJam" disabled>
                      <option value="" selected>Pilih tanggal dahulu</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label for="waLayanan">Layanan <span class="req">*</span></label>
                  <select id="waLayanan">
                    <option value="" disabled selected>Pilih layanan</option>
                    <option>Konsultasi &amp; Pemeriksaan Awal</option>
                    <option>Scaling (Pembersihan Karang Gigi)</option>
                    <option>Tambal Gigi</option>
                    <option>Ekstraksi / Cabut Gigi</option>
                    <option>Perawatan Saluran Akar (PSA)</option>
                    <option>Odontektomi (Gigi Bungsu)</option>
                    <option>Kawat Gigi / Behel</option>
                    <option>Kontrol Kawat Gigi</option>
                    <option>Gigi Tiruan</option>
                    <option>Lainnya</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="waKeluhan">Keluhan <span class="opt">(opsional)</span></label>
                  <textarea id="waKeluhan" rows="2" placeholder="Ceritakan keluhan atau catatan untuk dokter…"></textarea>
                </div>
                <button class="btn btn-primary btn-full btn-lg zdc-btn-wa" onclick="zdcSubmitWA()">
                  <i class="fab fa-whatsapp"></i> Kirim via WhatsApp
                </button>
                <p class="form-note">Data dikirim ke WhatsApp klinik — dibalas dalam waktu singkat.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    lokasiSec.before(wrap);
  }

  async function loadClinicInfo() {
    const el = document.getElementById('zdcJamOperasional');
    try {
      const clinic = await API.clinic(); // dibagi dengan main.js: satu request
      clinicHours = clinic.operationalHours || {};
      const today = API.parseHours(clinicHours[API.dayKey()]);
      if (el) el.textContent = today ? `Buka ${today.open} – ${today.close} hari ini` : 'Tutup hari ini';
    } catch (err) {
      console.error('[ClinicInfo]', err);
      if (el) el.textContent = 'Info jam tidak tersedia';
    }
  }

  /** Jam praktik pada tanggal itu: jadwal dokter terpilih bila diatur di
   *  ApexRecord, selain itu jam klinik (sama seperti perhitungan slot di server).
   *  undefined = data belum termuat, null = tutup. */
  function getHoursForDate(dateStr) {
    const day = API.dayKey(dateStr);
    const doctor = doctors.find((d) => d.id === practitionerId);
    if (doctor?.jadwalPraktik) return API.parseHours(doctor.jadwalPraktik[day]);
    if (!clinicHours) return undefined;
    return API.parseHours(clinicHours[day]);
  }

  async function zdcOnDateChange(dateStr) {
    await ensureDoctors();
    if (!dateStr) return;
    selectedDate = dateStr;
    selectedSlot = null;
    zdcToggleDataStep(false);
    zdcUpdateSummary();
    // Ganti tanggal berarti slot & data harus dipilih ulang dari awal.
    document.getElementById('zdcStepData')?.classList.remove('zdc-step--active', 'zdc-step--done');

    const hours = getHoursForDate(dateStr);
    const warning = document.getElementById('zdcTanggalWarning');
    const stepSlot = document.getElementById('zdcStepSlot');
    const step1 = document.getElementById('zdcStep1');
    stepSlot?.classList.remove('zdc-step--done');

    if (hours === null) {
      warning?.classList.remove('zdc-hidden');
      stepSlot?.classList.add('zdc-hidden');
      step1?.classList.remove('zdc-step--done');
      step1?.classList.add('zdc-step--active');
      return;
    }
    warning?.classList.add('zdc-hidden');
    stepSlot?.classList.remove('zdc-hidden');
    step1?.classList.replace('zdc-step--active', 'zdc-step--done');
    stepSlot?.classList.add('zdc-step--active');
    loadSlots(dateStr);
    zdcScrollToStep(stepSlot);
  }

  function zdcScrollToStep(el) {
    if (!el) return;
    // Beri waktu render sebelum scroll supaya posisinya akurat.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

 async function loadSlots(dateStr) {
  const grid  = document.getElementById('zdcSlotGrid');
  const state = document.getElementById('zdcSlotState');
  state?.classList.remove('zdc-hidden');
  if (grid) grid.innerHTML = '';

  try {
    const result = await API.slots(dateStr, practitionerId);
    // Tanggal sudah diganti selagi menunggu: abaikan hasil lama.
    if (dateStr !== selectedDate) return;

    state?.classList.add('zdc-hidden');

    // ✅ Handle format baru: { isOpen, slots: ["10:00", ...] }
    if (!result.isOpen) {
      if (grid) grid.innerHTML = '<p class="zdc-empty-slot">Klinik tutup pada tanggal ini.</p>';
      return;
    }

    // ✅ Convert array string → array object yang diexpect zdcRenderSlots
    // ✅ Convert array string → ambil hanya jam genap (xx:00)
    const slots = (result.slots || [])
      .filter(time => time.endsWith(':00'))  // ← tambah ini
      .map(time => ({ time, available: true }));
    zdcRenderSlots(slots);

  } catch (err) {
    console.error('[Slots]', err);
    state?.classList.add('zdc-hidden');
    if (grid) grid.innerHTML = '<p class="zdc-empty-slot">Gagal memuat jam. Coba pilih ulang tanggal.</p>';
  }
}

  function zdcRenderSlots(slots) {
    const c = document.getElementById('zdcSlotGrid');
    if (!c) return;
    if (!slots.length) {
      c.innerHTML = '<p class="zdc-empty-slot">Tidak ada slot untuk tanggal ini.</p>';
      return;
    }
    c.innerHTML = slots.map(s => {
      const id = `zdcSlot_${s.time.replace(':','')}`;
      return `
        <button class="zdc-slot${s.available ? '' : ' zdc-slot--taken'}" id="${id}"
                ${s.available ? `onclick="zdcSelectSlot('${s.time}')"` : 'disabled'}>
          ${s.available ? `<i class="fas fa-circle zdc-slot-dot"></i>${s.time}` : `<i class="fas fa-lock"></i>${s.time}`}
        </button>`;
    }).join('');
  }

  function zdcSelectSlot(time) {
    selectedSlot = time;
    document.querySelectorAll('.zdc-slot:not(.zdc-slot--taken)').forEach(el =>
      el.classList.toggle('zdc-slot--active', el.id === `zdcSlot_${time.replace(':','')}`)
    );
    zdcToggleDataStep(true);
    zdcUpdateSummary();

    const stepSlot = document.getElementById('zdcStepSlot');
    const stepData = document.getElementById('zdcStepData');
    stepSlot?.classList.replace('zdc-step--active', 'zdc-step--done');
    stepData?.classList.add('zdc-step--active');
    zdcScrollToStep(stepData);
  }

  function zdcToggleDataStep(show) {
    ['zdcStepData','zdcBtnDaftar','zdcFormNote'].forEach(id =>
      document.getElementById(id)?.classList.toggle('zdc-hidden', !show)
    );
  }

  function zdcUpdateSummary() {
    const s = document.getElementById('zdcSummary');
    if (!s) return;
    const show = !!(selectedDate && selectedSlot);
    s.classList.toggle('zdc-hidden', !show);
    if (show) {
      document.getElementById('zdcSumTanggal').textContent = zdcFormatTanggal(selectedDate);
      document.getElementById('zdcSumJam').textContent = selectedSlot;
    }
  }

  async function zdcSubmitAntrian() {
    if (isSubmitting) return;

    const nama    = document.getElementById('zdcNama')?.value.trim()    ?? '';
    const hp      = document.getElementById('zdcHP')?.value.trim()      ?? '';
    const layanan = document.getElementById('zdcLayanan')?.value        ?? '';
    const keluhan = document.getElementById('zdcKeluhan')?.value.trim() ?? '';
    const btn     = document.getElementById('zdcBtnDaftar');

    if (!nama)          return zdcToast('Nama wajib diisi', 'error');
    if (!hp)            return zdcToast('Nomor WhatsApp wajib diisi', 'error');
    if (!layanan)       return zdcToast('Pilih layanan terlebih dahulu', 'error');
    if (!selectedDate)  return zdcToast('Pilih tanggal terlebih dahulu', 'error');
    if (!selectedSlot)  return zdcToast('Pilih jam terlebih dahulu', 'error');

    isSubmitting = true;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses…'; }

    const notes = keluhan ? `Layanan: ${layanan}. Keluhan: ${keluhan}` : `Layanan: ${layanan}`;

    try {
      const reservation = await API.createReservation({
        patientName:     nama,
        patientPhone:    hp,
        reservationDate: selectedDate,
        jamSlot:         selectedSlot,
        notes,
        ...(practitionerId ? { practitionerId } : {}),
      });

      try {
        sessionStorage.setItem('zdc_reservasi', JSON.stringify({ ...reservation, layanan, keluhan }));
      } catch {}

      zdcShowSuccessModal(reservation, layanan);
    } catch (err) {
      console.error('[Reservasi] submit:', err);
      if (!err.status) {
        zdcToast('Gagal terhubung ke server. Coba lagi.', 'error');
      } else if (err.status === 409) {
        // Jam yang barusan diambil orang lain — segarkan slot & minta pilih ulang.
        zdcToast('Jam yang dipilih baru saja dipesan orang lain, silakan pilih jam lain.', 'error');
        selectedSlot = null;
        zdcToggleDataStep(false);
        zdcUpdateSummary();
        loadSlots(selectedDate);
      } else {
        zdcToast(err.message || 'Gagal membuat reservasi. Coba lagi.', 'error');
      }
    } finally {
      isSubmitting = false;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> Buat Janji Temu'; }
    }
  }

  function zdcShowSuccessModal(reservation, layanan) {
    const link   = `${STATUS_URL}?t=${encodeURIComponent(reservation.token)}`;
    const tglFmt = zdcFormatTanggal(reservation.reservationDate.split('T')[0]);
    const waMsg  = encodeURIComponent(
      `Halo Zanak! Saya sudah membuat reservasi online.\n` +
      `Nama: ${reservation.patientName}\nTanggal: ${tglFmt}\nJam: ${reservation.jamSlot}\n` +
      `Layanan: ${layanan}\nToken: ${reservation.token}`
    );

    const ov = document.createElement('div');
    ov.id = 'zdcModal';
    ov.className = 'zdc-modal-overlay';
    ov.innerHTML = `
      <div class="zdc-modal" role="dialog" aria-modal="true">
        <div class="zdc-modal-check"><i class="fas fa-check"></i></div>
        <p class="zdc-modal-eyebrow">Reservasi Berhasil Dibuat</p>
        <p class="zdc-modal-label">Status: Menunggu Konfirmasi Klinik</p>
        <div class="zdc-modal-info" style="margin-top:16px">
          <div class="zdc-modal-info-row"><i class="fas fa-user"></i><span>${esc(reservation.patientName)}</span></div>
          <div class="zdc-modal-info-row"><i class="fas fa-calendar-day"></i><span>${tglFmt}</span></div>
          <div class="zdc-modal-info-row"><i class="fas fa-clock"></i><span>${esc(reservation.jamSlot)}</span></div>
          <div class="zdc-modal-info-row"><i class="fas fa-tooth"></i><span>${esc(layanan)}</span></div>
          <div class="zdc-modal-info-row zdc-modal-token"><i class="fas fa-key"></i><span>Token: <strong>${esc(reservation.token)}</strong></span></div>
        </div>
        <div class="zdc-modal-actions">
          <a href="${link}" class="btn btn-primary btn-full" style="text-decoration:none;text-align:center">
            <i class="fas fa-eye"></i> Pantau Status Reservasi
          </a>
          <a href="https://wa.me/${WA_NUMBER}?text=${waMsg}" class="btn btn-full zdc-btn-wa" target="_blank" style="text-decoration:none;text-align:center">
            <i class="fab fa-whatsapp"></i> Konfirmasi via WhatsApp
          </a>
          <button class="btn btn-outline btn-full" onclick="zdcCloseModal()">Tutup</button>
        </div>
      </div>`;

    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('zdc-modal-overlay--show'));
    ov.addEventListener('click', e => { if (e.target === ov) zdcCloseModal(); });
  }

  function zdcCloseModal() {
    const m = document.getElementById('zdcModal');
    if (!m) return;
    m.classList.remove('zdc-modal-overlay--show');
    setTimeout(() => m.remove(), 250);
  }

  function zdcOnWaDateChange(dateStr) {
    const sel = document.getElementById('waJam');
    if (!sel) return;

    const hours = getHoursForDate(dateStr);

    if (hours === null) {
      sel.innerHTML = '<option value="" selected>Klinik tutup pada tanggal ini</option>';
      sel.disabled = true;
      return;
    }
    if (hours === undefined) {
      sel.innerHTML = '<option value="" selected>Info jam belum termuat, coba lagi</option>';
      sel.disabled = true;
      return;
    }

    const isToday = dateStr === API.localDate();
    const options = zdcGenerateSlotOptions(hours.open, hours.close, isToday);
    if (!options) {
      sel.innerHTML = '<option value="" selected>Jam operasional hari ini sudah lewat</option>';
      sel.disabled = true;
      return;
    }
    sel.innerHTML = `<option value="" disabled selected>Pilih jam</option>${options}`;
    sel.disabled = false;
  }

  function zdcGenerateSlotOptions(open, close, isToday) {
    const [oh, om] = open.split(':').map(Number);
    const [ch, cm] = close.split(':').map(Number);
    const startMin = oh * 60 + om;
    const endMin   = ch * 60 + cm;

    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

    const opts = [];
    for (let t = startMin; t < endMin; t += 60) {  // ← 30 → 60
      if (t <= nowMin) continue; // jangan tawarkan jam yang sudah lewat hari ini
      const h1 = String(Math.floor(t / 60)).padStart(2, '0');
      const m1 = String(t % 60).padStart(2, '0');
      opts.push(`<option>${h1}:${m1}</option>`);    // ← format bersih tanpa range
    }
    return opts.join('');
  }

  function zdcSubmitWA() {
    const nama    = document.getElementById('waNama')?.value.trim();
    const tanggal = document.getElementById('waTanggal')?.value;
    const jam     = document.getElementById('waJam')?.value;
    const layanan = document.getElementById('waLayanan')?.value;
    const keluhan = document.getElementById('waKeluhan')?.value.trim();

    if (!nama || !tanggal || !jam || !layanan) return zdcToast('Semua field wajib diisi', 'error');

    const tglFmt = zdcFormatTanggal(tanggal);
    const msg = [
      `Halo Zanak Dental Care, saya ingin reservasi:`, ``,
      `👤 Nama    : ${nama}`,
      `📅 Tanggal : ${tglFmt}`,
      `⏰ Jam     : ${jam}`,
      `🦷 Layanan : ${layanan}`,
      keluhan ? `📝 Catatan : ${keluhan}` : '',
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function zdcSwitchTab(tab) {
    document.getElementById('zdcTabOnline').classList.toggle('zdc-hidden', tab !== 'online');
    document.getElementById('zdcTabWa').classList.toggle('zdc-hidden', tab !== 'wa');
    document.querySelectorAll('.zdc-tab').forEach(el => {
      const active = el.dataset.tab === tab;
      el.classList.toggle('zdc-tab--active', active);
      el.setAttribute('aria-selected', active);
    });
  }

  function zdcToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `zdc-toast zdc-toast--${type}`;
    t.innerHTML = `<i class="fas fa-${type==='error'?'exclamation-circle':'check-circle'}"></i> ${esc(msg)}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('zdc-toast--show'));
    setTimeout(() => { t.classList.remove('zdc-toast--show'); setTimeout(() => t.remove(), 300); }, 3500);
  }

  function zdcFormatTanggal(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

function injectStyles() {
    if (document.getElementById('zdcStyles')) return;
    const s = document.createElement('style');
    s.id = 'zdcStyles';
    s.textContent = `
      .zdc-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
      .zdc-head h2 { margin:0; }
      .zdc-head-meta { display:flex; align-items:center; gap:8px; background:#D6E4F7; color:#1E3A6E; font-family:'Poppins',sans-serif; font-size:12px; font-weight:600; padding:7px 14px; border-radius:99px; white-space:nowrap; }
      .zdc-card { background:#fff; border-radius:20px; box-shadow:0 4px 24px rgba(0,0,0,.07),0 1px 4px rgba(0,0,0,.04); overflow:hidden; }
      .zdc-tabs { display:flex; border-bottom:1.5px solid #E2E8F0; background:#F8FAFC; }
      .zdc-tab { flex:1; padding:15px 12px; border:none; background:transparent; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; color:#64748B; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:3px solid transparent; transition:all .18s; position:relative; bottom:-1.5px; }
      .zdc-tab:hover { color:#1E3A6E; background:#EEF4FB; }
      .zdc-tab--active { color:#1E3A6E; border-bottom-color:#1E3A6E; background:#fff; }
      .zdc-pane { padding:28px 32px; }
      @media (max-width:640px){ .zdc-pane{ padding:20px 16px; } }
      .zdc-step { margin-bottom:24px; padding-left:14px; border-left:3px solid #E2E8F0; transition:border-color .2s; }
      .zdc-step--active { border-left-color:#1E3A6E; }
      .zdc-step--done { border-left-color:#22C55E; }
      .zdc-step-label { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:700; color:#0F172A; margin-bottom:14px; }
      .zdc-step-num { width:24px; height:24px; border-radius:50%; background:#94A3B8; color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background-color .2s; }
      .zdc-step--active .zdc-step-num { background:#1E3A6E; box-shadow:0 0 0 4px rgba(30,58,110,.14); }
      .zdc-step--done .zdc-step-num { background:#22C55E; font-size:0; }
      .zdc-step--done .zdc-step-num::before { content:'\\2713'; font-size:12px; }
      .zdc-date-input { width:100%; max-width:280px; padding:12px 14px; border-radius:10px; border:1.5px solid #E2E8F0; font-family:'Poppins',sans-serif; font-size:14px; color:#0F172A; outline:none; transition:border-color .15s; }
      .zdc-date-input:focus { border-color:#1E3A6E; }
      .zdc-warning { margin-top:10px; font-size:12px; color:#EF4444; display:flex; align-items:center; gap:6px; }
      .zdc-slot-grid { display:flex; flex-wrap:wrap; gap:8px; }
      .zdc-slot { padding:8px 13px; border-radius:9px; border:1.5px solid #E2E8F0; background:#F8FAFC; font-family:'Poppins',sans-serif; font-size:12px; font-weight:600; color:#475569; cursor:pointer; transition:all .12s; display:flex; align-items:center; gap:5px; }
      .zdc-slot-dot { font-size:5px; color:#1E3A6E; }
      .zdc-slot:hover:not(:disabled) { border-color:#1E3A6E; background:#EEF4FB; color:#142850; }
      .zdc-slot--active { border-color:#1E3A6E; background:#1E3A6E; color:#fff !important; }
      .zdc-slot--active .zdc-slot-dot { color:#fff; }
      .zdc-slot--taken { color:#CBD5E1; cursor:not-allowed; background:#F1F5F9; border-color:#F1F5F9; }
      .zdc-empty-slot { font-size:13px; color:#94A3B8; }
      .zdc-summary { background:linear-gradient(135deg,#EEF4FB,#D6E4F7); border-radius:12px; padding:14px 18px; margin-bottom:18px; border:1px solid #A8C4E8; }
      .zdc-summary-title { font-size:12px; font-weight:700; color:#142850; display:flex; align-items:center; gap:7px; margin-bottom:10px; }
      .zdc-summary-body { display:flex; flex-direction:column; gap:6px; }
      .zdc-sum-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .zdc-sum-lbl { font-size:12px; color:#1E3A6E; display:flex; align-items:center; gap:5px; }
      .zdc-sum-val { font-size:13px; font-weight:600; color:#0F172A; text-align:right; }
      .zdc-state { display:flex; flex-direction:column; align-items:center; gap:12px; padding:24px 20px; text-align:center; }
      .zdc-state p { font-size:13px; color:#64748B; margin:0; }
      .zdc-spinner { width:30px; height:30px; border:3px solid #D6E4F7; border-top-color:#1E3A6E; border-radius:50%; animation:zdcSpin .7s linear infinite; }
      @keyframes zdcSpin { to { transform:rotate(360deg); } }
      .zdc-btn-wa { background:#25D366 !important; color:#fff !important; padding:14px; border-radius:10px; font-family:'Poppins',sans-serif; font-size:14px; font-weight:600; border:none; cursor:pointer; transition:opacity .15s; display:flex; align-items:center; justify-content:center; gap:8px; }
      .zdc-btn-wa:hover { opacity:.9; }
      .zdc-modal-overlay { position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(6px); opacity:0; transition:opacity .25s; }
      .zdc-modal-overlay--show { opacity:1; }
      .zdc-modal { background:#fff; border-radius:24px; padding:32px 26px 26px; width:100%; max-width:400px; text-align:center; box-shadow:0 32px 80px rgba(0,0,0,.22); transform:translateY(16px); transition:transform .25s; }
      .zdc-modal-overlay--show .zdc-modal { transform:none; }
      .zdc-modal-check { width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg,#1E3A6E,#3B5FA0); color:#fff; font-size:26px; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; box-shadow:0 8px 24px rgba(30,58,110,.35); }
      .zdc-modal-eyebrow { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1E3A6E; margin:0; }
      .zdc-modal-label { font-size:13px; color:#64748B; margin:5px 0 0; font-weight:600; }
      .zdc-modal-info { background:#F8FAFC; border-radius:12px; padding:12px 16px; display:flex; flex-direction:column; gap:7px; margin-bottom:18px; text-align:left; }
      .zdc-modal-info-row { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:#475569; }
      .zdc-modal-info-row i { width:16px; text-align:center; color:#1E3A6E; flex-shrink:0; margin-top:2px; }
      .zdc-modal-token { color:#94A3B8; font-size:12px; }
      .zdc-modal-actions { display:flex; flex-direction:column; gap:8px; }
      .zdc-wa-wrap { display:flex; gap:32px; align-items:flex-start; flex-wrap:wrap; }
      .zdc-wa-info { flex:1; min-width:190px; text-align:center; padding:20px 16px; background:#EEF4FB; border-radius:16px; border:1.5px solid #A8C4E8; }
      .zdc-wa-icon-wrap { width:60px; height:60px; border-radius:50%; background:#25D366; color:#fff; font-size:26px; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; box-shadow:0 8px 24px rgba(37,211,102,.3); }
      .zdc-wa-info h3 { font-size:16px; font-weight:700; color:#0F172A; margin:0 0 6px; }
      .zdc-wa-info > p { font-size:12px; color:#475569; }
      .zdc-wa-benefits { margin-top:14px; display:flex; flex-direction:column; gap:7px; text-align:left; }
      .zdc-wa-benefits .res-b { font-size:13px; color:#0F172A; }
      .zdc-wa-benefits .res-b i { color:#1E3A6E; }
      .zdc-wa-form { flex:2; min-width:240px; display:flex; flex-direction:column; gap:14px; }
      .zdc-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(16px); padding:12px 20px; border-radius:10px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:600; display:flex; align-items:center; gap:9px; opacity:0; transition:all .3s cubic-bezier(.34,1.56,.64,1); z-index:10000; white-space:nowrap; box-shadow:0 8px 28px rgba(0,0,0,.16); }
      .zdc-toast--show { opacity:1; transform:translateX(-50%) translateY(0); }
      .zdc-toast--error { background:#EF4444; color:#fff; }
      .zdc-toast--info { background:#1E3A6E; color:#fff; }
      .zdc-hidden { display:none !important; }
    `;
    document.head.appendChild(s);
  }

  // Expose ke window HANYA fungsi yang dipanggil dari onclick="" di HTML
  window.zdcOnDateChange   = zdcOnDateChange;
  window.zdcOnDoctorChange = zdcOnDoctorChange;
  window.zdcSelectSlot     = zdcSelectSlot;
  window.zdcSubmitAntrian  = zdcSubmitAntrian;
  window.zdcOnWaDateChange = zdcOnWaDateChange;
  window.zdcSubmitWA       = zdcSubmitWA;
  window.zdcSwitchTab      = zdcSwitchTab;
  window.zdcCloseModal     = zdcCloseModal;

  document.addEventListener('DOMContentLoaded', initAntrian);
})();
