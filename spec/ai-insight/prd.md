# PRD — AI Insight

<!--
  Output: Planning Agent (Fase 02). Diagnosis/narasi/rekomendasi AI dengan traceability + guardrail.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : AI Insight
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Menghasilkan **insight AI** per talent/periode: **diagnosis penyebab** low-performance, **narasi**, dan
**rekomendasi** perbaikan — yang **setiap klaimnya menunjuk data sumber** (skor/metrik/periode) sehingga dapat
ditelusuri dan **tidak over-claim**. Insight bersifat **decision-support** dan **wajib lewat review manusia**
sebelum client-facing. Modul ini tidak menghitung angka (itu metrics-scoring) — ia menafsirkannya dengan guardrail.

## Kebutuhan (user stories)
- Sebagai **analyst internal**, saya ingin diagnosis penyebab (under-utilization, overtime+output rendah, ticket aging/overdue, blocker, skill mismatch, workload, koordinasi) — bukan sekadar label — agar paham *kenapa*.
- Sebagai **analyst**, saya ingin tiap klaim insight menautkan ke metrik/periode sumbernya, agar bisa diverifikasi & tidak over-claim.
- Sebagai **reviewer**, saya ingin insight datang sebagai draft yang bisa saya review/approve, agar narasi sensitif tidak langsung dipakai.
- Sebagai **management**, saya ingin narasi executive summary berkualitas untuk ringkasan, agar deck enak dibaca.
- Sebagai **DPO**, saya ingin model hanya menerima data minimal yang relevan (bukan PII mentah berlebih) & tidak ada secret di prompt, agar patuh.

## Functional requirements
F1. Untuk tiap talent berisiko/periode, hasilkan `INSIGHT` berisi: `diagnosis` (penyebab + bobot), `narrative`, `recommendations`.
F2. Output AI **terstruktur** (JSON schema) dan **wajib** membawa `source_refs` (talent_id, periode, metrik/skor yang dirujuk) — traceability.
F3. Insight **tidak boleh memuat angka/klaim yang tidak bersumber** dari data yang diberikan (anti-hallucination guardrail).
F4. Insight default berstatus `generated` → masuk alur review ([[approval-workflow]]); tidak otomatis client-facing.
F5. Catat `model_id` yang dipakai per insight (auditability & reproduksibilitas relatif).
F6. Konteks model **diminimalkan**: kirim agregat/skor relevan, hindari PII mentah berlebih; **tidak ada secret** di prompt/log/report.
F7. Generasi insight bisa **batch** per periode untuk banyak talent (efisiensi biaya) lewat job async.
F8. Endpoint: `GET /talents/{id}/insights?period=`, `POST /insights/generate` (admin/analyst → `{ jobId }`).

## Non-functional
- **Traceability:** 100% klaim numerik dalam insight punya `source_refs`; klaim tanpa sumber ditolak/ditandai.
- **Determinisme relatif:** prompt + data + model_id tercatat agar hasil dapat ditinjau ulang.
- **Biaya terkendali:** pakai model sesuai tugas (Sonnet untuk batch, Opus untuk narasi signature), batches + caching (lihat `spec/tech-stack.md`).
- **Latency:** generasi async (job), bukan blocking request.

## Acceptance criteria
- Insight menghasilkan diagnosis + narasi + rekomendasi terstruktur dengan `source_refs`.
- Tidak ada angka/klaim tanpa sumber; output non-skema ditolak.
- Insight default `generated` (tidak client-facing) sampai di-approve.
- `model_id` tercatat; tidak ada secret/PII mentah berlebih di prompt/log.
- Detail tegas di `spec/ai-insight/acceptance.test`.

## Dependencies
- **Foundation Contract** — `INSIGHT` (+ membaca `PERFORMANCE_SCORE`, metrik).
- [[metrics-scoring]] — sumber skor/metrik yang ditafsirkan.
- [[approval-workflow]] — review/approve insight sebelum client-facing.
- [[platform-compliance]] — RBAC, audit, secret, minimisasi data.
- Eksternal: Anthropic Claude via SDK (lihat `spec/tech-stack.md` → Model AI).

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Narasi atas performa individu rawan over-claim & menyentuh data sensitif. Wajib:
human-in-the-loop sebelum client-facing, traceability anti over-claim, minimisasi data di konteks model,
tidak ada secret di prompt/log, audit generasi insight, framing decision-support.

## Out of scope
- Perhitungan metrik/skor → [[metrics-scoring]].
- Perakitan/ekspor deck → [[monthly-report]].
- Keputusan approve/reject → [[approval-workflow]] (modul ini hanya menghasilkan draft).
- Fine-tuning/penyimpanan data ke pihak ketiga di luar pemanggilan API resmi.

## Open questions
1. **Pemetaan sinyal → diagnosis** yang disepakati (aturan/rubric agar diagnosis konsisten, bukan bebas).
2. **Ambang "talent berisiko"** yang memicu generasi insight (semua talent vs hanya flagged?).
3. **Bahasa & gaya** narasi (Indonesia/Inggris; nada untuk client vs internal).
4. **Kebijakan data ke model** (boundary PII apa yang boleh masuk konteks) — perlu keputusan DPO.

---
*Nafanesia — Template PRD v1.0*
