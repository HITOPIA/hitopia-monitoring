# PRD — Identity Mapping

<!--
  Output: Planning Agent (Fase 02). Registry talent kanonik + mapping lintas-sistem.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Identity Mapping
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Membentuk **registry talent kanonik** dan memetakan identitas tiap talent lintas-sistem (Google Sheet ↔ Jira ↔
Clockify ↔ project/client) secara andal. Ini **fondasi seluruh scoring**: bila mapping rapuh, semua angka ikut
salah (risiko teknis #1). Mapping yang tidak yakin **wajib di-flag untuk verifikasi manusia**, bukan ditebak.

## Kebutuhan (user stories)
- Sebagai **analyst internal**, saya ingin satu daftar talent kanonik dengan identitas eksternalnya tersatukan, agar metrik dari Jira & Clockify menempel ke orang yang benar.
- Sebagai **analyst/admin**, saya ingin melihat mapping yang ragu/konflik (confidence rendah) dan menyelesaikannya manual, agar tidak ada skor dihitung di atas identitas yang salah.
- Sebagai **analyst**, saya ingin talent yang belum termapping **dikecualikan/ditandai** dari scoring, agar tidak menghasilkan angka menyesatkan.
- Sebagai **DPO**, saya ingin akses ke registry talent (PII) dibatasi & teraudit, agar patuh UU PDP.

## Functional requirements
F1. Sistem membangun `TALENT` kanonik dari master Google Sheet (sumber kebenaran identitas talent) per periode.
F2. Sistem mencocokkan external id tiap talent ke Jira & Clockify (dan project/client) → `IDENTITY_MAPPING` dengan `confidence` (`high|medium|low`).
F3. Mapping dengan confidence < high (ambigu/konflik/tidak ditemukan) **di-flag belum terverifikasi** dan tidak dianggap final.
F4. Manusia dapat **memverifikasi/menolak** mapping (`POST /mappings/{id}/verify`); keputusan tercatat (`verified_by`, `verified_at`) & teraudit.
F5. Talent tanpa mapping terverifikasi yang cukup **ditandai tidak-skorable** untuk periode tersebut (handoff ke metrics-scoring).
F6. Sistem memelihara `PROJECT` & penugasan `TALENT_PROJECT` (dengan client_name) untuk konteks delivery/budget.
F7. Perubahan mapping **berversi/terjejak** agar metrik lampau dapat ditelusuri ke mapping yang berlaku saat itu.
F8. Endpoint: `GET /talents`, `GET /talents/{id}` (+ mappings), `GET /mappings/unresolved`, `POST /mappings/{id}/verify`.

## Non-functional
- **Akurasi > otomasi:** lebih baik meminta verifikasi manusia daripada menebak; tidak ada auto-merge berisiko tinggi.
- **Ketertelusuran:** setiap skor dapat dirujuk balik ke mapping (+versi) yang dipakai.
- **Privasi:** registry berisi PII — akses RBAC ketat, minimisasi field yang ditampilkan, audit penuh.

## Acceptance criteria
- Registry talent kanonik terbentuk dari master Sheet; tidak ada duplikat talent.
- Setiap talent punya mapping ke Jira/Clockify dengan confidence; yang ragu muncul di `GET /mappings/unresolved`.
- Verifikasi manusia mengunci mapping & tercatat; talent tanpa mapping memadai ditandai tidak-skorable.
- Mapping berversi sehingga metrik lampau tetap dapat ditelusuri.
- Akses registry dibatasi peran & teraudit.
- Detail tegas di `spec/identity-mapping/acceptance.test`.

## Dependencies
- **Foundation Contract** — `TALENT`, `IDENTITY_MAPPING`, `PROJECT`, `TALENT_PROJECT`.
- [[data-integration]] — sumber master talent + external id mentah.
- [[platform-compliance]] — RBAC, audit, enkripsi PII.
- [[metrics-scoring]] — konsumen registry + flag tidak-skorable.

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Registry = **data pribadi** talent. Wajib: enkripsi PII at rest, akses RBAC ketat,
minimisasi, audit setiap akses/verifikasi, hak subjek data (via platform-compliance).

## Out of scope
- Penarikan data mentah dari sumber → [[data-integration]].
- Perhitungan metrik/skor → [[metrics-scoring]] (modul ini hanya menyediakan identitas + flag skorabilitas).
- Editing identitas di sumber asal (read-only).

## Open questions
1. **Join key kanonik** yang dijamin antar sistem (email org? employee id? mapping manual awal?) — **BLOKIR**: harus dijernihkan sebelum freeze kontrak & sebelum scoring dipercaya.
2. Aturan **ambiguitas**: confidence dihitung dari apa (exact email, fuzzy name, project overlap)? ambang `high` di angka berapa?
3. Penanganan **talent multi-akun** atau **akun bersama** di Jira/Clockify.
4. Sumber kebenaran **project ↔ client** & pemetaannya ke Jira project key / Clockify project id.

---
*Nafanesia — Template PRD v1.0*
