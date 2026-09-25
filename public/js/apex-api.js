/* ============================================================
   ZANAK DENTAL CARE — apex-api.js
   Satu-satunya tempat website ini bicara ke ApexRecord.
   Dipakai index.html (main.js + antrian.js) dan antrian-status.html.
   ============================================================ */

(function () {
  'use strict';

  const BASE_URL = 'https://api.apexrecord.my.id';

  // Publishable key dari ApexRecord → Pengaturan → API (jenis "Publishable",
  // domain: https://zanakdentalcare.web.app). Aman ditaruh di sini karena key
  // ini hanya diterima dari domain yang terdaftar. JANGAN taruh secret key.
  // Selama kosong, website memakai endpoint /public lama (tanpa key).
  const API_KEY = '';

  // Hanya dipakai endpoint /public lama; dengan key, klinik ditentukan key-nya.
  const CLINIC_ID = 1;

  const USE_V1 = API_KEY.startsWith('apx_pk_');
  const TIMEOUT_MS = 10000;

  /** fetch → data. Selalu segar (no-store) supaya perubahan di ApexRecord
   *  langsung tampil. Error membawa .status dan .code dari API. */
  async function call(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (USE_V1) headers['X-Api-Key'] = API_KEY;

    const res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) {
      const err = new Error(json?.error?.message || json?.message || 'Gagal memuat data dari server');
      err.status = res.status;
      err.code = json?.error?.code;
      throw err;
    }
    return json.data;
  }

  // Satu request per data per page view, dibagi semua script di halaman.
  const memo = {};
  const once = (key, fn) => {
    if (!memo[key]) memo[key] = fn().catch((err) => { delete memo[key]; throw err; });
    return memo[key];
  };

  // Endpoint lama mengembalikan klinik + dokter dalam satu respons.
  const legacyInfo = () => once('legacyInfo', () => call(`/public/clinic-info?clinicId=${CLINIC_ID}`));

  const api = {
    usingKey: USE_V1,

    /** Profil klinik + jam operasional { senin: '08:00-16:00' | 'Tutup', … }. */
    clinic: () => (USE_V1 ? once('clinic', () => call('/v1/clinic')) : legacyInfo()),

    /** Dokter aktif: [{ id, name, specialization, photoUrl, jadwalPraktik }].
     *  jadwalPraktik null = mengikuti jam klinik. */
    practitioners: () =>
      USE_V1
        ? once('practitioners', () => call('/v1/practitioners'))
        : legacyInfo().then((d) => d.practitioners || []),

    /** { date, isOpen, slots: ['09:00', …] } — tidak di-memo, slot berubah terus. */
    slots: (date, practitionerId) => {
      const q = new URLSearchParams({ date });
      if (practitionerId) q.set('practitionerId', practitionerId);
      if (!USE_V1) q.set('clinicId', CLINIC_ID);
      return call(USE_V1 ? `/v1/slots?${q}` : `/public/available-slots?${q}`);
    },

    /** { patientName, patientPhone, reservationDate, jamSlot, practitionerId?, notes? } */
    createReservation: (payload) =>
      USE_V1
        ? call('/v1/reservations', { method: 'POST', body: payload })
        : call('/public/reservations', {
            method: 'POST',
            body: { ...payload, clinicId: CLINIC_ID, serviceType: 'outpatient' },
          }),

    status: (token) =>
      call(
        USE_V1
          ? `/v1/reservations/${encodeURIComponent(token)}`
          : `/public/reservations/status?token=${encodeURIComponent(token)}`,
      ),

    cancel: (token) =>
      USE_V1
        ? call(`/v1/reservations/${encodeURIComponent(token)}/cancel`, { method: 'POST' })
        : call('/public/reservations/cancel', { method: 'PATCH', body: { token } }),
  };

  // ── Helper tanggal & jam (dipakai semua halaman) ──────────────
  const DAY_KEY = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

  /** 'YYYY-MM-DD' menurut jam perangkat (bukan UTC — toISOString() memberi
   *  tanggal kemarin sebelum pukul 07:00 WIB). */
  api.localDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /** Kunci hari ('senin'…'minggu') untuk Date atau 'YYYY-MM-DD'. */
  api.dayKey = (date = new Date()) => {
    const d = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
    return DAY_KEY[(d.getDay() + 6) % 7];
  };
  api.DAY_KEY = DAY_KEY;

  /** '08:00-16:00' → { open, close }; 'Tutup'/kosong → null. */
  api.parseHours = (raw) => {
    if (!raw || /^tutup$/i.test(raw.trim())) return null;
    const [open, close] = raw.split('-').map((s) => s.trim());
    return open && close ? { open, close } : null;
  };

  /** Escape teks sebelum dimasukkan ke innerHTML. */
  api.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  window.ZDC_API = api;
})();
