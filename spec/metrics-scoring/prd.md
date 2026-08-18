# PRD — Metrics & Scoring

<!--
  Output: Planning Agent (Fase 02). Metrik turunan + skor performa hybrid + lead assessment + config berversi.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Metrics & Scoring
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Menghitung **metrik performa per talent per periode** (utilization, overtime, efficiency, delivery, budget burn)
dari data ter-ingest, menerima **lead assessment** terstruktur, lalu menggabungkannya menjadi **skor performa
hybrid** + **flag** (Low/Needs review/Healthy) berdasarkan **konfigurasi bobot/threshold yang berversi**. Skor
diposisikan sebagai **decision-support**, dapat ditelusuri ke data sumber, dan tidak dihitung untuk talent yang
tidak-skorable.

## Kebutuhan (user stories)
- Sebagai **analyst internal**, saya ingin metrik utilization/overtime/efficiency/delivery/budget burn per talent/periode, agar punya dasar kuantitatif.
- Sebagai **lead divisi**, saya ingin mengisi penilaian lewat **rubric terstruktur**, agar penilaian saya konsisten & ternormalisasi ke 0–100.
- Sebagai **analyst**, saya ingin skor hybrid + flag otomatis per talent, agar cepat melihat siapa yang perlu di-review.
- Sebagai **admin**, saya ingin mengubah bobot/threshold secara **berversi** (tidak retroaktif diam-diam), agar kalibrasi dapat dipertanggungjawabkan.
- Sebagai **DPO**, saya ingin skor diperlakukan sebagai decision-support & akses dibatasi, agar tidak jadi vonis otomatis.

## Functional requirements
F1. Hitung **Utilization** dari jam produktif Clockify vs target (asumsi awal 08.00–17.00, 8 jam produktif/hari — dapat dikonfigurasi).
F2. Hitung **Overtime Health** dari overtime sebagai **sinyal risiko** (bukan otomatis bagus); overtime tinggi + output rendah = mismatch.
F3. Hitung **Delivery** dari ticket selesai vs komitmen, aging, overdue, reopened/bug ulang.
F4. Hitung **Efficiency** dari output Jira dibanding jam terpakai & budget burn.
F5. Hitung **Budget Burn** = jam × cost rate (dari `COST_RATE`); bila cost rate belum ada, budget burn ditandai **tidak tersedia**, bukan diasumsikan.
F6. Terima **lead assessment** terstruktur (`POST /lead-assessments`) dengan rubric → `normalized_score` 0–100.
F7. Hitung **skor hybrid** per talent/periode dari bobot terkonfigurasi (default Delivery 35 / Utilization 25 / Efficiency 20 / Overtime Health 10 / Lead 10) → `total_score` 0–100.
F8. Beri **flag** dari threshold terkonfigurasi (default Low <60 atau dua indikator merah 2 periode; Needs review 60–74 atau mismatch; Healthy ≥75 tanpa risk flag besar).
F9. Bobot/threshold dikelola sebagai `SCORING_CONFIG` **berversi** dengan `effective_from`; skor menyimpan `scoring_config_id` yang dipakai (tidak retroaktif diam-diam).
F10. Talent **tidak-skorable** (mapping/data tidak memadai dari upstream) **tidak** diberi skor; alasannya jelas.
F11. Setiap skor menyimpan komponen sub-skor + referensi ke metrik/periode sumber (traceability).
F12. Endpoint: `GET /talents/{id}/metrics`, `GET /scores`, `GET /talents/{id}/scores`, `GET /scoring-config`, `PUT /scoring-config`, `POST /lead-assessments`, `GET /lead-assessments`.

## Non-functional
- **Determinisme & reproduksibilitas:** skor sama untuk input + config yang sama; dapat dihitung ulang.
- **Ketertelusuran:** setiap angka dapat dirujuk ke record sumber + versi config.
- **Kehati-hatian:** ketiadaan data ≠ nol; ditandai "tidak tersedia" agar tidak menghukum talent karena data hilang.

## Acceptance criteria
- Metrik terhitung benar dari data ter-ingest; ketiadaan cost rate → budget burn "tidak tersedia".
- Lead assessment ternormalisasi 0–100 & tergabung sesuai bobot.
- Skor hybrid + flag terhitung sesuai config berversi; skor menyimpan `scoring_config_id`.
- Ubah config menghasilkan **versi baru** (tidak mengubah skor lama diam-diam).
- Talent tidak-skorable tidak diberi skor; alasannya tersedia.
- Detail tegas di `spec/metrics-scoring/acceptance.test`.

## Dependencies
- **Foundation Contract** — `UTILIZATION_RECORD`, `DELIVERY_RECORD`, `BUDGET_BURN`, `COST_RATE`, `LEAD_ASSESSMENT`, `SCORING_CONFIG`, `PERFORMANCE_SCORE`.
- [[data-integration]] — sumber `UTILIZATION_RECORD`/`DELIVERY_RECORD`.
- [[identity-mapping]] — registry + flag skorabilitas.
- [[platform-compliance]] — RBAC, audit, enkripsi.
- [[ai-insight]] & [[internal-dashboard]] — konsumen skor.

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Skor & lead assessment = **data performa individu** (pemrosesan sensitif). Wajib:
framing decision-support (bukan vonis), enkripsi at rest, RBAC ketat, audit perubahan config & akses skor,
tidak ada automated decision-making merugikan tanpa review manusia.

## Out of scope
- Narasi/diagnosis/rekomendasi AI → [[ai-insight]] (modul ini hanya angka + flag).
- Penyajian dashboard → [[internal-dashboard]].
- Penentuan sumber cost rate (modul ini mengonsumsi `COST_RATE`; sumbernya adalah open question proyek).

## Open questions
1. **Kalibrasi bobot/threshold** (35/25/20/10/10; <60, 60–74, ≥75) terhadap penilaian lead — usulan awal, **wajib divalidasi sample** sebelum dikunci.
2. **Definisi "dua indikator merah dalam dua periode"** secara presisi (indikator mana, ambang merah berapa).
3. **Sumber & bentuk cost rate** (per talent/role, currency, effective_from) — **BLOKIR** untuk Efficiency/budget burn.
4. **Rubric lead assessment** final & metode normalisasi ke 0–100.
5. **Jam kerja standar** 08.00–17.00 / 8 jam — seragam lintas talent/klien? (asumsi awal).

---
*Nafanesia — Template PRD v1.0*
