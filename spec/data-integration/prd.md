# PRD — Data Integration

<!--
  Output: Planning Agent (Fase 02). Modul ingestion read-only + data quality.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Data Integration
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Menarik data **secara terjadwal & read-only** dari tiga sumber — Google Sheets (master talent), Jira (delivery),
dan Clockify (time/utilization/overtime) — ke dalam store internal yang konsisten per periode bulanan, sambil
**memprofil & menandai kualitas data**. Ingestion harus **idempoten** dan tahan kegagalan parsial agar menjadi
fondasi data yang andal untuk identity-mapping & scoring (mengatasi risiko #1 "garbage-in").

## Kebutuhan (user stories)
- Sebagai **analyst internal**, saya ingin data Sheet/Jira/Clockify tertarik otomatis per periode tanpa entri manual, agar konsisten dan hemat waktu.
- Sebagai **admin**, saya ingin memicu ulang ingestion satu sumber/periode dengan aman (idempoten), agar bisa memperbaiki run yang gagal tanpa menduplikasi data.
- Sebagai **analyst**, saya ingin melihat ringkasan kualitas data per run (data hilang/duplikat/anomali) dan flag per talent, agar tahu data mana yang tidak layak skor.
- Sebagai **DPO/engineer**, saya ingin credential sumber hanya dari secret manager dan tidak ada write-back ke sumber, agar aman & sesuai scope read-only.

## Functional requirements
F1. Sistem melakukan ingestion **terjadwal** (default bulanan, dapat dipicu manual oleh admin) per sumber & periode.
F2. Ingestion **read-only** terhadap sumber eksternal — tidak ada operasi tulis/ubah ke Jira/Clockify/Sheet.
F3. Setiap eksekusi tercatat sebagai `INGESTION_RUN` dengan status (`pending|running|success|partial|failed`), jumlah record, dan ringkasan kualitas.
F4. Ingestion **idempoten** per `(source, period)`: menjalankan ulang menggantikan/menandai run lama, tidak menduplikasi record.
F5. Kegagalan satu sumber **tidak merusak** data sumber/periode lain (isolasi per run); mendukung retry/backoff.
F6. Sistem memprofil kualitas data dan menghasilkan `DATA_QUALITY_FLAG` (severity `info|warn|block`) — mis. record tanpa identitas yang bisa dipetakan, jam tracking nol/ekstrem, tiket tanpa assignee.
F7. Data ter-normalisasi ke entitas internal per periode: `UTILIZATION_RECORD` (dari Clockify), `DELIVERY_RECORD` (dari Jira), dan baris master talent (di-handoff ke identity-mapping).
F8. Credential sumber diambil dari secret manager/env (`JIRA_*`, `CLOCKIFY_API_KEY`, kredensial Google) — tidak pernah masuk DB/log/report.
F9. CSV master lokal **tidak** ditarik ke repo; sumber master talent adalah Google Sheets API (CSV hanya untuk profiling struktur bila disetujui — di luar pipeline production).
F10. Endpoint: `POST /ingestion/runs` (admin), `GET /ingestion/runs`, `GET /ingestion/runs/{id}` (run + quality flags).

## Non-functional
- **Idempotensi & keandalan:** retry dengan backoff per sumber; partial success tercatat eksplisit.
- **Rate-limit aware:** menghormati batas API tiap sumber (paginasi, throttling) tanpa gagal total.
- **Auditability:** trigger & hasil run tercatat; akses data sensitif teraudit (via platform-compliance).
- **Skala:** ratusan talent × beberapa proyek per periode — bukan beban besar; selesai dalam waktu wajar.

## Acceptance criteria
- Ketiga sumber tertarik otomatis per periode tanpa entri manual; tidak ada write-back ke sumber.
- Menjalankan ulang `(source, period)` tidak menduplikasi record (idempoten).
- Kegagalan satu sumber tidak merusak data periode/sumber lain; status `partial/failed` tercatat.
- Quality flags dihasilkan & dapat dilihat per run; record yang tidak layak skor tertandai.
- Credential hanya dari secret manager; tidak ada secret di log/report.
- Detail tegas di `spec/data-integration/acceptance.test`.

## Dependencies
- **Foundation Contract** — `INGESTION_RUN`, `DATA_QUALITY_FLAG`, `UTILIZATION_RECORD`, `DELIVERY_RECORD`; konvensi periode `YYYY-MM` & idempotensi.
- [[platform-compliance]] — secret manager, RBAC (admin trigger), audit.
- [[identity-mapping]] — konsumen master talent + external id untuk registry kanonik.
- [[metrics-scoring]] — konsumen `UTILIZATION_RECORD`/`DELIVERY_RECORD`.
- Eksternal: Google Sheets API, Jira REST API, Clockify API (read-only).

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Menarik data pribadi (atribut talent) & menyentuh secret. Wajib: secret manager only,
rotasi credential exposed sebelum production, read-only ke sumber, minimisasi data yang ditarik & disimpan,
audit akses, tidak ada PII/secret di log.

## Out of scope
- Mapping identitas kanonik & verifikasi manusia → [[identity-mapping]].
- Perhitungan skor/metrik turunan → [[metrics-scoring]] (modul ini hanya menormalisasi data mentah per periode).
- Write-back / koreksi data di sumber.
- Profiling CSV master di pipeline production (CSV hanya untuk profiling struktur sekali, bila disetujui).

## Open questions
1. **Identifier yang tersedia** di tiap sumber untuk dipetakan (email? username? custom field?) — input untuk identity-mapping; perlu konfirmasi schema.
2. **Frekuensi & jendela** ingestion final (bulanan saja, atau juga mid-month refresh?).
3. **Akses & scope API** tiap sumber (Jira project keys, Clockify workspace, Sheet share) — perlu disiapkan + rotasi token exposed.
4. Definisi **kualitas data** yang memicu `block` vs `warn` — perlu kalibrasi dengan sample nyata.

---
*Nafanesia — Template PRD v1.0*
