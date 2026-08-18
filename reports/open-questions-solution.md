# Solusi Open Questions - Hitopia Monitoring & Monthly Report

```
Input   : reports/ui.md (D1-D10), spec/prd.md, spec/<modul>/*, contract/foundation.frozen.md
Status  : Paket rekomendasi keputusan; belum menggantikan approval manusia/CTO/DPO
Tanggal : 2026-06-15
```

## Prinsip keputusan

- Jangan ubah `contract/foundation.frozen.md` langsung. Bila ada dampak kontrak, buat change request setelah CTO/DPO setuju.
- Skor adalah decision-support, bukan vonis. Missing-data tidak boleh diam-diam menjadi nilai 0 atau angka netral palsu.
- Untuk MVP, utamakan keputusan yang membuat dashboard aman dipakai internal; ekspor client tetap harus approved-only dan fail-closed.
- Data pribadi/performa individu tetap Gerbang 3: wajib review manusia, audit, minimisasi, dan kebijakan DPO.

## Rekomendasi ringkas

| ID | Keputusan yang disarankan | Dampak ke UI/implementasi |
|---|---|---|
| D1 | Finance menjadi sumber kanonik `COST_RATE`; rate per-talent override, fallback per-role; IDR; hourly; effective-dated. Budget allocation berbasis planned allocation, bukan `budget / jumlah talent`. | `Budget burn` final bila rate + allocation tersedia; jika tidak, tampil `Tidak tersedia` dan jangan masuk skor final. |
| D2 | Google Sheet tetap master talent, tapi wajib punya `talent_code` immutable + work email. Jira/Clockify dipetakan dengan verified external id; exact unique email atau manual verification = high confidence. | Talent tanpa mapping verified Jira+Clockify untuk periode menjadi `not_scorable`; fuzzy match hanya masuk queue unresolved. |
| D3 | Default bobot/threshold prototype boleh jadi config v0, tetapi config v1 hanya dikunci setelah kalibrasi sample 2-3 periode dengan lead. | UI tetap support versioning; label v0 sebagai "prototype/unvalidated" sampai v1 approved. |
| D4 | Efficiency jangan berbasis jumlah tiket mentah. Gunakan throughput berbobot per role/divisi: `weighted_completed_work / productive_hours`, dibanding benchmark role. | Efficiency score menjadi role-normalized; ticket antar tim tidak dibanding langsung. |
| D5 | `target_hours` dihitung dari kalender kerja + FTE/contract schedule + leave/unavailable time. Default 8 jam/hari hanya fallback eksplisit. | Utilization final bila `target_hours` ada; jika tidak ada, status komponen `Tidak tersedia`. |
| D6 | Rubric lead final 4 dimensi dengan behavioral anchor. Jangan gunakan placeholder 65. Bila lead assessment hilang, skor menjadi provisional dan tidak client-facing. | Dashboard boleh tampil quantitative provisional; report client menunggu lead assessment atau approval eksplisit. |
| D7 | Tetapkan target MVP: coverage mapping >=95%, valid source-ref insight 100%, export client 100% approved, deck prep time turun >=60% setelah baseline cycle pertama. | Dashboard bisa menampilkan KPI produk setelah baseline M0 dicatat. |
| D8 | MVP export = PDF presentasi dari template HTML/Puppeteer. Editable PPTX/Google Slides masuk fase berikutnya bila client meminta. | Tombol export menghasilkan PDF approved-only; template deck dikunci sebelum client pilot. |
| D9 | Tambah kontrak async job: `GET /jobs/{jobId}` dengan status/progress/result/error. UI polling dulu; SSE/webhook opsional nanti. | Generate insight bisa menampilkan queued/running/partial/failed, bukan spinner tanpa kepastian. |
| D10 | Buat policy retensi + Data Subject Request (DSR) sebelum layar compliance. UI yang dibangun: admin-only queue untuk access/correction/deletion/restriction requests + retention status. | Layar D10 bisa dirancang setelah DPO menyetujui retention matrix dan proses DSR. |

## Keputusan detail

### D1. Cost rate dan budget burn

