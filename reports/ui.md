# Handoff UI — Hitopia Monitoring & Monthly Report

```
Peran    : UI Agent (Claude Code · claude-opus-4-8)
Fase     : Prototype (front-end nyata + lapisan data MOCK)
Acuan    : spec/prd.md · spec/<modul>/* · contract/foundation.frozen.md
Output   : prototype/ (Next.js App Router) + prototype/PREVIEW.md
Status   : prototype clickable selesai & ter-deploy (live); kontrak SUDAH frozen; menunggu jawaban open questions
Tanggal  : 2026-06-14 · re-verifikasi 2026-06-15
```

## Pembaruan 2026-06-15 (re-run UI agent)

- **Paket solusi open questions.** Rekomendasi keputusan untuk D1-D10 sudah dirangkum di
  `reports/open-questions-solution.md`. Statusnya **belum approval manusia/CTO/DPO** dan tidak mengubah
  `contract/foundation.frozen.md`; gunakan sebagai input Gerbang 3 / change request berikutnya.
- **Kontrak frozen.** `contract/foundation.frozen.md` → `contract/foundation.frozen.md`. Diff isi terhadap
  versi yang dipakai saat prototype dibangun: **identik** (pure rename). Prototype tetap **100% valid**;
  tidak ada perubahan skema yang perlu diserap. Referensi `draft` di seluruh source prototype & docs sudah
  di-update ke `frozen`.
- **Build bersih.** `npm run build` (Next.js 15.5.19) sukses → static export 33 halaman (8 rute + 22 halaman
  detail talent + 404). Tidak ada error type/compile.
- **Re-deploy & verifikasi live.** URL preview (ngrok reserved domain, sama seperti sebelumnya) di-tes ulang:
  HTTP 200 di `/`, `/talents`, `/talents/{id}`, `/scoring`, `/ingestion`, `/mappings`, `/insights`,
  `/reports`, `/audit`. Lihat `prototype/PREVIEW.md`.
- **Cakupan modul lengkap.** 8 modul spec semua punya UI surface (data-integration→/ingestion,
  identity-mapping→/mappings, metrics-scoring→/scoring+detail, ai-insight→/insights, monthly-report→/reports,
  approval-workflow embedded di insights/reports, internal-dashboard→/+/talents, platform-compliance→/audit+RBAC).
  Satu layar belum dibuat **karena terblokir kebijakan** (bukan terlewat): data-subject rights & retensi
  (lihat **D10**) — perlu kebijakan dulu, tidak diasumsikan.
- **Tidak ada extend UI baru.** Sesuai instruksi (`src/` masih kosong → prototype sebagai deliverable;
  tidak ada perubahan kontrak/spec yang menuntut layar baru selain D10 yang masih terblokir).

## Ringkasan

Prototype adalah **front-end produksi-grade yang nyata** memakai stack proyek
(Next.js App Router + TypeScript + Tailwind + Recharts) dengan **lapisan data MOCK**
yang persis mengikuti `contract/foundation.frozen.md` (ERD + kontrak API). Klien bisa
mencoba seluruh alur langsung di browser tanpa backend.

Prinsip arsitektur penting: UI hanya berbicara ke **satu boundary** (`lib/api/client.ts`).
Dalam mode mock, boundary itu memanggil `lib/api/server.ts` (tabel rute yang mencerminkan
kontrak). Mengganti ke backend nyata = set `NEXT_PUBLIC_API_BASE` → call site UI **tidak
berubah satu baris pun** karena bentuk datanya identik dengan kontrak. Tidak ada backend
nyata, tidak ada panggilan Jira/Clockify/Sheets, tidak ada secret, tidak ada orang nyata.

### Yang sudah bisa dicoba (dipetakan ke functional requirements)
- **Dashboard read-only** (F11): distribusi flag, rata-rata per divisi, kualitas data, daftar
  "needs attention", pipeline reporting. Skor diturunkan dari metrik (bukan hard-code) → drill-down traceable.
- **Talent roster + detail** (F4, F6, F8): breakdown skor per sub-metrik dengan formula,
  metrik sumber, insight + referensi sumber per talent.
- **Identity mapping** (F2): daftar mapping belum terselesaikan + aksi verifikasi (RBAC-gated).
- **Data integration / ingestion** (F1, F3): riwayat run per sumber/periode, quality flags,
  trigger ingestion idempoten (admin), status `partial/failed`.
