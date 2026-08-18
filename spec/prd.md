# PRD — Hitopia Monitoring & Monthly Report

<!--
  Output: Planning Agent (Fase 02). PRD tingkat PROJECT.
  Pasangan: brd.md (kebutuhan bisnis) + tech-stack.md (keputusan teknologi).
  Kontrak data/API draft: contract/foundation.draft.md.
  Dekomposisi unit per modul ada di spec/<unit>/.
-->

```
Unit    : Hitopia Monitoring & Monthly Report
Level   : project
Parent  : —
Status  : draft
Owner   : Planning Agent (Product) — model claude-opus-4-8
```

## Tujuan unit
Menyatukan tiga sumber data terpisah — Google Sheet (master talent), Jira (delivery), Clockify
(utilization/overtime/basis budget burn) — menjadi satu **dashboard performa kuantitatif read-only**
untuk tim internal Hitopia, lalu menghasilkan **monthly slide deck client-ready** bernarasi & rekomendasi
AI. Tujuannya menggantikan penilaian performa yang dominan kualitatif/subjektif dengan dasar kuantitatif
yang **dapat ditelusuri ke data sumber**, sambil memposisikan skor sebagai **decision-support**, bukan vonis.

> "Read-only" berlaku ke **sumber eksternal** (tidak ada write-back ke Jira/Clockify/Sheet). Aplikasi tetap
> menulis **data turunan & operasionalnya sendiri** ke DB: lead assessment, konfigurasi scoring, insight,
> report, approval, dan audit log. Lihat [[Open questions]] — ini perlu dikonfirmasi eksplisit di Gerbang 1/2.

## Kebutuhan (user stories)
- Sebagai **analyst internal Hitopia**, saya ingin melihat utilization, overtime, cost/budget burn, delivery,
  dan skor performa tiap talent dalam satu dashboard, agar saya bisa diagnosis low-performance sebelum presentasi.
- Sebagai **analyst internal**, saya ingin sistem menarik data otomatis via API (Sheet/Jira/Clockify) per periode,
  agar tidak ada entri manual dan datanya konsisten.
- Sebagai **lead divisi**, saya ingin memasukkan penilaian kualitatif lewat rubric terstruktur, agar penilaian saya
  konsisten dan tergabung ke skor hybrid.
- Sebagai **analyst internal**, saya ingin sistem mengidentifikasi talent berisiko + **diagnosis penyebab** (bukan
  sekadar label) dengan narasi yang menunjuk data sumbernya, agar saya paham *kenapa*.
- Sebagai **management Hitopia (reviewer)**, saya ingin me-review & meng-approve insight/deck sebelum client-facing,
  agar analisis sensitif tidak bocor dan narasi AI tidak over-claim.
- Sebagai **management**, saya ingin slide deck bulanan siap presentasi otomatis ter-generate dari data yang sudah
  di-approve, agar waktu penyusunan deck turun drastis.
- Sebagai **admin/DPO**, saya ingin akses dibatasi per peran dan semua aksi tercatat (audit), agar patuh UU PDP.

## Functional requirements
F1. Sistem menarik data terjadwal (default bulanan) dari Google Sheets, Jira, dan Clockify via API tanpa entri manual.
F2. Sistem memetakan identitas talent lintas-sistem (Sheet ↔ Jira ↔ Clockify ↔ project/client) menjadi satu
    registry talent kanonik; mapping yang tidak yakin di-flag untuk verifikasi manusia.
F3. Sistem memprofil & memvalidasi kualitas data tiap sumber per periode dan menandai data yang tidak layak skor.
F4. Sistem menghitung metrik per talent per periode: utilization, overtime, efficiency, delivery, dan budget burn.
F5. Sistem menerima lead assessment terstruktur (rubric) per talent per periode.
F6. Sistem menghitung **skor performa hybrid** per talent per periode dari bobot terkonfigurasi
    (default Delivery 35 / Utilization 25 / Efficiency 20 / Overtime Health 10 / Lead 10) dan memberi flag
    (Low / Needs review / Healthy) dari threshold terkonfigurasi.
F7. Bobot & threshold scoring dapat dikonfigurasi dan **berversi**; perubahan tercatat dan tidak retroaktif diam-diam.
F8. Sistem menghasilkan insight AI: diagnosis penyebab low-performance, narasi, dan rekomendasi, dengan **referensi
    ke metrik/periode sumber** (traceability) dan tanpa mengakses sumber data sensitif di luar yang relevan.
F9. Sistem menghasilkan **monthly slide deck client-ready** dari konten yang sudah di-approve, dengan pemisahan tegas
    antara konten diagnostik internal dan konten client-facing.
