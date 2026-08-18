# Blueprint — Approval Workflow

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md.
-->

```
Unit       : Approval Workflow
Level      : module
Depends-on : Foundation Contract (APPROVAL, status INSIGHT & MONTHLY_REPORT) · [[ai-insight]] · [[monthly-report]] · [[platform-compliance]]
```

## Pendekatan teknis
- **State machine** terpusat untuk `INSIGHT` & `MONTHLY_REPORT` dengan transisi yang divalidasi server-side; transisi tidak valid ditolak.
- **Gate sebagai invariant:** aksi client-facing (ekspor deck, tandai client-visible) mengecek status `approved` — gate ditegakkan di server, bukan UI.
- **APPROVAL append-only:** tiap keputusan menambah baris (riwayat), tidak menimpa; status subjek diturunkan dari keputusan terakhir + aturan transisi.
- **RBAC pemisahan tugas:** hanya peran `reviewer`/`admin` yang boleh approve; kebijakan pembuat≠approver dapat ditegakkan (open question).

## Data yang disentuh
- **Menulis (owner):** `APPROVAL`; mengubah `status` pada `INSIGHT` & `MONTHLY_REPORT` lewat transisi terkontrol.
- **Membaca:** subjek (`INSIGHT`/`MONTHLY_REPORT`) untuk validasi transisi.
- Definisi entitas dari kontrak — tidak diulang.

## Interface / API unit
Rujuk Foundation Contract:
- `POST /reports/{id}/submit` → `in_review`.
- `POST /reports/{id}/approve` `{ comment? }` (reviewer) → `approved` + `APPROVAL`.
- `POST /reports/{id}/reject` `{ comment }` (reviewer) → dapat diperbaiki + `APPROVAL` (komentar wajib).
- Approval insight mengikuti pola sama (`subject_type=insight`).

## Komponen reusable
- **Generic approval state-machine + audit** → kandidat `shared-library/` (pola review umum lintas proyek). Tandai untuk promosi.
- Memakai guard RBAC & audit dari [[platform-compliance]].

## Alur utama
1. Analyst `submit` report → `in_review`.
2. Reviewer membuka subjek, memutuskan: `approve` / `reject` / `request_changes` (komentar).
3. Sistem tulis `APPROVAL` (immutable) + transisi status subjek.
4. Bila `approved` → gate ekspor/client-facing terbuka untuk subjek itu.
5. Catat audit setiap keputusan.

## Edge cases & error handling
- **Transisi tidak valid** (approve atas `published`/`draft` tanpa submit) → 409.
- **Reject tanpa komentar** → 422 (komentar wajib).
- **Approver = pembuat** → ditolak bila kebijakan pemisahan tugas aktif (configurable).
- **Double-approve / race** → idempoten/locking; keputusan terakhir konsisten.
- **Konten approved lalu diubah** → (kebijakan) butuh re-review; gate menutup kembali (open question).

## Rencana uji
- Unit: validasi state machine (semua transisi valid/invalid), komentar wajib saat reject, RBAC reviewer.
- Integrasi: submit→approve membuka gate ekspor; submit→reject menutup; APPROVAL immutable & terurut; pemisahan tugas.
- Keamanan: hanya reviewer/admin approve; audit tiap keputusan; tidak ada bypass gate. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Gerbang human-in-the-loop (R5): approval eksplisit sebelum client-facing, pemisahan tugas, keputusan immutable & teraudit, gate ekspor ditegakkan server-side (tidak bisa dilewati UI).

---
*Nafanesia — Template Blueprint v1.0*
