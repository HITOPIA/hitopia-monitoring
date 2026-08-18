# PRD — Platform & Compliance

<!--
  Output: Planning Agent (Fase 02). Modul fondasi lintas-potong.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Platform & Compliance
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Menyediakan **fondasi lintas-potong** yang dipakai semua modul: autentikasi internal (SSO), otorisasi
berbasis peran (RBAC), audit log immutable, manajemen secret, serta kontrol kepatuhan UU PDP (minimisasi,
enkripsi data sensitif, retensi, hak subjek data). Modul ini menegakkan R5/R6/R8 secara teknis sehingga modul
lain cukup *menggunakan* layanannya, bukan mengimplementasikan ulang keamanan masing-masing.

## Kebutuhan (user stories)
- Sebagai **karyawan internal Hitopia**, saya ingin login lewat akun Google Workspace organisasi, agar tidak ada password baru dan akses dibatasi domain.
- Sebagai **admin/DPO**, saya ingin menetapkan peran (admin/analyst/reviewer/viewer) per pengguna, agar akses sesuai kebutuhan dan prinsip least-privilege.
- Sebagai **admin/DPO**, saya ingin melihat audit log semua akses & aksi material ke data sensitif, agar dapat dipertanggungjawabkan saat audit PDP.
- Sebagai **subjek data (talent)**, saya ingin hak akses/koreksi/hapus atas data pribadi saya dihormati, agar patuh UU PDP.
- Sebagai **engineer**, saya ingin credential sumber eksternal hanya dari secret manager/env, agar tidak ada secret di repo/log/report.

## Functional requirements
F1. Autentikasi via Google OAuth (Auth.js) **dibatasi ke domain organisasi**; akun di luar domain ditolak.
F2. Setiap pengguna punya satu peran dari {admin, analyst, reviewer, viewer}; RBAC ditegakkan **server-side** pada setiap endpoint.
F3. Stakeholder/manajemen client **tidak** punya akun aplikasi (mereka hanya menerima deck final yang sudah diekspor).
F4. Semua akses & aksi material ke entitas sensitif tercatat ke `AUDIT_LOG` (aktor, aksi, entitas, waktu); metadata **diredaksi** dari nilai sensitif.
F5. Audit log **append-only** (tidak bisa diubah/dihapus lewat aplikasi); dapat di-query admin dengan filter (entitas/aktor/periode) + pagination.
F6. Credential sumber eksternal (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `CLOCKIFY_API_KEY`, kredensial Google) hanya diambil dari secret manager/env saat runtime; tidak pernah disimpan di DB/log/report/prompt.
F7. Data sensitif (PII talent, skor, lead assessment, insight) **terenkripsi at rest**; transport selalu TLS.
F8. Tersedia mekanisme **retensi** per entitas dan **hak subjek data** (akses/koreksi/penghapusan) dengan jejak audit.
F9. Endpoint kepatuhan: `GET /me` (profil), `GET /audit-logs` (admin-only).

## Non-functional
- **Keamanan default-on:** semua endpoint butuh auth kecuali `/auth/login`; gagal-tertutup (default deny) bila peran tidak diketahui.
- **Auditability (R6):** log terstruktur, immutable, dan dapat di-rollback lewat DB history.
- **Privasi by design:** minimisasi data dalam log & response; tidak ada nilai sensitif di pesan error.
- **Keandalan:** kegagalan secret manager → fail closed (tidak fallback ke nilai default tidak aman).

## Acceptance criteria
- Login domain-restricted bekerja; akun luar domain ditolak.
- Endpoint menolak akses tanpa peran yang tepat (403) dan tanpa auth (401).
- Aksi material menghasilkan entri `AUDIT_LOG`; entri tidak dapat diubah/dihapus via API.
- Tidak ada secret di kode/log/report; credential hanya dari secret manager.
- Data sensitif terenkripsi at rest; tidak ada PII bocor di response error.
- Detail tegas di `spec/platform-compliance/acceptance.test`.

## Dependencies
- **Foundation Contract** — entitas `APP_USER`, `AUDIT_LOG`; konvensi error/auth/pagination; bagian "Aturan data sensitif".
- Dipakai oleh **semua modul** (RBAC/audit/secret). Lihat [[data-integration]], [[identity-mapping]], [[metrics-scoring]], [[ai-insight]], [[monthly-report]], [[approval-workflow]], [[internal-dashboard]].
- Eksternal: Google OAuth (Auth.js), secret manager (lihat `spec/tech-stack.md`).

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3 (R5/R6/R8).** Modul ini *adalah* lapisan kepatuhan. Menentukan dasar pemrosesan sah,
minimisasi, enkripsi, retensi, hak subjek data, audit, dan secret management untuk seluruh sistem.

## Out of scope
- Manajemen identitas talent (subjek data) — itu [[identity-mapping]]. Modul ini hanya mengelola `APP_USER` (pengguna aplikasi).
- Self-service signup publik (akses internal-only, diundang/dibatasi domain).
- Pembayaran/billing pengguna.

## Open questions
1. Daftar domain Google Workspace yang diizinkan & proses provisioning peran awal (siapa admin pertama).
2. Pilihan **secret manager** final (Doppler vs cloud secret manager) & prosedur **rotasi credential exposed**.
3. Kebijakan **retensi** konkret per entitas (berapa lama skor/insight/audit disimpan) — perlu keputusan DPO.
4. Mekanisme operasional **hak subjek data** (alur permintaan akses/hapus) — perlu kebijakan hukum/DPO.

---
*Nafanesia — Template PRD v1.0*
