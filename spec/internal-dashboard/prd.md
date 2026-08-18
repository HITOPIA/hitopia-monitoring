# PRD — Internal Dashboard

<!--
  Output: Planning Agent (Fase 02). Dashboard read-only diagnostik untuk tim internal.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Internal Dashboard
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Menyajikan **dashboard read-only diagnostik** bagi tim internal Hitopia: utilization, overtime, cost/budget burn,
delivery, skor performa, flag, dan insight per talent/periode dalam **satu tempat** — untuk mendiagnosis
low-performance sebelum presentasi. Dashboard ini **internal-only** (berisi sinyal sensitif) dan **terpisah tegas**
dari deck client. Ia mengonsumsi data modul lain; tidak menghitung atau menulis data analitik baru.

## Kebutuhan (user stories)
- Sebagai **analyst internal**, saya ingin satu layar berisi metrik + skor + flag + insight per talent/periode, agar bisa diagnosis cepat.
- Sebagai **analyst**, saya ingin memfilter per periode, flag, divisi, atau project, agar fokus ke talent berisiko.
- Sebagai **analyst**, saya ingin drill-down dari skor → sub-skor → metrik sumber → insight, agar paham *kenapa* sebuah skor muncul (traceability).
- Sebagai **analyst**, saya ingin melihat penanda **kualitas data / tidak-skorable**, agar tidak salah menyimpulkan dari data buruk.
- Sebagai **DPO**, saya ingin dashboard ini internal-only, akses dibatasi peran, & teraudit, agar patuh PDP.

## Functional requirements
F1. Tampilkan daftar talent dengan skor total, flag (Low/Needs review/Healthy), dan metrik ringkas per periode.
F2. Filter & sort per periode, flag, divisi, project; pagination untuk daftar besar.
F3. Halaman detail talent: sub-skor (delivery/utilization/efficiency/overtime/lead), metrik sumber, budget burn, dan insight terkait — dengan **traceability** ke data sumber.
F4. Tampilkan penanda **kualitas data** & **tidak-skorable** (dari data-integration/identity-mapping) agar interpretasi aman.
F5. Dashboard **read-only** untuk data analitik; satu-satunya aksi tulis yang relevan dari sini diserahkan ke modul pemilik (mis. lead assessment → metrics-scoring, verify mapping → identity-mapping, approve → approval-workflow).
F6. **Internal-only:** dashboard tidak menampilkan/menghasilkan artefak client; tidak ada jalur dari dashboard ke ekspor client tanpa approval.
F7. Visualisasi metrik/skor (chart) untuk tren & komparasi antar talent/periode.

## Non-functional
- **Performa:** memuat view periode untuk skala talent-pool Hitopia (ratusan talent) dalam waktu wajar; query agregat efisien.
- **Konsistensi:** angka di dashboard = angka modul sumber (tidak menghitung ulang berbeda).
- **Aksesibilitas & kejelasan:** flag & sinyal sensitif disajikan sebagai decision-support, bukan vonis.

## Acceptance criteria
- Satu dashboard menyatukan metrik + skor + flag + insight per talent/periode.
- Filter/sort/pagination & drill-down dengan traceability ke sumber berfungsi.
- Penanda kualitas data/tidak-skorable tampil.
- Dashboard internal-only & read-only untuk data analitik; akses dibatasi peran & teraudit.
- Detail tegas di `spec/internal-dashboard/acceptance.test`.

## Dependencies
- **Foundation Contract** — membaca via endpoint: `/talents`, `/talents/{id}/metrics`, `/scores`, `/talents/{id}/scores`, `/talents/{id}/insights`, `/ingestion/runs`.
- [[metrics-scoring]], [[identity-mapping]], [[data-integration]], [[ai-insight]] — sumber data tampilan.
- [[platform-compliance]] — RBAC, audit, auth.
- UI mengikuti `design/` proyek > `design-system/` root (lihat AGENTS.md).

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Menampilkan **data performa individu** (sensitif). Wajib: internal-only, RBAC ketat,
audit akses tampilan data sensitif, pemisahan tegas dari konten client, framing decision-support.

## Out of scope
- Perhitungan metrik/skor → [[metrics-scoring]]; generasi insight → [[ai-insight]].
- Pembuatan/ekspor deck client → [[monthly-report]].
- Penulisan data analitik baru (dashboard hanya membaca + mendelegasikan aksi ke modul pemilik).
- Mobile app native.

## Open questions
1. **Peran mana** yang boleh melihat dashboard diagnostik penuh vs view terbatas (mis. lead hanya divisinya?).
2. **KPI/visual prioritas** di layar utama (apa yang paling dulu dilihat saat diagnosis).
3. Apakah aksi lead-assessment & verify-mapping **disematkan** di dashboard atau di layar modul terpisah (UX).
4. **Target performa** load view (angka konkret) — disepakati saat build/prototype.

---
*Nafanesia — Template PRD v1.0*
