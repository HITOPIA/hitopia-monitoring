# Blueprint — Internal Dashboard

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md. Merujuk contract/foundation.draft.md & spec/tech-stack.md.
-->

```
Unit       : Internal Dashboard
Level      : module
Depends-on : Foundation Contract (read endpoints) · [[metrics-scoring]] · [[identity-mapping]] · [[data-integration]] · [[ai-insight]] · [[platform-compliance]]
```

## Pendekatan teknis
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** (lihat `spec/tech-stack.md`); chart via **Recharts**.
- **Read-only client** atas endpoint kontrak; tidak ada duplikasi logika skor di frontend (angka diambil dari API, bukan dihitung ulang).
- **Server-side authz:** data sensitif difilter per peran di backend; frontend tidak menjadi satu-satunya penjaga.
- **Drill-down sebagai navigasi traceability:** skor → sub-skor → metrik sumber → insight, mengikuti `source_refs`.
- UI mengikuti `design/` proyek > `design-system/` root; komponen reusable dari `library/`.

## Data yang disentuh
- **Membaca saja** (tidak punya entity sendiri): `TALENT`, `PERFORMANCE_SCORE`, `UTILIZATION_RECORD`, `DELIVERY_RECORD`, `BUDGET_BURN`, `INSIGHT`, `DATA_QUALITY_FLAG`, `INGESTION_RUN` — via endpoint kontrak.
- Aksi tulis (lead assessment, verify mapping, approve) **didelegasikan** ke endpoint modul pemilik. Definisi entitas dari kontrak — tidak diulang.

## Interface / API unit
Mengonsumsi endpoint Foundation Contract (tidak menambah endpoint baru):
- `GET /talents`, `GET /talents/{id}`, `GET /talents/{id}/metrics`, `GET /scores`, `GET /talents/{id}/scores`, `GET /talents/{id}/insights`, `GET /ingestion/runs` (+ quality flags).
- Aksi (bila disematkan): `POST /lead-assessments`, `POST /mappings/{id}/verify`, `POST /reports/{id}/submit|approve|reject` — milik modul masing-masing.

## Komponen reusable
- **Chart kit (Recharts) + tabel skor/flag + kartu metrik + badge kualitas data** → kandidat `library/` proyek & `design-system/` root (house style dashboard analytics). Tandai untuk promosi.
- Memakai auth/RBAC dari [[platform-compliance]].

## Alur utama
1. Pengguna internal login → dashboard memuat daftar talent + skor/flag periode terpilih.
2. Filter/sort/paginate (periode, flag, divisi, project).
3. Pilih talent → detail: sub-skor, metrik sumber, budget burn, insight, penanda kualitas data.
4. Drill-down traceability skor → sumber.
5. (Opsional) lakukan aksi yang didelegasikan ke modul pemilik.

## Edge cases & error handling
- **Talent tidak-skorable / data block** → tampilkan penanda jelas, jangan render skor menyesatkan.
- **Periode tanpa data / ingestion gagal** → state kosong/peringatan, bukan nol palsu.
- **Insight belum ada / belum approved** → tampil sebagai draft internal (tidak diperlakukan final).
- **Akses tanpa peran memadai** → data sensitif tidak dikirim (server-side filter) → 403/empty sesuai kebijakan.
- **Daftar besar** → pagination + query agregat untuk hindari beban.

## Rencana uji
- Unit (komponen): rendering tabel/chart, badge kualitas/tidak-skorable, state kosong/error.
- Integrasi: data dashboard = data API (tidak hitung ulang); filter/drill-down; aksi terdelegasi memanggil endpoint benar.
- Keamanan: data sensitif hanya untuk peran berwenang (server-side); akses teraudit; internal-only. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Menampilkan data performa individu: internal-only, RBAC ditegakkan server-side, audit akses tampilan data sensitif, tidak ada jalur ke konten client tanpa approval, framing decision-support. Tidak ada PII/secret di state klien yang tak perlu.

---
*Nafanesia — Template Blueprint v1.0*
