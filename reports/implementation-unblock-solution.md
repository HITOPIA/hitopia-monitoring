# Solusi Blocker Implementation - Hitopia Monitoring & Monthly Report

```
Input   : reports/implementation-blocked.md, reports/planning.md, reports/ui.md,
          reports/open-questions-solution.md, contract/foundation.frozen.md,
          spec/platform-compliance/*
Status  : Rekomendasi unblock; perlu approval manusia sebelum source implementation
Tanggal : 2026-06-15
```

## Diagnosis blocker

Implementation benar untuk berhenti. Blocker yang tersisa bukan masalah teknis murni, melainkan keputusan governance:

1. **Scope masih ambigu.** Request memakai `src/<unit>` dan `spec/<unit>` singular, sementara proyek punya 8 unit.
2. **Gerbang 3 aktif.** Semua unit menyentuh data pribadi/performa individu atau auth/RBAC.
3. **Kontrak ada di path frozen, tetapi metadata masih draft.** `contract/foundation.frozen.md` ada, tetapi header masih `Status: DRAFT` dan `Di-freeze` belum diisi.

Karena R4 melarang agent mengubah kontrak frozen, solusi bukan patch diam-diam ke contract. Solusi harus berupa keputusan orchestrator/CTO/DPO yang tercatat.

## Keputusan unblock yang disarankan

### 1. Scope implementation pertama: `platform-compliance`

Jangan mulai dengan full prototype/all-eight-units. Mulai dari:

```
Unit target : platform-compliance
Output      : src/platform-compliance/** + fondasi auth/RBAC/audit/secret yang bisa dipakai unit lain
Acceptance  : spec/platform-compliance/acceptance.test
```

Alasan:

- Ini urutan pertama di `reports/planning.md`.
- Unit lain membutuhkan auth, RBAC, audit, secret loader, redaction, dan enkripsi dari sini.
- Ia tidak membutuhkan keputusan cost rate, identity mapping key, scoring calibration, atau deck format untuk mulai.
- R5 tetap aktif, tetapi approval Gerbang 3 untuk unit ini menjadi approval paling kecil dan paling jelas.

### 2. Jangan full implementation dulu

Promote full prototype ke `src/` untuk semua 8 unit sebaiknya ditolak untuk saat ini. Dampaknya terlalu luas:

- `data-integration` butuh secret manager final, credential rotation, dan akses sumber.
- `identity-mapping` butuh join key kanonik yang sudah disarankan di `reports/open-questions-solution.md`.
- `metrics-scoring` butuh cost rate, target hours, lead rubric, dan calibration gate.
- `ai-insight` butuh contract job status.
- `monthly-report` butuh keputusan template/export.
- `platform-compliance` harus ada dulu agar semua mutasi dan akses sensitif teraudit.

### 3. Konfirmasi freeze kontrak tanpa agent mengedit kontrak

Ada dua opsi aman:

- **Opsi A, paling bersih:** CTO/manusia memperbaiki metadata `contract/foundation.frozen.md` di commit freeze terpisah:
  - `Status: FROZEN`
  - `Di-freeze: <nama CTO> · 2026-06-15 · <git tag/hash>`
  - menghapus atau merevisi catatan draft yang sudah tidak berlaku
- **Opsi B, jika kontrak tidak boleh disentuh lagi:** buat record approval di report terpisah yang menyatakan path `contract/foundation.frozen.md` adalah source of truth meskipun header stale.

Agent implementation boleh lanjut hanya setelah salah satu opsi tercatat oleh manusia/orchestrator.

## Approval record yang perlu diisi orchestrator

Tempel blok ini ke report approval atau tiket orchestrator:

```md
## Approval Implementation Pass 1

- Project: Hitopia Monitoring & Monthly Report
- Unit scope: platform-compliance
- Contract source of truth: contract/foundation.frozen.md
- Contract freeze status: approved by <nama CTO>, <tanggal>, <git hash/tag>
- Gerbang 3: approved by <nama reviewer/DPO>, <tanggal>
- Allowed Google Workspace domain(s): <domain>
- Initial admin/provisioning owner: <email/nama>
- Secret manager decision: <Doppler/cloud secret manager/env terenkripsi>
- Credential rotation: Jira/Clockify/Google/Anthropic credentials exposed are rotated before prod integration
- Retention/DSR policy: implementation may use policy draft from reports/open-questions-solution.md for non-destructive scaffolding only; destructive DSR actions require later DPO sign-off
```

Tanpa blok ini, implementation tetap harus berhenti.

## Brief untuk Implementation Agent setelah approval

```
Peran       : Implementation Agent
Unit        : platform-compliance
Model       : claude-sonnet-4-6 atau gpt-5.5 bila kompleks
Acuan       : AGENTS.md, contract/foundation.frozen.md,
              spec/platform-compliance/prd.md,
              spec/platform-compliance/blueprint.md,
              spec/platform-compliance/acceptance.test,
              spec/tech-stack.md,
              reports/open-questions-solution.md bagian D10
Output      : src/platform-compliance/** + tests
Non-goals   : data-integration, identity-mapping, scoring, AI insight, monthly report,
              real Jira/Clockify/Sheet ingestion, contract mutation
```

Implementation scope:

- Auth boundary dan domain-restricted login abstraction.
- RBAC server-side default-deny untuk role `admin|analyst|reviewer|viewer`.
- Audit log append-only service/interceptor untuk aksi material.
- Secret loader fail-closed dari secret manager/env, tanpa secret di DB/log.
- Redaction helper untuk PII/secret di log dan error.
- Encryption helper/interface untuk field sensitif.
- `GET /me` dan `GET /audit-logs` sesuai kontrak.
- Tests untuk G1-G7 pada `spec/platform-compliance/acceptance.test`.

Acceptance minimum:

- Tanpa auth -> 401 kecuali `/auth/login`.
- Viewer ke admin endpoint -> 403.
- Material action menulis audit dalam transaksi yang sama.
- Audit log tidak bisa diubah/dihapus lewat API/aplikasi.
- Secret wajib hilang -> boot fail closed.
- Tidak ada PII/secret di response, log, atau error.

## Urutan setelah pass 1

1. `platform-compliance` selesai dan direview.
2. `data-integration` hanya setelah secret manager final + credential rotation + akses sumber read-only tersedia.
3. `identity-mapping` setelah keputusan D2 dari `reports/open-questions-solution.md` disetujui.
4. `metrics-scoring` setelah D1, D3-D6 disetujui/kalibrasi.
5. `ai-insight` setelah kontrak job status D9 diputuskan atau change request diterima.
6. `approval-workflow`, `monthly-report`, dan `internal-dashboard` mengikuti setelah fondasi data siap.

## Status unblock

Belum unblocked untuk source implementation sampai approval record di atas diisi. Namun blocker scope sudah punya solusi konkret: **Pass 1 = `platform-compliance`**, bukan full prototype.
