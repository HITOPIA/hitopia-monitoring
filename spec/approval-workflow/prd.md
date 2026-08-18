# PRD — Approval Workflow

<!--
  Output: Planning Agent (Fase 02). Gerbang human-in-the-loop sebelum konten client-facing.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Approval Workflow
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Menegakkan **human-in-the-loop**: insight & monthly report **wajib di-review dan di-approve** tim internal
sebelum dapat dipakai/diekspor client-facing. Ini gerbang kepatuhan inti (R5) — mencegah analisis sensitif bocor
ke client dan mencegah narasi AI over-claim dipakai tanpa pengawasan manusia.

## Kebutuhan (user stories)
- Sebagai **reviewer (management)**, saya ingin melihat insight/report berstatus draft, lalu approve/reject/minta perubahan dengan komentar, agar hanya konten layak yang lolos.
- Sebagai **analyst**, saya ingin mengirim report ke review dan tahu statusnya, agar alur jelas.
- Sebagai **sistem**, saya ingin **memblokir** ekspor/penggunaan client-facing sampai approval eksplisit ada, agar tidak ada kebocoran.
- Sebagai **DPO**, saya ingin semua keputusan approval tercatat (siapa, kapan, alasan), agar dapat diaudit.

## Functional requirements
F1. Subjek yang dapat di-review: `INSIGHT` dan `MONTHLY_REPORT` (`subject_type`).
F2. Transisi status terkontrol: `draft → in_review → approved | rejected/request_changes` (report); insight `generated → in_review → approved | rejected`.
F3. `POST /reports/{id}/submit` memindahkan report ke `in_review`.
F4. `POST /reports/{id}/approve` (reviewer) → status `approved` + entri `APPROVAL` (decision `approve`).
F5. `POST /reports/{id}/reject` (reviewer) → status kembali dapat diperbaiki + `APPROVAL` (decision `reject`/`request_changes`) dengan **komentar wajib**.
F6. **Pemisahan tugas:** keputusan approve dilakukan reviewer/management (RBAC), bukan otomatis & idealnya bukan pembuat konten.
F7. Konten **tidak dapat diekspor/dipakai client-facing** kecuali statusnya `approved` (gate ditegakkan, lihat [[monthly-report]]).
F8. Setiap keputusan approval **immutable & teraudit** (`reviewer_id`, `decision`, `comment`, `decided_at`).

## Non-functional
- **Tidak ada bypass:** satu-satunya jalan ke client-facing adalah lewat approval; ditegakkan server-side.
- **Jejak penuh:** riwayat keputusan per subjek dapat dilihat (audit trail).
- **Idempotensi & konsistensi status:** transisi tidak valid ditolak (mis. approve atas yang sudah published).

## Acceptance criteria
- Report/insight harus `in_review` lalu `approved` sebelum bisa dipakai client-facing.
- Approve/reject mencatat `APPROVAL` immutable dengan komentar (komentar wajib saat reject).
- Reviewer ≠ otomatis; RBAC menegakkan siapa yang boleh approve.
- Ekspor client-facing diblokir kecuali `approved`.
- Detail tegas di `spec/approval-workflow/acceptance.test`.

## Dependencies
- **Foundation Contract** — `APPROVAL` (+ transisi status `INSIGHT`, `MONTHLY_REPORT`).
- [[ai-insight]] — sumber insight `generated`.
- [[monthly-report]] — report yang di-gate & diekspor hanya jika approved.
- [[platform-compliance]] — RBAC (peran reviewer), audit.

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Modul ini *adalah* gerbang human-in-the-loop (R5). Wajib: pemisahan tugas, approval
eksplisit sebelum client-facing, keputusan immutable & teraudit, pencegahan bypass.

## Out of scope
- Pembuatan insight → [[ai-insight]]; pembuatan/ekspor deck → [[monthly-report]].
- Penyajian dashboard → [[internal-dashboard]].
- Notifikasi eksternal (email ke client) — di luar scope MVP; deck dipakai setelah approve.

## Open questions
1. **Siapa yang berhak approve** (peran/eskalasi; apakah butuh >1 approver untuk client-facing?).
2. Apakah pembuat konten **boleh** menjadi approver (kebijakan pemisahan tugas) — keputusan tata kelola.
3. Apakah perlu **versi/re-review** otomatis bila konten approved kemudian diubah.

---
*Nafanesia — Template PRD v1.0*
