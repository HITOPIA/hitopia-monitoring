# Blueprint — Metrics & Scoring

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md.
-->

```
Unit       : Metrics & Scoring
Level      : module
Depends-on : Foundation Contract (UTILIZATION_RECORD, DELIVERY_RECORD, BUDGET_BURN, COST_RATE, LEAD_ASSESSMENT, SCORING_CONFIG, PERFORMANCE_SCORE) · [[data-integration]] · [[identity-mapping]] · [[platform-compliance]]
```

## Pendekatan teknis
- **Pipeline deterministik per periode:** metrik dasar → budget burn → gabung lead assessment → skor hybrid → flag. Fungsi murni (input → output) agar reproducible & mudah diuji.
- **Config sebagai data berversi:** `SCORING_CONFIG` (weights+thresholds+effective_from); skor menyimpan `scoring_config_id` yang dipakai. `PUT /scoring-config` selalu membuat **versi baru**, tidak mutasi in-place.
- **Skorabilitas dari upstream:** hormati flag tidak-skorable dari identity-mapping & `DATA_QUALITY_FLAG severity=block`.
- **Missing-data sebagai first-class:** nilai "tidak tersedia" (mis. budget burn tanpa cost rate) tidak diperlakukan nol.
- Opsi worker Python untuk kalibrasi/scoring berat (lihat `spec/tech-stack.md`); default TypeScript.

## Data yang disentuh
- **Menulis (owner):** `BUDGET_BURN`, `LEAD_ASSESSMENT`, `SCORING_CONFIG`, `PERFORMANCE_SCORE`. **Membaca/memakai:** `COST_RATE`.
- **Membaca:** `UTILIZATION_RECORD`, `DELIVERY_RECORD` ([[data-integration]]); registry + skorabilitas ([[identity-mapping]]).
- Definisi entitas dari kontrak — tidak diulang.

## Interface / API unit
Rujuk Foundation Contract:
- `GET /talents/{id}/metrics?period=` → `{ utilization, delivery, budget_burn }`.
- `GET /scores?period=&flag=` · `GET /talents/{id}/scores?period=` → `PerformanceScore`.
- `GET /scoring-config` · `PUT /scoring-config` `{ weights, thresholds, effective_from }` (admin → versi baru).
- `POST /lead-assessments` `{ talent_id, period, rubric_scores, comment }` · `GET /lead-assessments?period=`.

## Komponen reusable
- **Weighted scoring engine + threshold/flag evaluator** generik → tandai untuk `shared-library/` setelah stabil.
- Memakai guard RBAC, audit, enkripsi dari [[platform-compliance]].

## Alur utama
1. Untuk talent skorable di periode: hitung Utilization, Overtime Health, Delivery, Efficiency dari record sumber.
2. Hitung Budget Burn = jam × `COST_RATE` aktif; bila tak ada rate → tandai "tidak tersedia".
3. Ambil `LEAD_ASSESSMENT` (rubric → `normalized_score` 0–100).
4. Ambil `SCORING_CONFIG` aktif (`effective_from` ≤ periode); hitung `total_score` berbobot.
5. Tetapkan flag dari threshold + aturan mismatch/dua-periode; simpan `PERFORMANCE_SCORE` (sub-skor + `scoring_config_id` + source_refs).
6. Catat audit; talent tidak-skorable dilewati dengan alasan.

## Edge cases & error handling
- **Cost rate hilang** → budget burn & Efficiency menandai komponen tak tersedia, tidak nol (tidak menghukum).
- **Komponen hilang** (mis. lead assessment belum masuk) → skor parsial ditandai jelas / ditahan sesuai kebijakan, bukan diam-diam menganggap 0.
- **Bobot tidak berjumlah 100** di `PUT /scoring-config` → 422 validasi.
- **Periode tanpa data** → tidak ada skor; alasan tercatat.
- **Perubahan config** → skor lama tetap menunjuk versi lama (tidak retroaktif); recompute eksplisit bila diminta.
- **Overtime tinggi + output rendah** → flag mismatch (Needs review), bukan otomatis Healthy.

## Rencana uji
- Unit: tiap formula metrik, normalisasi rubric, skor berbobot, evaluasi flag (termasuk mismatch & dua-periode), validasi bobot=100, perilaku missing-data/cost-rate.
- Integrasi: end-to-end record → skor; versioning config (skor lama tak berubah); talent tidak-skorable dilewati.
- Keamanan: RBAC (config admin-only), audit perubahan config & akses skor; tidak ada PII bocor. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Data performa individu: enkripsi at rest, RBAC ketat, audit perubahan `SCORING_CONFIG` & akses skor, framing decision-support, tidak ada keputusan otomatis merugikan tanpa review manusia. Tidak ada PII/secret di log.

---
*Nafanesia — Template Blueprint v1.0*
