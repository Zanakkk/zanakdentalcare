/* ============================================================
   ZANAK DENTAL CARE — apex-api.js
   Satu-satunya tempat website ini bicara ke ApexRecord.
   Dipakai index.html (main.js + antrian.js) dan antrian-status.html.
   ============================================================ */

(function () {
  'use strict';

  // Publishable key dari ApexRecord → Pengaturan → API (jenis "Publishable",
  // domain: https://zanakdentalcare.web.app). Aman ditaruh di sini karena key
  // ini hanya diterima dari domain yang terdaftar. JANGAN taruh secret key.
  // apiKey kosong = pakai endpoint /public lama (tanpa key).
  const ENVIRONMENTS = {
    production: { baseUrl: 'https://api.apexrecord.my.id', apiKey: '' },
    // Uji coba: buka website dengan ?apex=staging (hanya tab itu; pengunjung
    // lain tetap di production). Keluar dengan ?apex=production.
    staging: { baseUrl: 'https://staging.apexrecord.my.id', apiKey: 'apx_pk_1FbnIoGgXTwAoElOQ-m95u0-n6Yy1ChC' },
  };

  const ENV_STORAGE_KEY = 'zdc_apex_env';
  function pickEnvironment() {
    const wanted = new URLSearchParams(location.search).get('apex');
    try {
      if (wanted === 'staging') sessionStorage.setItem(ENV_STORAGE_KEY, 'staging');
      if (wanted === 'production' || wanted === 'prod') sessionStorage.removeItem(ENV_STORAGE_KEY);
      return sessionStorage.getItem(ENV_STORAGE_KEY) === 'staging' ? 'staging' : 'production';
    } catch {
      return wanted === 'staging' ? 'staging' : 'production';
    }
  }
  const ENV_NAME = pickEnvironment();
  const { baseUrl: BASE_URL, apiKey: API_KEY } = ENVIRONMENTS[ENV_NAME];
  // Endpoint /public lama hanya ada di API production.
  const LEGACY_BASE_URL = ENVIRONMENTS.production.baseUrl;

  // Hanya dipakai endpoint /public lama; dengan key, klinik ditentukan key-nya.
  const CLINIC_ID = 1;

  let useV1 = API_KEY.startsWith('apx_pk_');
  const TIMEOUT_MS = 10000;

  /** fetch → data. Selalu segar (no-store) supaya perubahan di ApexRecord
   *  langsung tampil. Error membawa .status dan .code dari API. */
  async function call(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (path.startsWith('/v1/')) headers['X-Api-Key'] = API_KEY;

    const res = await fetch((path.startsWith('/v1/') ? BASE_URL : LEGACY_BASE_URL) + path, {
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

  // Jaring pengaman: kalau /v1 belum aktif di server (404) atau key ditolak
  // (dicabut/domain belum didaftarkan), halaman beralih ke endpoint /public
  // lama untuk sisa kunjungan — website tetap jalan, error dicatat di console.
  const FALLBACK_CODES = ['API_KEY_INVALID', 'ORIGIN_NOT_ALLOWED', 'SUBSCRIPTION_INACTIVE'];
  async function v1OrLegacy(v1, legacy) {
    if (!useV1) return legacy();
    try {
      return await v1();
    } catch (err) {
      // Mode uji: tampilkan error apa adanya, jangan diam-diam pindah ke production.
      if (ENV_NAME === 'staging') throw err;
      // Rute /v1 belum ada di server → NestJS: 404 "Cannot GET /v1/…".
      const unavailable = err.status === 404 && /^Cannot (GET|POST) \/v1\//.test(err.message);
      if (!unavailable && !FALLBACK_CODES.includes(err.code)) throw err;
      console.warn('[ApexRecord API] /v1 tidak bisa dipakai, beralih ke /public:', err.code || err.status, err.message);
      useV1 = false;
      return legacy();
    }
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
    get usingKey() { return useV1; },
    environment: ENV_NAME,

    /** Profil klinik + jam operasional { senin: '08:00-16:00' | 'Tutup', … }. */
    clinic: () => once('clinic', () => v1OrLegacy(() => call('/v1/clinic'), legacyInfo)),

    /** Dokter aktif: [{ id, name, specialization, photoUrl, jadwalPraktik }].
     *  jadwalPraktik null = mengikuti jam klinik. */
    practitioners: () =>
      once('practitioners', () =>
        v1OrLegacy(() => call('/v1/practitioners'), () => legacyInfo().then((d) => d.practitioners || [])),
      ),

    /** { date, isOpen, slots: ['09:00', …] } — tidak di-memo, slot berubah terus. */
    slots: (date, practitionerId) => {
      const q = new URLSearchParams({ date });
      if (practitionerId) q.set('practitionerId', practitionerId);
      return v1OrLegacy(
        () => call(`/v1/slots?${q}`),
        () => call(`/public/available-slots?${q}&clinicId=${CLINIC_ID}`),
      );
    },

    /** { patientName, patientPhone, reservationDate, jamSlot, practitionerId?, notes? } */
    createReservation: (payload) =>
      v1OrLegacy(
        () => call('/v1/reservations', { method: 'POST', body: payload }),
        () =>
          call('/public/reservations', {
            method: 'POST',
            body: { ...payload, clinicId: CLINIC_ID, serviceType: 'outpatient' },
          }),
      ),

    status: (token) =>
      v1OrLegacy(
        () => call(`/v1/reservations/${encodeURIComponent(token)}`),
        () => call(`/public/reservations/status?token=${encodeURIComponent(token)}`),
      ),

    /** Reservasi aktif pasien lewat nomor HP + nama (tanpa token). Hanya ada
     *  di /v1 — dengan endpoint lama, cek reservasi tetap lewat token. */
    lookupReservations: (patientPhone, patientName) => {
      if (!useV1) {
        const err = new Error('Cek lewat nomor HP belum tersedia. Gunakan kode token reservasi.');
        err.status = 400;
        return Promise.reject(err);
      }
      return call('/v1/reservations/lookup', { method: 'POST', body: { patientPhone, patientName } });
    },

    cancel: (token) =>
      v1OrLegacy(
        () => call(`/v1/reservations/${encodeURIComponent(token)}/cancel`, { method: 'POST' }),
        () => call('/public/reservations/cancel', { method: 'PATCH', body: { token } }),
      ),
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

  // Penanda kecil supaya mode uji tidak tertukar dengan website sungguhan.
  if (ENV_NAME === 'staging') {
    document.addEventListener('DOMContentLoaded', () => {
      const bar = document.createElement('div');
      bar.setAttribute('role', 'status');
      bar.style.cssText =
        'position:fixed;left:12px;bottom:12px;z-index:9999;background:#B45309;color:#fff;' +
        'font:600 12px/1.4 system-ui,sans-serif;padding:8px 12px;border-radius:10px;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.25)';
      const exit = new URL(location.href);
      exit.searchParams.set('apex', 'production');
      bar.innerHTML = 'Mode uji: data dari ApexRecord <b>staging</b> · <a style="color:#fff;text-decoration:underline">Keluar</a>';
      bar.querySelector('a').href = exit.pathname + exit.search + exit.hash;
      document.body.appendChild(bar);
    });
  }

  window.ZDC_API = api;
})();
