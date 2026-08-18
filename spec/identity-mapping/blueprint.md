# Blueprint — Identity Mapping

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md.
-->

```
Unit       : Identity Mapping
Level      : module
Depends-on : Foundation Contract (TALENT, IDENTITY_MAPPING, PROJECT, TALENT_PROJECT) · [[data-integration]] · [[platform-compliance]]
```

## Pendekatan teknis
- **Master = Google Sheet** sebagai sumber identitas talent kanonik; Jira/Clockify hanya menyumbang external id yang ditautkan.
- **Resolver berlapis:** (1) exact match join key (mis. email org) → confidence `high`; (2) heuristik fuzzy (nama+proyek overlap) → `medium`; (3) tidak ditemukan/konflik → `low` + masuk antrian `unresolved`. Tidak ada auto-merge untuk `medium`/`low`.
- **Human-in-the-loop:** UI/endpoint verifikasi untuk mengunci mapping; keputusan immutable + teraudit.
- **Versioning:** mapping menyimpan jejak perubahan agar metrik historis menunjuk mapping yang berlaku saat itu.

## Data yang disentuh
- **Menulis (owner):** `TALENT`, `IDENTITY_MAPPING`, `PROJECT`, `TALENT_PROJECT`.
- **Membaca:** baris master + external id hasil [[data-integration]].
- **Handoff:** flag "skorable/tidak" per talent/periode → [[metrics-scoring]].
- Definisi entitas dari kontrak — tidak diulang.

## Interface / API unit
Rujuk Foundation Contract:
- `GET /talents?period=&flag=&page=&limit=` → daftar talent.
- `GET /talents/{id}` → `{ talent, mappings }`.
- `GET /mappings/unresolved` → mapping confidence rendah/konflik.
- `POST /mappings/{id}/verify` → `{ external_id }` mengunci mapping (RBAC: analyst/admin).

## Komponen reusable
- **Entity resolution / fuzzy matcher** berpotensi generik → tandai untuk `shared-library/` setelah stabil.
- Memakai guard RBAC, audit, enkripsi PII dari [[platform-compliance]].

## Alur utama
1. Setelah ingestion, bangun/refresh `TALENT` dari master Sheet (upsert per natural key).
2. Untuk tiap talent, resolver tautkan external id Jira/Clockify + project/client → `IDENTITY_MAPPING` (+confidence).
3. Mapping `high` & terverifikasi → final; `medium`/`low` → antrian `unresolved`.
4. Manusia verifikasi/tolak → mapping terkunci, tercatat, teraudit.
5. Hitung skorabilitas per talent/periode (punya mapping terverifikasi yang cukup?) → handoff ke scoring.

## Edge cases & error handling
- **Tidak ada join key** untuk seorang talent → `low`, masuk `unresolved`, tidak-skorable sampai diverifikasi.
- **Satu external id cocok ke >1 talent** (konflik) → keduanya di-flag, butuh resolusi manusia; tidak auto-pilih.
- **Talent keluar/masuk** antar periode → status `active|inactive`; mapping historis dipertahankan.
- **Master Sheet berubah** (rename/division pindah) → versi baru `TALENT`, mapping lama tetap tertelusuri.
- **Verifikasi atas mapping sudah final** → 409/penanganan idempoten.

## Rencana uji
- Unit: resolver (exact/fuzzy/konflik), perhitungan confidence, skorabilitas, versioning.
- Integrasi: alur unresolved → verify → terkunci; konflik tidak auto-merge; talent tak-termapping ditandai tidak-skorable.
- Keamanan: RBAC akses registry; audit pada verify; PII tidak bocor di response/log. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. PII talent: enkripsi at rest, RBAC ketat, minimisasi field di response, audit setiap akses & verifikasi, hak subjek data. Tidak ada PII di log/error.

---
*Nafanesia — Template Blueprint v1.0*