Sumber kanonik: Finance master rate card, bukan Clockify. Clockify hanya sumber jam. Bentuk data minimum:

- `scope`: `talent` atau `role`.
- `ref_id`: `talent_id` untuk override per orang, atau nama role untuk default.
- `rate_amount`: angka hourly.
- `currency`: MVP `IDR`.
- `effective_from`: tanggal mulai berlaku.
- `source`: nama file/sistem finance dan approval ref.

Resolusi rate: pakai rate per-talent bila ada; jika tidak ada, fallback ke per-role; jika keduanya tidak ada, komponen budget burn `Tidak tersedia`. Jangan isi 0.

Budget allocation sebaiknya tidak memakai `budget_proyek / jumlah_talent`. Pakai planned allocation per periode:

```
talent_budget_allocated = project_budget_period * talent_planned_hours / total_project_planned_hours
```

Jika planned hours belum ada, tampilkan `cost_incurred` saja dan tahan `burn_pct`. Untuk MVP, budget burn lebih aman sebagai metrik risiko biaya, bukan komponen yang menghukum performa individu.

### D2. Identity mapping key kanonik

Tambahkan aturan operasional berikut tanpa mengubah sumber eksternal:

1. Google Sheet adalah master identity dan wajib memiliki `talent_code` immutable, `work_email`, `full_name`, `division`, `role`, `status`.
2. `TALENT.id` internal dibuat dari registry aplikasi; `talent_code` menjadi natural key dari master Sheet.
3. Jira/Clockify mapping final hanya dari external id yang verified.
4. Auto-high confidence hanya bila exact unique match pada work email atau external id yang sudah tersedia di Sheet.
5. Fuzzy name/project overlap maksimal `medium`; tidak pernah auto-final.
6. Satu external id yang cocok ke lebih dari satu talent menjadi conflict dan wajib diselesaikan manual.
7. Multi-account diperbolehkan sebagai beberapa baris `IDENTITY_MAPPING` untuk sistem yang sama, tetapi harus verified dan diaudit.

Skorabilitas:

- Full score perlu Sheet + Jira + Clockify + project mapping verified untuk periode.
- Jika salah satu sumber utama tidak verified, talent `not_scorable` untuk client-facing.
- Untuk analisis internal, komponen yang tersedia boleh tampil sebagai diagnostic partial, tetapi tanpa final flag Healthy/Low.

### D3. Kalibrasi bobot dan threshold

Gunakan config prototype sebagai `v0_unvalidated`. Untuk `v1`, jalankan calibration gate:

- Ambil sample 2-3 periode terakhir dan minimal 20-30 talent atau seluruh talent bila populasinya kecil.
- Lead/management memberi ground-truth label: Low, Needs review, Healthy, plus alasan.
- Bandingkan output formula dengan label lead: false positive, false negative, dan kasus edge.
- Freeze v1 hanya bila mismatch penting sudah dibahas.

Baseline awal yang masih masuk akal:

- Weights: Delivery 35, Utilization 25, Efficiency 20, Overtime Health 10, Lead 10.
- Threshold: Low `<60`, Needs review `60-74`, Healthy `>=75`.
- Override: data quality `block` atau mapping missing = no score; dua sub-metrik merah dalam periode berjalan = maksimal Needs review; insight/deck client tetap butuh approval.

### D4. Definisi Efficiency

Jangan pakai jumlah tiket mentah lintas role. Formula yang lebih defensible:

```
throughput = weighted_completed_work / productive_hours
efficiency_score = clamp(100 * throughput / role_reference_throughput, 0, 120)
quality_penalty = reopened_or_overdue_penalty
final_efficiency = clamp(efficiency_score - quality_penalty, 0, 100)
```

`weighted_completed_work` sebaiknya berasal dari story point bila disiplin Jira sudah cukup. Jika belum, gunakan ticket count hanya per role/divisi dan beri label "proxy". `role_reference_throughput` diambil dari median/P60 historis per role, lalu dikalibrasi dengan lead.

### D5. Jam kerja standar dan target hours

`target_hours` harus menjadi data hasil ingestion/normalisasi, bukan asumsi UI:

