# Tech Stack — Hitopia Monitoring & Monthly Report

<!--
  Output: Planning Agent (Fase 02), tingkat PROJECT. Keputusan teknologi & konvensi (Owner: CTO).
  Rekomendasi; keputusan final & pinning versi oleh CTO sebelum freeze kontrak.
-->

```
Proyek : Hitopia Monitoring & Monthly Report
Status : draft (rekomendasi Planning — perlu persetujuan CTO)
```

## Prinsip pemilihan
1. **Read-only + scheduled integration + scoring + AI reporting** → web analytics app dengan worker terjadwal.
2. **Privasi & audit kelas-PDP** sebagai default arsitektur, bukan tambahan.
3. **Satu bahasa lintas-stack** (TypeScript) untuk studio kecil → velocity & konsistensi, dengan opsi worker Python
   bila profiling/scoring data jadi berat.
4. **Specs-as-code + reuse** sejalan house style Nafanesia (design-system/ & shared-library/).

## Rekomendasi stack
| Lapis | Pilihan | Alasan singkat |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** | UI-First loop cepat; prototype → produk; selaras house style. |
| Charting | **Recharts** (atau visx untuk viz kompleks) | Dashboard metrik/skor read-only. |
| Backend/API | **Node.js + TypeScript (NestJS atau Fastify)** REST | Kontrak API jelas; modular per domain; mudah di-review beda keluarga. |
| Worker/jobs | **BullMQ + Redis** (atau cron terjadwal) | Ingestion bulanan idempoten, retry, backoff per sumber. |
| Database | **PostgreSQL + Prisma** | Relasional pas ERD; row-level access, enkripsi kolom, audit. |
| AI | **Anthropic Claude via SDK resmi** | Insight/diagnosis/narasi/deck — lihat bagian Model AI. |
| Deck-gen | **Templated HTML → PDF (Puppeteer)** untuk MVP; **pptxgenjs** / **Google Slides API** bila perlu .pptx editable | Deck client-ready dari konten approved. |
| Auth | **Auth.js (NextAuth) Google OAuth, dibatasi domain org** | Tim pakai Google Workspace; SSO internal-only + RBAC. |
| Secret | **Secret manager / env terenkripsi** (mis. Doppler / cloud secret manager) | R8 — tak pernah di repo/log/report. |
| Hosting | **Vercel (FE)** + **Railway/Render/Fly (BE+worker)** + **managed Postgres (Neon/Supabase/RDS)** | Operasional ringan untuk venture internal. |
| Observability | **Structured logging + audit table + error tracking (Sentry)** | R6 auditability; redaksi data sensitif di log. |

> **Opsi Python worker** (FastAPI / pandas) khusus untuk **schema profiling CSV multi-row header** & kalibrasi
> scoring bila beban data tinggi. Default tetap TypeScript; eskalasi ke worker Python hanya bila terbukti perlu.

## Model AI (pin eksplisit — selaras AGENTS.md & cutoff terbaru)
| Fungsi | Model | Catatan |
|---|---|---|
| Narasi executive summary & insight signature (kualitas tinggi) | **`claude-opus-4-8`** | Default; ~$5/$25 per 1M token; konteks 1M, output s.d. 128K (stream untuk output besar). |
| Diagnosis & rekomendasi batch (volume bulanan) | **`claude-sonnet-4-6`** | ~$3/$15; turunkan biaya untuk batch banyak talent. |
| Klasifikasi/normalisasi ringan (mis. flag rubric, ekstraksi) | **`claude-haiku-4-5`** | ~$1/$5; tugas sederhana & cepat. |
| Eskalasi sistem kompleks | **`claude-fable-5`** | Hanya bila eksplisit diperlukan (penalaran berat); biaya di atas Opus. |

**Praktik pemakaian AI (guardrail teknis untuk ai-insight):**
- **Structured outputs** (`output_config.format` JSON schema) untuk memaksa insight membawa **field referensi sumber**
  (talent_id, periode, metrik yang dirujuk) → traceability & anti over-claim. Jangan pakai assistant-prefill (400 pada model 4.6+/Fable).
- **Adaptive thinking** (`thinking: {type:"adaptive"}`) + `effort` sesuai kompleksitas.
- **Batches API** (50% biaya) cocok untuk generasi insight bulanan banyak talent (non-latency-sensitive).
- **Prompt caching** untuk prefix stabil (instruksi + konteks scoring) yang dipakai lintas talent.
- **Citations / file input** untuk menautkan narasi ke ringkasan data sumber bila relevan.
- Semua output AlI **wajib lewat approval manusia** sebelum client-facing (lihat [[approval-workflow]]).
- **Tidak ada secret** di prompt/log/report; data sensitif diminimalkan dalam konteks model (kirim agregat, bukan PII mentah jika cukup).

## Konvensi (selaras Foundation Contract)
- **ID:** UUID v4. **Timestamp:** ISO-8601, UTC. **Periode bulanan:** string `YYYY-MM`.
- **Error API baku:** `{ "error": { "code", "message", "details" } }` + HTTP status.
- **Pagination:** `?page=&limit=`, respons `{ data, meta:{page,limit,total} }`.
- **Auth:** bearer/session; semua endpoint butuh auth kecuali login; RBAC ditegakkan server-side.
- **Penamaan:** kode `camelCase`/`PascalCase` (TS), tabel/kolom `snake_case`.
- **Test:** unit + integrasi; lint + type-check + security scan = gerbang CI (R3).

## Keamanan & kepatuhan teknis (Gerbang 3)
- Enkripsi data sensitif at rest (kolom PII/skor/lead/insight); TLS in transit.
- RBAC + row-level authorization; audit log immutable untuk akses/aksi material.
- Retensi & hak subjek data (akses/koreksi/hapus) terimplementasi (lihat [[platform-compliance]]).
- Credential eksternal hanya via secret manager; rotasi credential exposed sebelum production.

## Rough order of magnitude (indikatif — bukan komitmen)
- Infra venture internal kecil: hosting FE/BE/DB + Redis pada tier rendah → biaya bulanan **rendah**.
- Biaya AI didominasi generasi bulanan; gunakan Sonnet/Batches + caching untuk menekan. Estimasi presisi
  menunggu sample volume talent & panjang prompt (re-baseline via token counting saat build).

## Open questions teknis
- Mekanisme **secret manager** final & proses rotasi.
- Sumber & format **cost rate** (memengaruhi model data Efficiency/budget burn).
- Kelayakan & kebijakan **profiling CSV** master (data personal) sebelum integrasi Sheet.
- Format deck final yang disepakati client (PDF presentasi vs .pptx editable vs Google Slides).

---
*Nafanesia — Tech Stack Doc (mengikuti pola Template Output v1.0)*