- **Scoring config** (F6, F7): bobot & threshold, **berversi**, edit admin dengan validasi (jumlah bobot = 100).
- **AI insights** (F8, F10): diagnosis + narasi + rekomendasi + `source_refs`; alur generate → submit → approve/reject.
- **Monthly reports** (F9, F10): draft → in_review → approved/published; **pemisahan internal vs client**
  (`client_visible`) dan **gerbang ekspor** (ekspor diblok kecuali sudah approved).
- **RBAC + audit log** (F12): 4 peran (admin/analyst/reviewer/viewer), aksi material tercatat di audit log,
  audit view admin-only. Aksi di-pre-disable di UI dengan penjelasan; otoritatif tetap server-side.
- **Privasi by design (visual)**: konten sensitif/internal diberi penanda visual (hatch) agar
  "bukan untuk mata klien" terbaca sekilas.

> **Catatan penting untuk semua pembaca:** semua angka di prototype adalah **fixture deterministik**
> dan **formula skoring/efisiensi bersifat ilustratif** (lihat `lib/scoring.ts`, `lib/mock/seed.ts`).
> Angka **bukan** representasi performa orang sungguhan dan **belum** dikalibrasi.

---

## Kebutuhan data yang KURANG / belum pasti (untuk orchestrator & Planning)

Saat membangun UI, beberapa kebutuhan data tidak bisa dipenuhi dari kontrak draft + spec saat ini.
Untuk tiap item: **dampak ke UI**, **asumsi sementara yang dipakai prototype**, dan **yang dibutuhkan**.
Item ini sebagian besar memetakan langsung ke `spec/prd.md → Open questions`.

### D1. Cost rate untuk budget burn — BLOKIR (≙ Open Question #2)
- **Dampak UI:** kartu/kolom *Budget burn* hanya bisa terisi bila ada `COST_RATE`. Untuk role yang
  tidak punya rate (di seed: **Data Analyst, Data Engineer**), UI menampilkan **"tidak tersedia"**
  secara eksplisit — sengaja **tidak diasumsikan/diisi 0** agar tidak menyesatkan.
- **Asumsi sementara:** rate per-**role** (IDR), efektif sejak 2026-01-01, dari "Finance master rate card".
  Alokasi budget per talent diprototype-kan = `budget_proyek / 14` (angka arbitrer, **placeholder**).
- **Dibutuhkan:** sumber rate kanonik (per talent atau per role?), mata uang, **tanggal efektif**,
  dan **dasar alokasi budget per talent/periode** yang sah. Tanpa ini Efficiency & budget burn tidak final.

### D2. Identity-mapping key kanonik lintas-sistem — BLOKIR (≙ Open Question #1)
- **Dampak UI:** halaman *Identity mapping*, badge "unresolved" di sidebar, dan **pengecualian dari scoring**
  (talent `not_scorable`) semuanya bergantung pada definisi "match yang yakin". Saat ini UI memodelkan
  3 sistem (gsheet sebagai master + jira + clockify) dengan `confidence high|medium|low`.
- **Asumsi sementara:** gsheet = sumber kebenaran identitas; jira/clockify dicocokkan via handle/email;
  satu talent (`integrity: not_scorable`) **dikeluarkan** dari skor karena tak ada match yakin.
- **Dibutuhkan:** **kunci kanonik** yang menautkan Sheet ↔ Jira ↔ Clockify ↔ project/client, aturan
  "confident match" (apa yang membuat high vs medium vs low), dan kebijakan apa yang terjadi pada
  talent yang tak ter-map (exclude? partial score?).

### D3. Kalibrasi bobot & threshold scoring — (≙ Open Question #4)
- **Dampak UI:** seluruh flag (Low <60 / Needs review 60–74 / Healthy ≥75) dan komposit memakai
  bobot default 35/25/20/10/10. UI sudah men-support **versi config** dan **tidak retroaktif**.
- **Asumsi sementara:** dua versi config (v1 Jan, v2 Mei) — v2 hanya "recalibrate efficiency reference",
  bobot sama. Aturan tambahan **"≥2 indikator merah → jangan Healthy"** adalah nuansa buatan prototype.
- **Dibutuhkan:** validasi bobot/threshold terhadap penilaian lead nyata, dan keputusan apakah aturan
  "indikator merah" diadopsi resmi.

### D4. Definisi metrik Efficiency (reference throughput) — terkait D3
- **Dampak UI:** sub-skor Efficiency memakai `throughput = tickets_completed / productive_hours`
  dibandingkan **reference `0.075` tkt/jam** (angka buatan). Ini mendominasi flag beberapa talent.
- **Dibutuhkan:** definisi efisiensi yang disepakati (apakah berbasis tiket? story point? per-role
  berbeda?) dan **reference/benchmark** yang sah per role/divisi. "Tiket" antar tim bisa tidak setara.

