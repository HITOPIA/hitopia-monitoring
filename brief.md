# Project Brief — Hitopia Monitoring & Monthly Report

```
Jenis    : Venture internal
Pengaju  : Denameidina / decision maker Hitopia
Tanggal  : 2026-06-14
Status   : Draft → input Gerbang 1 (Go/No-Go)
```

## 1. Masalah
Hitopia sebagai talent pool membutuhkan cara yang lebih objektif untuk memonitor performa talent dan menyusun monthly report untuk client. Data existing masih dominan kualitatif, sehingga belum menyajikan data kuantitatif yang cukup baik untuk membantu stakeholder memahami kondisi performa, budget, dan delivery.

Masalah utama yang ingin dijawab adalah siapa yang benar-benar low performance, apa penyebabnya, dan apa yang perlu diperbaiki sebelum tim Hitopia melakukan presentasi ke client.

## 2. Target User           (+ "Solusi saat ini" bila relevan)
Target user utama:

- Management Hitopia dan tim internal Hitopia yang perlu melakukan diagnosis sebelum presentasi ke client.
- Stakeholder dan jajaran manajemen client sebagai pembaca monthly report final.

**Solusi saat ini:** Data dan penilaian performa masih bersifat kualitatif, terutama dari penilaian masing-masing lead per divisi. Belum ada sistem web yang menggabungkan data Google Sheet master talent, Jira, dan Clockify menjadi insight kuantitatif serta deck final siap presentasi.

## 3. Tujuan & Metrik Sukses
**Tujuan:** Membuat web app read-only untuk monitoring internal Hitopia dan menghasilkan monthly report berbentuk slide deck final siap presentasi untuk client, berbasis data kuantitatif dan insight AI.

**Metrik sukses:**

- Tim internal Hitopia dapat melihat utilization hours, overtime, cost/budget burn, dan sinyal performa talent dalam satu dashboard.
- Sistem dapat menarik data otomatis dari Google Sheet master data talent, Jira, dan Clockify via API.
- Sistem dapat mengidentifikasi talent dengan risiko low performance berdasarkan kombinasi ticket Jira, utilization hours, overtime, budget burn, dan penilaian lead.
- Sistem dapat memberikan diagnosis penyebab low performance, seperti under-utilization, overtime tinggi dengan output rendah, ticket aging/overdue, blocker delivery, skill mismatch, workload tidak seimbang, atau koordinasi lead/client.
- Sistem dapat menghasilkan slide deck bulanan siap presentasi, dengan narasi dan rekomendasi yang dibuat AI.
- Deck dan insight dapat direview serta disetujui oleh tim internal Hitopia sebelum dipresentasikan ke client.

**Target timeline:** Fleksibel; kualitas integrasi data, scoring, dan approval internal lebih penting daripada deadline cepat.

## 4. Scope                 (In-scope & Out-of-scope, bullet)
**In-scope:**

- Web app read-only untuk dashboard monitoring internal Hitopia.
- Integrasi otomatis via API dengan Google Sheet master data talent.
- Integrasi otomatis via API dengan Jira untuk data tiket, status delivery, ticket completed, overdue, aging, dan reopened bila tersedia.
- Integrasi otomatis via API dengan Clockify untuk utilization hours, jam kerja, overtime, dan data waktu yang terkait dengan budget burn.
- Perhitungan utilization berdasarkan jam kerja standar 08.00-17.00, dengan asumsi awal 8 jam produktif per hari bila ada 1 jam istirahat.
- Performance scoring hybrid yang menggabungkan metrik kuantitatif dan penilaian lead per divisi.
- Rekomendasi scoring awal:
  - Delivery Score 35%: ticket selesai vs komitmen, ticket aging, overdue, reopened/bug ulang.
  - Utilization Score 25%: jam produktif Clockify vs target jam kerja.
  - Efficiency Score 20%: output Jira dibanding jam terpakai dan budget burn.
  - Overtime Health 10%: overtime sebagai sinyal risiko, bukan otomatis nilai bagus.
  - Lead Assessment 10%: penilaian kualitatif lead dengan rubric agar konsisten.
- Flag talent:
  - Low performance jika skor < 60, atau dua indikator merah muncul dalam dua periode berturut.
  - Needs review jika skor 60-74 atau ada mismatch seperti overtime tinggi tetapi output rendah.
  - Healthy jika skor >= 75 dan tidak ada risk flag besar.
- AI-generated insight, diagnosis, narasi, rekomendasi perbaikan, dan slide deck bulanan.
- Approval flow internal Hitopia sebelum deck digunakan untuk presentasi client.