- FTE default: 8 jam/hari kerja.
- Kalender: Indonesia/Jakarta untuk internal default, dengan opsi override client bila kontrak berbeda.
- Part-time/contract: pakai schedule masing-masing.
- Leave/unavailable time mengurangi target, bukan dihitung sebagai under-utilization.
- `productive_hours` harus didefinisikan sebagai jam kerja yang billable/productive menurut kebijakan Hitopia, bukan semua tracked hours.

Jika schedule atau calendar tidak tersedia, Utilization menjadi `Tidak tersedia` dan skor final menjadi provisional.

### D6. Rubric lead assessment

Gunakan rubric 1-5 dengan anchor perilaku, lalu normalisasi ke 0-100. Rekomendasi awal:

| Dimensi | Bobot | Catatan |
|---|---:|---|
| Ownership & reliability | 30 | Komitmen, follow-through, eskalasi dini. |
| Collaboration & communication | 25 | Koordinasi, clarity update, responsiveness. |
| Quality & rework | 25 | Kerapian output, defect/reopen, review feedback. |
| Growth & autonomy | 20 | Belajar, adaptasi, kebutuhan supervisi. |

Aturan missing:

- Jangan pakai placeholder netral 65.
- Jika lead belum mengisi, tampilkan `lead_missing`.
- Internal dashboard boleh menghitung `quantitative_score` dari komponen kuantitatif yang dinormalisasi ulang.
- `performance_score` final dan client-facing report ditahan sampai lead assessment masuk atau reviewer memberi override eksplisit yang teraudit.

### D7. Target terukur produk

Karena baseline deck manual belum ada, lakukan M0 baseline pada siklus pertama. Target MVP yang disarankan:

- Coverage: >=95% active talent punya mapping verified Sheet+Jira+Clockify.
- Data quality: 0 block flag pada talent yang masuk client report.
- Traceability: 100% klaim numerik insight punya `source_refs` valid.
- Approval safety: 100% export client berasal dari report approved; 0 internal-only item bocor.
- Efficiency bisnis: waktu dari data close ke draft deck turun >=60% dibanding baseline M0 pada siklus kedua.
- Review SLA internal: draft approved/rejected dalam 1 hari kerja setelah generate.

### D8. Format dan isi deck client final

Pilih PDF presentasi untuk MVP:

- Lebih aman untuk client-facing karena tidak mudah berubah setelah approval.
- Cocok dengan rekomendasi tech-stack HTML -> PDF/Puppeteer.
- Mengurangi risiko client mengedit narasi tanpa audit.

Editable `.pptx` atau Google Slides menjadi fase 2 bila ada kebutuhan eksplisit dari client. Struktur deck MVP:

1. Cover: client, periode, status approved.
2. Executive summary: 3-5 poin utama.
3. Coverage & data quality: sumber, coverage mapping, pengecualian.
4. Talent health overview: agregat flag, trend, bukan diagnosis mentah berlebihan.
5. Key risks & recommended actions: hanya item `client_visible`.
6. Appendix source notes: definisi metrik dan batasan interpretasi.

Fail-safe: `client_visible=false` secara default untuk semua report item.

### D9. Kontrak job AI insight

Kontrak saat ini hanya mengembalikan `{ jobId }`, jadi UI tidak bisa tahu progres. Usulan change request:

```
GET /jobs/{jobId}
{
  "job": {
    "id": "uuid",
    "type": "insight_generation",
    "status": "queued|running|partial|succeeded|failed|cancelled",
    "period": "YYYY-MM",
    "progress": { "total": 42, "completed": 30, "failed": 2 },
    "result_refs": [{ "type": "insight", "id": "uuid" }],
    "errors": [{ "code": "MODEL_RATE_LIMIT", "message": "redacted safe message" }],
    "started_at": "ISO-8601",
    "finished_at": "ISO-8601|null"
  }
}
```

UI MVP cukup polling tiap 2-5 detik dengan backoff. SSE/webhook tidak perlu untuk MVP.

`source_refs` final sebaiknya konsisten:

```
{
  "type": "performance_score|metric|report_item",
  "entity_id": "uuid",
  "period": "YYYY-MM",
  "field": "delivery_score",
  "value_snapshot": 72.4
}
```

