# Blueprint — AI Insight

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md & spec/tech-stack.md.
-->

```
Unit       : AI Insight
Level      : module
Depends-on : Foundation Contract (INSIGHT, PERFORMANCE_SCORE) · [[metrics-scoring]] · [[approval-workflow]] · [[platform-compliance]]
```

## Pendekatan teknis
- **Anthropic Claude via SDK resmi.** Model per tugas (lihat `spec/tech-stack.md`): `claude-sonnet-4-6` untuk diagnosis/rekomendasi batch, `claude-opus-4-8` untuk narasi executive signature, `claude-haiku-4-5` untuk klasifikasi ringan.
- **Structured outputs (JSON schema)** memaksa setiap insight membawa `source_refs` (talent_id, periode, metrik/skor dirujuk). **Jangan** pakai assistant-prefill (incompatible pada model 4.6+/Fable).
- **Grounding ketat:** prompt hanya berisi data terstruktur (skor/metrik agregat) + instruksi; model diinstruksikan menolak mengarang angka. Validator pasca-generasi mencocokkan tiap klaim numerik ke `source_refs` yang valid.
- **Async + batch:** `POST /insights/generate` menjadwalkan job (BullMQ); Batches API + prompt caching untuk prefix stabil (instruksi + konteks scoring) lintas talent.

## Data yang disentuh
- **Menulis (owner):** `INSIGHT` (status awal `generated`).
- **Membaca:** `PERFORMANCE_SCORE` + metrik turunan dari [[metrics-scoring]] (agregat, minim PII).
- Definisi entitas dari kontrak — tidak diulang. Tidak menulis ke `MONTHLY_REPORT`/`APPROVAL`.

## Interface / API unit
Rujuk Foundation Contract:
- `POST /insights/generate` `{ period, talent_ids? }` (admin/analyst) → `{ jobId }` (async).
- `GET /talents/{id}/insights?period=` → `{ data:[Insight] }`.
- **Mengonsumsi (eksternal):** Anthropic Messages API (structured outputs, adaptive thinking, batches, caching).

## Komponen reusable
- **AI client wrapper** (structured-output enforcement, retry, caching, model routing) + **source-ref validator** → kandidat kuat `shared-library/` (dipakai lintas proyek AI Nafanesia). Tandai untuk promosi.
- Memakai `getSecret()` (API key Anthropic), audit, RBAC dari [[platform-compliance]].

## Alur utama
1. `POST /insights/generate` → job async per talent/periode (untuk talent flagged/berisiko atau daftar diminta).
2. Susun konteks minimal (skor + metrik agregat + source ids); muat prefix ter-cache.
3. Panggil Claude dengan JSON schema → diagnosis + narrative + recommendations + `source_refs`.
4. **Validasi:** tiap klaim numerik harus menunjuk `source_refs` valid; tolak/tandai bila tidak.
5. Simpan `INSIGHT` (status `generated`, `model_id`); serahkan ke [[approval-workflow]].
6. Catat audit (siapa memicu, model, periode) — tanpa PII mentah/secret.

## Edge cases & error handling
- **Model mengarang angka / output non-skema** → validator menolak; insight tidak disimpan sebagai valid (retry atau ditandai gagal).
- **Data tidak cukup** untuk talent → insight tidak dibuat / ditandai "data tidak memadai", bukan menebak.
- **Rate limit / error API** → retry/backoff; job `partial`/`failed` tercatat.
- **Talent tidak-skorable** → tidak di-generate insight.
- **Konteks terlalu besar** → ringkas agregat; jangan kirim PII mentah untuk memperbesar konteks.

## Rencana uji
- Unit: enforcement schema, validator source-ref (tolak klaim tanpa sumber), routing model, redaksi prompt (tanpa secret/PII berlebih).
- Integrasi: generate end-to-end (mock Claude) → `INSIGHT` valid + `model_id`; status awal `generated`; batch banyak talent.
- Keamanan: tidak ada secret/PII mentah di prompt/log; RBAC pada generate; audit. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Human-in-the-loop wajib (status `generated` → approval). API key Anthropic via secret manager. Minimisasi PII di konteks model (kirim agregat). Anti over-claim lewat source-ref validation. Audit generasi. Tidak ada secret/PII di log/report.

---
*Nafanesia — Template Blueprint v1.0*