**Out-of-scope:**

- Editing data master talent, Jira, atau Clockify dari dalam web app.
- Sistem write-back ke Jira, Clockify, atau Google Sheet.
- Payroll, pembayaran, invoice, atau transaksi uang.
- Mobile app native.
- Realtime operational alerting di luar kebutuhan monthly monitoring/reporting.
- Pengiriman otomatis deck ke client tanpa approval internal Hitopia.

## 5. Produk & Teknis       (Platform, Kebutuhan AI, Integrasi)
**Platform:** Web app.

**Kebutuhan AI:** AI agent / LLM untuk membuat insight, diagnosis low performance, rekomendasi perbaikan, narasi executive summary, dan slide deck final siap presentasi.

**Integrasi:**

- Google Sheets API untuk master data talent.
- Jira API untuk data tiket dan progress delivery. Konfigurasi via secret/env: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
- Clockify API untuk utilization hours, overtime, dan basis cost/budget burn. Konfigurasi via secret/env: `CLOCKIFY_API_KEY`.
- Export/generation slide deck untuk monthly client report.

**Preferensi stack:** Belum ditentukan. Intake/Planning perlu merekomendasikan stack yang cocok untuk web app analytics, integrasi API terjadwal, data modeling scoring, dan AI-generated reporting.

## 6. Constraint & Kepatuhan
**Budget:** Belum ditentukan.

**Kepatuhan:** Data pribadi umum dan data performa individu. Perlu memperhatikan UU PDP, pembatasan akses internal, audit trail, dan perlindungan data talent.

**Constraint lain:**

- Data bersifat read-only dari sumber integrasi untuk MVP.
- Master data talent saat discovery tersedia sebagai CSV export lokal, tetapi file berisi data talent dan tidak boleh dicopy ke repo tanpa keputusan eksplisit.
- Credential Jira dan Clockify harus disimpan di secret manager atau environment variable, bukan di repo, brief, prompt, log, atau generated report.
- Credential Jira dan Clockify yang sempat dibagikan di chat harus dianggap exposed dan sebaiknya di-rotate sebelum digunakan untuk integrasi production/MVP.
- Insight AI harus dapat direview oleh tim internal Hitopia sebelum menjadi client-facing report.
- Sistem harus membedakan antara dashboard diagnosis internal dan deck final untuk client agar analisis sensitif tidak otomatis terekspos.
- Perlu validasi kualitas data dari Google Sheet, Jira, dan Clockify karena scoring akan sangat bergantung pada konsistensi mapping talent, project, ticket, dan time entry.

## 7. Aset & Referensi
**Aset:**

- Google Sheet master data talent.
- CSV export awal master data talent: `/Users/denameidina/Downloads/2026.Database Outsource - Prodia - Talent 2026 (2).csv` (54 KB, 917 lines; tampak memiliki multi-row header sehingga perlu schema profiling saat intake).
- Jira sebagai sumber data tiket dan delivery.
- Clockify sebagai sumber data jam kerja, utilization, overtime, dan basis cost/budget burn.
- Penilaian kualitatif dari lead per divisi.

**Pembanding/inspirasi:** Belum ada report/deck existing; struktur dashboard, scoring model, dan slide deck dimulai dari nol.

## 8. Keputusan & Risiko
**Pengambil keputusan:** Denameidina sebagai decision maker utama untuk Go/No-Go dan validasi prototype. Deck/insight sebelum client presentation wajib disetujui oleh tim internal Hitopia.

**Asumsi & risiko:**

- Asumsi awal jam kerja standar adalah 08.00-17.00, dengan 8 jam produktif per hari bila ada 1 jam istirahat.
- Data Jira, Clockify, dan Google Sheet dapat diakses via API dan memiliki identifier yang bisa dimapping antar-sistem.
- CSV export awal master data talent perlu diperlakukan sebagai data personal dan hanya digunakan untuk profiling struktur/data quality bila disetujui.
- Secret/API token tidak boleh masuk ke source control atau artifact handoff. Intake perlu memeriksa mekanisme secret management sebelum koneksi API dibuat.
- Risiko utama adalah data tidak konsisten, time entry tidak disiplin, ticket Jira tidak merefleksikan kompleksitas pekerjaan, atau lead assessment terlalu subjektif.
- Risiko interpretasi: overtime tinggi bisa berarti dedication, overload, scope creep, atau inefficiency; sistem perlu memberi diagnosis, bukan hanya label buruk.
- Karena menyangkut performa individu, hasil scoring harus diposisikan sebagai decision-support untuk review internal, bukan vonis otomatis.