F10. Insight & deck wajib melewati alur **review → approve** tim internal sebelum dapat dipakai/diekspor client-facing.
F11. Dashboard read-only menampilkan metrik, skor, flag, dan insight per talent/periode untuk tim internal.
F12. Akses dibatasi per peran (RBAC); semua akses & aksi material tercatat di audit log.

## Non-functional
- **Keandalan & idempotensi ingestion:** kegagalan satu sumber tidak merusak data periode lain; ingestion bisa diulang.
- **Ketertelusuran:** tiap skor & klaim insight dapat ditelusuri ke data sumber + versi konfigurasi scoring.
- **Privasi by design:** minimisasi data, enkripsi data sensitif at rest, retensi terdefinisi, hak subjek data.
- **Keamanan secret:** credential hanya via secret manager/env; tidak pernah di repo/log/report/prompt (R8).
- **Performa:** dashboard interaktif memuat view periode dalam waktu wajar untuk skala talent-pool Hitopia
  (ratusan talent, bukan jutaan baris); angka target disepakati di Planning/Prototype.
- **Auditability (R6):** semua aksi tercatat & dapat di-rollback lewat Git/DB history.

## Acceptance criteria
- Tiga sumber tertarik otomatis & ter-rekonsiliasi menjadi registry talent kanonik; mapping ragu ter-flag.
- Skor hybrid + flag terhitung per talent/periode sesuai bobot/threshold terkonfigurasi & berversi.
- Insight AI menghasilkan diagnosis + rekomendasi yang **setiap klaimnya menunjuk data sumber**; tidak ada angka
  yang tidak bersumber.
- Tidak ada konten client-facing yang bisa diekspor tanpa approval internal eksplisit.
- View internal (sensitif) terpisah tegas dari konten client.
- RBAC & audit log aktif; tidak ada secret di kode/log/report.
- Detail tegas per unit ada di `spec/<unit>/acceptance.test`.

## Dependencies
- **Foundation Contract** (`contract/foundation.draft.md`) — ERD + kontrak API; semua modul merujuk ke sini.
- Sumber eksternal: Google Sheets API, Jira REST API, Clockify API (read-only).
- Sumber **cost rate** untuk budget burn — **belum ditetapkan** (lihat Open questions).
- Modul: [[data-integration]], [[identity-mapping]], [[metrics-scoring]], [[ai-insight]],
  [[monthly-report]], [[approval-workflow]], [[internal-dashboard]], [[platform-compliance]].

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3 (R5).** Sistem menyentuh **data pribadi** (atribut talent) dan **data performa individu**
(skor, lead assessment, insight) — pemrosesan sensitif menurut UU PDP. Memicu Gerbang 3:
- Modul yang menyentuh data sensitif: identity-mapping, metrics-scoring, ai-insight, monthly-report,
  approval-workflow, internal-dashboard, platform-compliance.
- Human-in-the-loop wajib sebelum client-facing (approval-workflow).
- Pemisahan internal vs client (monthly-report + internal-dashboard).
- Secret management & rotasi credential exposed sebelum integrasi production (platform-compliance, data-integration).

## Out of scope
- Write-back / editing data ke Jira, Clockify, atau Google Sheet.
- Payroll, pembayaran, invoice, transaksi uang.
- Mobile app native.
- Realtime operational alerting di luar kebutuhan monthly monitoring/reporting.
- Pengiriman otomatis deck ke client tanpa approval internal.
- Automated decision-making yang merugikan individu tanpa review manusia.

## Open questions
<!-- Memblokir → eskalasi sebelum build. Diturunkan dari "syarat" Gerbang 1 di assessment.md. -->
1. **Identity-mapping key** kanonik antar Sheet ↔ Jira ↔ Clockify ↔ project/client — fondasi seluruh scoring.
   *(BLOKIR untuk metrics-scoring; harus dijernihkan sebelum freeze kontrak.)*
2. **Sumber cost rate** untuk budget burn (per talent/role, mata uang, efektif sejak kapan). *(BLOKIR untuk Efficiency/budget burn.)*
3. **Persetujuan profiling CSV master** (data personal) & **rotasi credential exposed** sebelum koneksi production. *(BLOKIR untuk data-integration prod.)*
4. **Kalibrasi bobot/threshold scoring** (35/25/20/10/10; <60, 60–74, ≥75) terhadap penilaian lead — usulan awal, perlu validasi sebelum dikunci.
5. **Jam kerja standar** 08.00–17.00 / 8 jam produktif — apakah seragam lintas talent/klien? Asumsi awal, perlu konfirmasi.
6. **Definisi "read-only"** vs penulisan data operasional aplikasi sendiri (lead assessment, approval, dll.) — konfirmasi eksplisit ke pemilik produk.
7. **Target terukur** (mis. % talent ter-cover; waktu siapkan deck turun X→Y jam) belum ditetapkan — sepakati di Planning.

---
*Nafanesia — Template PRD v1.0*