### D5. Jam kerja standar / target hours — (≙ Open Question #5)
- **Dampak UI:** Utilization = `productive_hours / target_hours`; target diturunkan dari
  **hari kerja per bulan × 8 jam**. Overtime dihitung relatif ke target ini.
- **Asumsi sementara:** 8 jam/hari produktif, hari kerja 21–22/bulan, **seragam** untuk semua talent.
- **Dibutuhkan:** konfirmasi jam kerja standar — apakah seragam lintas talent/klien/part-time/contract?
  Kalender hari libur mana yang dipakai? Definisi "productive hours" vs "tracked hours".

### D6. Rubric lead assessment — (mendukung F5)
- **Dampak UI:** form/penampilan lead assessment memakai 4 dimensi buatan prototype
  (ownership 0.30 · collaboration 0.25 · quality 0.25 · growth 0.20, skala 1–5).
- **Asumsi sementara:** normalisasi rata-rata berbobot → 0–100. Bila lead belum mengisi, UI memakai
  **placeholder netral 65** untuk sub-skor lead (ditandai jelas).
- **Dibutuhkan:** rubric resmi dari para lead (dimensi, skala, bobot) dan kebijakan **bila lead tidak mengisi**
  (apakah skor lead 10% di-redistribusi? skor ditahan? di-flag "needs review"?).

### D7. Target terukur produk — (≙ Open Question #7)
- **Dampak UI:** dashboard belum menampilkan KPI terhadap **target** (mis. % talent ter-cover,
  waktu siapkan deck turun X→Y jam) karena belum ada angkanya.
- **Dibutuhkan:** target terukur dari pemilik produk agar dashboard bisa menampilkan progres vs target.

### D8. Format & isi deck client final — (≙ Open Question teknis tech-stack)
- **Dampak UI:** tombol *Export* (hanya untuk report approved) saat ini menghasilkan ringkasan slide
  berbasis `report_items` yang `client_visible`. Format file (PDF presentasi vs .pptx editable vs Google Slides)
  belum diputuskan, dan struktur/section deck yang disepakati klien belum ada.
- **Dibutuhkan:** template & section deck yang disetujui, plus format file final.

### D9. Generasi insight AI (kontrak job & status) — mendukung F8
- **Dampak UI:** `POST /insights/generate` mengembalikan `{ jobId }` (async) tapi UI belum punya
  cara memantau progres job (polling/stream/webhook) karena kontrak job belum lengkap.
- **Dibutuhkan:** kontrak status job (endpoint poll `GET /jobs/{id}`? event?), dan bentuk
  `source_refs`/`diagnosis` final agar tampilan traceability fix.

### D10. Platform-compliance (retensi & hak subjek data) — Gerbang 3
- **Dampak UI:** belum ada layar untuk **hak subjek data** (akses/koreksi/hapus) maupun kebijakan retensi
  per entitas, padahal PRD/kontrak mewajibkannya.
- **Dibutuhkan:** kebijakan retensi per entitas + alur permintaan subjek data agar layar terkait bisa dirancang.

---

## Catatan visual / design system
- `projects/hitopia-monitoring-report/design/` dan `design-system/` (root) **kosong** (hanya template),
  jadi UI mengalir sesuai kebutuhan dengan arah **editorial-analitis**: paper hangat, satu aksen petrol,
  warna semantik flag yang muted, serif display (Fraunces) + grotesk humanis (Hanken) + mono (IBM Plex)
  untuk semua angka. Lihat `app/globals.css` & `tailwind.config.ts` untuk token.
- Bila Nafanesia ingin house-style yang konsisten lintas proyek, token di prototype ini bisa diusulkan
  ke `design-system/` root via `run.sh <proyek> --promote-design` (Design Curator).

## Yang TIDAK dikerjakan (sesuai instruksi)
- Tidak membangun backend nyata. Tidak mengubah `contract/foundation.frozen.md`.
- Tidak ada integrasi nyata ke Jira/Clockify/Sheets, tidak ada secret di kode/repo.

## Rekomendasi langkah berikutnya
1. Jernihkan **D1 & D2** (BLOKIR) sebelum kontrak di-freeze — keduanya fondasi scoring.
2. Validasi **D3–D6** dengan lead/finance untuk mengunci formula & rubric.
3. Setelah kontrak frozen + jawaban tersedia: ganti `lib/api/server.ts` (mock) dengan backend nyata
   via `NEXT_PUBLIC_API_BASE` — UI siap tanpa perubahan call site.

— Detail cara menjalankan & URL preview ada di `prototype/PREVIEW.md`.