### D10. Retensi dan hak subjek data

Rujukan resmi UU No. 27 Tahun 2022 menyebut hak subjek data untuk informasi, koreksi, akses/salinan, penghapusan/pemusnahan, penarikan persetujuan, keberatan atas keputusan otomatis/profiling, dan pembatasan pemrosesan. UU juga memuat prinsip bahwa data dihapus/dimusnahkan setelah masa retensi berakhir atau atas permintaan subjek data, kecuali ketentuan lain berlaku.

Rekomendasi retention matrix awal untuk approval DPO:

| Entitas | Retensi usulan | Setelah retensi |
|---|---:|---|
| Raw ingestion payload/snapshot | 13 bulan | Hapus atau agregasi anonim. |
| Utilization/delivery/budget metrics | 24 bulan | Anonimkan/pseudonimkan untuk trend. |
| Performance score & lead assessment | 24 bulan | Hapus/pseudonimkan PII; simpan agregat. |
| Insight AI & report items internal | 24 bulan | Hapus/pseudonimkan, kecuali report approved yang perlu arsip bisnis. |
| Monthly report exported | 36 bulan | Arsip terbatas atau hapus sesuai kontrak client. |
| Audit log redacted | 5 tahun | Simpan append-only; metadata tetap minim dan redacted. |

Ini bukan keputusan legal final; DPO harus menyetujui karena kebutuhan kontrak, ketenagakerjaan, atau sengketa bisa mengubah retensi.

Alur Data Subject Request (DSR):

1. Intake permintaan via email/form internal; buat nomor tiket.
2. Verifikasi identitas subjek data dan cakupan permintaan.
3. Klasifikasi: access, correction, deletion, restriction, objection, portability.
4. DPO/authorized admin menilai dasar hukum dan pengecualian.
5. Jalankan aksi: export salinan, koreksi data turunan, pembatasan pemrosesan, penghapusan/pseudonimisasi.
6. Catat audit dengan metadata redacted.
7. Beri notifikasi hasil ke subjek data.

UI D10 yang layak dibangun setelah policy:

- Admin-only `Privacy requests` queue.
- Detail request, status, due date, action checklist.
- Retention policy dashboard per entity.
- Tombol execute harus RBAC admin/DPO, confirmable, audited, dan tidak menghapus audit log.

## Open question tambahan dari PRD/planning

### Secret manager dan rotasi credential exposed

Keputusan praktis: gunakan satu secret manager sejak production pertama. Bila hosting masih campuran, Doppler paling cepat untuk MVP; bila semua infra berada di satu cloud, pakai cloud secret manager native. Credential Jira/Clockify yang pernah dibagi di chat dianggap compromised dan harus dirotasi sebelum integrasi production. Tidak ada fallback ke secret dari repo, docs, atau prompt.

### Profiling CSV master

CSV master berisi data personal. Untuk profiling, gunakan local-only atau secure workspace dengan izin eksplisit. Output yang boleh masuk repo hanya schema/quality summary yang sudah bebas PII, misalnya nama kolom, tipe data, jumlah missing, jumlah duplikat, dan contoh nilai yang disintesis.

### Definisi read-only

Tutup sebagai: read-only hanya terhadap sumber eksternal Jira/Clockify/Google Sheet. Aplikasi boleh menulis entitas internalnya sendiri: registry, mapping verification, metrics, scoring config, lead assessment, insight, report, approval, dan audit.

## Urutan eksekusi yang disarankan

1. Human gate: CTO/DPO approve paket keputusan D1, D2, D10, secret rotation.
2. Buat change request kontrak untuk D9 (`GET /jobs/{id}`) dan jika perlu field tambahan cost-rate/allocation.
3. Jalankan calibration workshop untuk D3-D6 dengan sample data nyata yang sudah disetujui.
4. Kunci template deck PDF D8 dan target MVP D7.
5. Baru lanjut implementasi backend per modul.

## Rujukan legal yang dicek

- BPK RI, UU No. 27 Tahun 2022: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022
- JDIH Komdigi, UU No. 27 Tahun 2022 full text: https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B202
