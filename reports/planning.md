# Handoff Planning — Hitopia Monitoring & Monthly Report

> Dari: **Planning Agent** (claude-opus-4-8) · 2026-06-14
> Untuk: **Gerbang 2 / CTO** (freeze kontrak) lalu **UI · Implementation · Reviewer**
> Input: [`assessment.md`](../assessment.md) (Go bersyarat) · [`reports/intake.md`](./intake.md)

## Status
Spec lengkap tingkat project + dekomposisi 8 modul selesai. Foundation Contract disiapkan sebagai **DRAFT**.
⛔ **Kontrak BELUM dibekukan** — itu keputusan manusia (CTO). Jangan mulai implementasi paralel sebelum freeze (R2/R4).

## Artefak yang dihasilkan
**Tingkat project**
- [`spec/prd.md`](../spec/prd.md) — PRD produk (project level).
- [`spec/brd.md`](../spec/brd.md) — kebutuhan bisnis.
- [`spec/tech-stack.md`](../spec/tech-stack.md) — rekomendasi stack + model AI + konvensi + ROM biaya.
- [`contract/foundation.draft.md`](../contract/foundation.draft.md) — **ERD + kontrak API (DRAFT, untuk di-freeze CTO)**.

**Per unit (modul) — masing-masing prd.md + blueprint.md + acceptance.test**
1. `spec/platform-compliance/` — auth SSO, RBAC, audit, secret, kontrol PDP (fondasi lintas-potong).
2. `spec/data-integration/` — ingestion read-only terjadwal Sheet/Jira/Clockify + data quality.
3. `spec/identity-mapping/` — registry talent kanonik + mapping lintas-sistem (risiko #1).
4. `spec/metrics-scoring/` — metrik + budget burn + lead assessment + skor hybrid + config berversi.
5. `spec/ai-insight/` — diagnosis/narasi/rekomendasi AI dengan traceability + guardrail.
6. `spec/approval-workflow/` — gerbang human-in-the-loop sebelum client-facing.
7. `spec/monthly-report/` — perakitan & ekspor deck client-ready + pemisahan internal/client.
8. `spec/internal-dashboard/` — dashboard read-only diagnostik internal.

## Keputusan desain utama
- **Dekomposisi sampai level modul** (bukan submodule/komponen) — altitude tepat untuk MVP; mengikuti modul yang dirujuk `spec/prd.md`.
- **`APP_USER` (pengguna aplikasi) dipisah tegas dari `TALENT` (subjek data)** — auth/RBAC vs data yang dinilai.
- **Read-only** hanya ke sumber eksternal; aplikasi tetap menulis entitas turunan/operasionalnya sendiri (registry, skor, lead assessment, insight, report, approval, audit). Perlu konfirmasi eksplisit pemilik produk (lihat Open question #6 di PRD project).
- **Skor = decision-support, bukan vonis**; tiap angka/klaim insight wajib bertraceability ke sumber.
- **Privasi & audit kelas-PDP sebagai default arsitektur**, ditegakkan terpusat oleh platform-compliance.
- **Missing-data first-class** (mis. budget burn tanpa cost rate = "tidak tersedia", bukan 0) agar tidak menghukum talent karena data hilang.

## 🔴 Gerbang 3 (R5) — aktif
Seluruh sistem menyentuh **data pribadi & performa individu**. Modul wajib Gerbang 3 (review manusia): semua kecuali
murni infrastruktur. Kontrol inti: RBAC + audit (platform-compliance), human-in-the-loop (approval-workflow),
pemisahan internal/client (monthly-report + internal-dashboard), secret management & rotasi (platform-compliance +
data-integration), minimisasi data ke model AI (ai-insight).

## ⛔ BLOKIR sebelum freeze kontrak (harus dijawab manusia)
Diturunkan dari "syarat Go" assessment & intake. Skema draft dibuat fleksibel terhadap ini, tetapi field bisa berubah:
1. **Identity-mapping key kanonik** Sheet ↔ Jira ↔ Clockify ↔ project/client — fondasi seluruh scoring. *(→ identity-mapping, contract)*
2. **Sumber & bentuk cost rate** untuk budget burn (per talent/role, currency, effective_from). *(→ metrics-scoring `COST_RATE`)*
3. **Secret management final + rotasi credential exposed** (Jira/Clockify yang sempat dibagi di chat dianggap exposed). *(→ platform-compliance, data-integration)*
4. **Persetujuan profiling CSV master** (data personal lokal) — tidak masuk repo/pipeline production. *(→ data-integration)*
5. **Kalibrasi bobot/threshold scoring** (35/25/20/10/10; <60 / 60–74 / ≥75) divalidasi terhadap sample & penilaian lead sebelum dikunci. *(→ metrics-scoring)*

## Item terbuka non-blokir (sepakati di Planning/Prototype)
- Jam kerja standar 08.00–17.00 / 8 jam — seragam lintas talent/klien?
- Jumlah talent aktif & jumlah lead penilai (perlu schema profiling).
- Angka target sukses terukur (mis. waktu siapkan deck X→Y jam).
- Format deck final (PDF presentasi vs .pptx editable vs Google Slides).
- Budget proyek (ROM indikatif ada di `tech-stack.md`; presisi menunggu sample volume AI).

## Urutan build yang disarankan (setelah freeze)
1. **platform-compliance** (auth/RBAC/audit/secret) — fondasi semua modul.
2. **data-integration** (ingestion + quality) — pasok data mentah.
3. **identity-mapping** (registry kanonik) — *butuh keputusan join key #1*.
4. **metrics-scoring** (metrik + skor) — *butuh cost rate #2 & kalibrasi #5*.
5. **ai-insight** (diagnosis/narasi bertraceability).
6. **approval-workflow** (gerbang human-in-the-loop).
7. **monthly-report** (deck + pemisahan internal/client).
8. **internal-dashboard** (penyaji read-only) — dapat berjalan paralel begitu endpoint sumber tersedia.

## Permintaan ke CTO (Gerbang 2)
- Putuskan BLOKIR #1–#5; sesuaikan `contract/foundation.draft.md` bila perlu.
- **Freeze** kontrak: isi blok `Di-freeze`, rename `foundation.draft.md` → `foundation.frozen.md`, tag git. Setelah itu read-only (R4).
- Setujui rekomendasi `tech-stack.md` (atau revisi) sebelum implementasi.

---
*Nafanesia — Planning handoff (mengikuti pola Template Output v1.0)*
