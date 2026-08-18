# Blueprint — Monthly Report

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md & spec/tech-stack.md.
-->

```
Unit       : Monthly Report
Level      : module
Depends-on : Foundation Contract (MONTHLY_REPORT, REPORT_ITEM, INSIGHT, PERFORMANCE_SCORE) · [[ai-insight]] · [[metrics-scoring]] · [[approval-workflow]] · [[platform-compliance]]
```

## Pendekatan teknis
- **Composer** merakit `REPORT_ITEM` per section dari konten approved (insight + skor agregat); tiap item membawa `client_visible` & `audience`.
- **Dua jalur render:** internal (lengkap) vs client (hanya `client_visible=true`). Filter client diterapkan **di server** saat ekspor — bukan disembunyikan di UI.
- **Deck-gen:** MVP = templated HTML → PDF (Puppeteer); opsi pptxgenjs / Google Slides API bila perlu .pptx editable (lihat `spec/tech-stack.md`).
- **Export gate:** ekspor memanggil pengecekan status `approved` dari [[approval-workflow]] sebagai invariant.

## Data yang disentuh
- **Menulis (owner):** `MONTHLY_REPORT`, `REPORT_ITEM`.
- **Membaca:** `INSIGHT` (approved), `PERFORMANCE_SCORE`/metrik.
- **Bergantung status:** transisi & gate dari [[approval-workflow]]. Definisi entitas dari kontrak — tidak diulang.

## Interface / API unit
Rujuk Foundation Contract:
- `POST /reports/generate` `{ period, scope }` → `{ report }` (draft).
- `GET /reports?period=&status=` · `GET /reports/{id}` → `{ report, items }`.
- `GET /reports/{id}/export` → file (pdf/pptx) — **hanya jika `approved`**; menerapkan filter `client_visible` untuk audience client.

## Komponen reusable
- **Deck/PDF renderer dari template** + **report composer** → kandidat `shared-library/` & template ke `design-system/` (house style deck Nafanesia). Tandai untuk promosi.
- Memakai gate approval, RBAC, audit dari modul terkait.

## Alur utama
1. `POST /reports/generate` → buat `MONTHLY_REPORT` draft + `REPORT_ITEM` dari konten approved (default item internal).
2. Reviewer/analyst menandai item `client_visible` yang layak.
3. Report disubmit & di-approve ([[approval-workflow]]).
4. `GET /reports/{id}/export`: cek `approved` → render (internal lengkap / client hanya `client_visible`) → file deck.
5. Tandai `published`, catat audit ekspor.

## Edge cases & error handling
- **Ekspor sebelum approved** → 409 (gate).
- **Item tanpa tanda client_visible** → default tidak masuk deck client (fail-safe).
- **Konten sumber belum approved** (insight masih `generated`) → tidak dimasukkan / report tidak bisa di-finalize.
- **Scope kosong / periode tanpa data** → report kosong ditandai jelas, bukan deck menyesatkan.
- **Format ekspor tidak didukung** → 422.

## Rencana uji
- Unit: composer (mapping konten→item), filter client (internal-only tidak bocor), gate ekspor, default fail-safe.
- Integrasi: generate→approve→export menghasilkan deck; export client menyaring internal; export sebelum approve ditolak.
- Keamanan: tidak ada konten internal di deck client; audit ekspor; RBAC. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Pemisahan internal/client ditegakkan server-side (default tidak client-visible); ekspor approved-only; audit setiap ekspor; tidak ada pengiriman otomatis ke client; tidak ada PII/konten sensitif bocor ke deck client.

---
*Nafanesia — Template Blueprint v1.0*
