# Blueprint — Data Integration

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md.
-->

```
Unit       : Data Integration
Level      : module
Depends-on : Foundation Contract (INGESTION_RUN, DATA_QUALITY_FLAG, UTILIZATION_RECORD, DELIVERY_RECORD) · [[platform-compliance]]
```

## Pendekatan teknis
- **Worker terjadwal** (BullMQ + Redis atau cron) dengan satu job per `(source, period)`; orchestrator menjadwalkan ketiga sumber.
- **Adapter per sumber** dengan antarmuka seragam (`fetch(period) → normalized records + raw quality signals`): `GsheetAdapter`, `JiraAdapter`, `ClockifyAdapter`. Memisahkan detail API tiap sumber dari pipeline.
- **Idempotensi** lewat upsert berbasis natural key `(source, period, external_id)`; run baru menandai run lama sebagai superseded, tidak menghapus jejak.
- **Quality profiler** memeriksa record ter-normalisasi terhadap aturan (kelengkapan identitas, rentang jam wajar, assignee tiket) → `DATA_QUALITY_FLAG`.
- **Opsi worker Python** (pandas) hanya bila profiling/volume jadi berat (lihat `spec/tech-stack.md`); default TypeScript.

## Data yang disentuh
- **Menulis (owner):** `INGESTION_RUN`, `DATA_QUALITY_FLAG`. **Menulis (produksi data mentah):** `UTILIZATION_RECORD`, `DELIVERY_RECORD` (field `source_run_id` menunjuk run).
- **Handoff:** baris master talent + external id → dikonsumsi [[identity-mapping]] (modul ini tidak memutuskan mapping kanonik).
- Definisi entitas dari Foundation Contract — tidak diulang.

## Interface / API unit
Rujuk Foundation Contract:
- `POST /ingestion/runs` — `{ source, period }` (admin) → `{ run }`; aman diulang (idempoten).
- `GET /ingestion/runs?source=&period=` → daftar run.
- `GET /ingestion/runs/{id}` → `{ run, quality_flags }`.
- **Mengonsumsi (eksternal, read-only):** Google Sheets API, Jira REST API (search issues per project/period), Clockify API (time entries/reports per workspace/period).

## Komponen reusable
- Pola **adapter sumber + retry/backoff + rate-limit** dan **quality profiler** berpotensi generik → tandai untuk `shared-library/` setelah stabil.
- Memakai `getSecret()`, audit, RBAC dari [[platform-compliance]].

## Alur utama
1. Scheduler memicu job `(source, period)` (atau admin via `POST /ingestion/runs`).
2. Buat `INGESTION_RUN` status `running`.
3. Adapter ambil data dari sumber (read-only, paginasi, hormati rate limit), normalisasi ke entitas internal.
4. Upsert idempoten per natural key; hitung jumlah record.
5. Quality profiler hasilkan `DATA_QUALITY_FLAG`; isi `quality_summary`.
6. Set status `success`/`partial`/`failed`; catat audit.

## Edge cases & error handling
- **Sumber down / rate-limited:** retry+backoff; bila tetap gagal → run `failed`, sumber lain tetap jalan (isolasi).
- **Sukses parsial** (sebagian halaman gagal): status `partial`, flag eksplisit, tidak mengklaim data lengkap.
- **Record tanpa identitas mappable:** simpan + `DATA_QUALITY_FLAG severity=block` per talent agar tidak masuk skor.
- **Jam ekstrem/nol, tiket tanpa assignee, periode kosong:** `warn`/`block` sesuai aturan.
- **Re-run periode yang sudah ada:** upsert menggantikan, tidak menduplikasi; run lama ditandai superseded.
- **Credential hilang/invalid:** gagal cepat dengan pesan tanpa membocorkan nilai.

## Rencana uji
- Unit: normalisasi tiap adapter (fixture API), idempotensi upsert, aturan quality profiler, redaksi secret.
- Integrasi: run end-to-end dengan mock API → record + flags + status; re-run tidak menduplikasi; kegagalan satu sumber terisolasi.
- Keamanan: tidak ada secret/PII di log; read-only (tidak ada panggilan tulis ke sumber). Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Secret hanya via secret manager (`JIRA_*`, `CLOCKIFY_API_KEY`, kredensial Google); rotasi credential exposed sebelum production; read-only ke sumber; minimisasi data ditarik; audit trigger & akses; tidak ada PII/secret di log/report; CSV master lokal tidak masuk repo/pipeline.

---
*Nafanesia — Template Blueprint v1.0*
