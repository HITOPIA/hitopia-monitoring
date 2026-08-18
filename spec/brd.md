# BRD — Hitopia Monitoring & Monthly Report

<!--
  Output: Planning Agent (Fase 02), tingkat PROJECT. Kebutuhan BISNIS (bukan teknis).
  Pendamping prd.md (produk) & tech-stack.md (teknologi).
-->

```
Proyek : Hitopia Monitoring & Monthly Report
Jenis  : Venture internal (single-org Hitopia)
Status : draft
Owner  : Product / decision maker Hitopia (Denameidina)
```

## Konteks bisnis
Hitopia adalah **talent pool**. Setiap bulan, tim internal harus menilai performa talent dan menyusun report
ke client. Saat ini penilaian **dominan kualitatif** (penilaian lead per divisi) — subjektif, sulit
dipertanggungjawabkan, dan deck bulanan disusun manual. Tidak ada konsolidasi data yang menjawab: **siapa yang
low-performance, apa penyebabnya, apa yang perlu diperbaiki**. Sebagai venture internal, nilainya bukan revenue
langsung melainkan efisiensi waktu, objektivitas keputusan talent, dan kredibilitas ke client.

## Tujuan bisnis
- **TB1.** Menggantikan dasar penilaian subjektif dengan **skor performa kuantitatif (hybrid)** yang dapat dipertanggungjawabkan.
- **TB2.** Mempercepat & menstandarkan penyusunan **monthly client report** (slide deck) bernarasi & rekomendasi.
- **TB3.** Memperkuat **kredibilitas ke client** lewat report berbasis data.
- **TB4.** Menjaga **kepatuhan PDP** & melindungi talent dari vonis otomatis yang merugikan (decision-support, bukan keputusan).

## Pemangku kepentingan
| Peran | Kepentingan | Akses |
|---|---|---|
| Management Hitopia | Pemutus akhir; reviewer/approver deck client-facing | Dashboard penuh + approval |
| Tim internal / analyst | Diagnosis low-performance sebelum presentasi | Dashboard diagnostik internal |
| Lead per divisi | Memberi lead assessment (rubric); konteks kualitatif | Input lead assessment (terbatas) |
| Stakeholder / manajemen client | Pembaca deck final | **Hanya** deck yang sudah di-approve (tidak akses sistem) |
| Admin / DPO | Kepatuhan PDP, akses, audit, secret | Administrasi & audit |

## Kebutuhan bisnis (bernomor)
- **B1.** Satu dashboard internal menyatukan utilization, overtime, cost/budget burn, delivery, dan sinyal performa per talent.
- **B2.** Data tertarik otomatis dari Sheet/Jira/Clockify (tanpa entri manual), per siklus bulanan.
- **B3.** Identifikasi talent berisiko + **diagnosis penyebab** (under-utilization, overtime tinggi + output rendah,
  ticket aging/overdue, blocker, skill mismatch, workload, koordinasi) — bukan label.
- **B4.** Skor hybrid menggabungkan kuantitatif + lead assessment, dengan bobot/threshold yang dapat dikalibrasi.
- **B5.** Monthly slide deck client-ready otomatis dengan narasi & rekomendasi AI.
- **B6.** **Approval internal wajib** sebelum insight/deck dipakai ke client; pemisahan internal vs client tegas.
- **B7.** Kepatuhan UU PDP: dasar pemrosesan sah, minimisasi, retensi, hak subjek data, audit trail, pembatasan akses.

## Nilai & metrik bisnis
- **Efisiensi:** turunnya jam tim menyiapkan deck & diagnosis manual (target X→Y jam — **disepakati di Planning**).
- **Objektivitas:** keputusan pembinaan/penempatan berdasar data, bukan kesan.
- **Kredibilitas:** deck data-driven → kepercayaan & retensi client.
- **Kepatuhan:** 0 insiden kebocoran analisis sensitif ke client; 100% deck client-facing lewat approval.
> Metrik di atas saat ini kapabilitas/kualitatif. Angka target terukur **belum ditetapkan** — wajib disepakati
> sebelum komitmen besar (selaras catatan assessment).

## Batasan & kepatuhan bisnis
- **Budget:** belum ditentukan → Planning memberi *rough order of magnitude* (lihat tech-stack.md) sebelum komitmen.
- **Read-only ke sumber eksternal:** tidak ada write-back ke Jira/Clockify/Sheet.
- **Data personal lokal:** CSV master talent tidak boleh dicopy ke repo tanpa keputusan eksplisit; hanya untuk profiling bila disetujui.
- **Secret:** credential hanya via secret manager/env; credential yang exposed di chat **di-rotate** dulu (R8).
- **Human-in-the-loop:** insight/deck client-facing wajib review & approve internal.
- **Timeline:** fleksibel — kualitas integrasi, scoring, dan approval > kecepatan.

## Risiko bisnis
- **Garbage-in:** data tidak konsisten / time entry tidak disiplin / tiket tak merefleksikan kompleksitas / lead
  terlalu subjektif → skor menyesatkan. Mitigasi: profiling kualitas data + kalibrasi + decision-support framing.
- **Salah vonis individu:** skor diperlakukan sebagai keputusan otomatis. Mitigasi: framing decision-support + Gerbang 3.
- **Kebocoran analisis sensitif ke client.** Mitigasi: pemisahan view + approval wajib.
- **Kebocoran kredensial.** Mitigasi: secret manager + rotasi.
- **Kepatuhan PDP gagal.** Mitigasi: kontrol di platform-compliance + review hukum.

## Out of scope (bisnis)
Monetisasi/SaaS multi-client (MVP); produk reuse model scoring; payroll/keuangan; pengiriman deck otomatis tanpa approval.

---
*Nafanesia — BRD (mengikuti pola Template Output v1.0)*
