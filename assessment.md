# Project Assessment Sheet — Hitopia Monitoring & Monthly Report

```
Proyek   : Hitopia Monitoring & Monthly Report
Jenis    : Venture internal
Tanggal  : 2026-06-14
Sumber   : brief.md
Status   : Menunggu Gerbang 1
```

## Ringkasan
Web app **read-only** untuk Hitopia (talent pool) yang menggabungkan tiga sumber data terpisah — Google Sheet master talent, Jira (tiket/delivery), dan Clockify (jam kerja/overtime/basis budget burn) — menjadi satu dashboard performa kuantitatif untuk tim internal, lalu menghasilkan **monthly slide deck siap presentasi** ke client lewat insight & narasi AI. Dipakai dua audiens: tim internal Hitopia untuk diagnosis low-performance sebelum presentasi, dan manajemen client sebagai pembaca deck final. Layak dilirik karena masalahnya konkret dan berulang (siklus bulanan), integrasinya terdokumentasi, dan tidak ada tool jadi yang menyatukan ketiga sumber + lead assessment menjadi satu skor performa talent bernarasi siap-client.

## Masalah & bukti
Penilaian performa talent Hitopia saat ini **dominan kualitatif** — bersumber dari penilaian lead per divisi — sehingga subjektif dan sulit dipertanggungjawabkan. Tidak ada konsolidasi data yang menjawab tiga pertanyaan inti sebelum presentasi ke client: **siapa yang benar-benar low performance, apa penyebabnya, dan apa yang perlu diperbaiki**.

Bukti/indikasi (dari brief, dinyatakan oleh decision maker Hitopia):
- Data utilization, overtime, dan cost/budget tersebar di Clockify; data delivery di Jira; identitas/atribut talent di Google Sheet — belum pernah disatukan.
- Belum ada report/deck existing; struktur dashboard, scoring, dan deck dimulai dari nol.
- Penyusunan deck bulanan ke client saat ini manual dan bergantung pada penilaian subjektif lead.

> Catatan kualitas bukti: bukti masih bersifat internal/anekdotal dari pengaju, belum ada baseline angka — namun ketiadaan baseline kuantitatif itu sendiri adalah inti masalah yang ingin dipecahkan.

## Target user
- **Primer (internal):** Management & tim internal Hitopia yang melakukan diagnosis sebelum presentasi ke client. Mereka membutuhkan view diagnostik yang lebih dalam (termasuk sinyal sensitif performa individu).
- **Sekunder (eksternal):** Stakeholder & manajemen client sebagai pembaca deck bulanan final — hanya menerima deck yang sudah di-review/approve internal.

**Perkiraan ukuran:** Ini **venture internal single-org** (Hitopia), bukan SaaS multi-client — "pasar" = ukuran talent pool Hitopia. CSV master awal berisi ~917 baris dengan multi-row header, jumlah talent aktif sebenarnya belum terverifikasi (perlu schema profiling). Jumlah lead/divisi sebagai penilai kualitatif juga belum dikonfirmasi.

## Tujuan & metrik sukses
**Tujuan:** Menyediakan monitoring internal kuantitatif atas performa talent (utilization, overtime, cost/budget burn, delivery, sinyal risiko) dan menghasilkan monthly client report berbentuk slide deck final bernarasi & rekomendasi AI, yang lebih objektif daripada penilaian kualitatif saat ini.

**Metrik:**
- Tim internal dapat melihat utilization hours, overtime, cost/budget burn, dan sinyal performa talent dalam **satu dashboard**.
- Data tertarik **otomatis via API** dari Google Sheet, Jira, dan Clockify (tanpa entri manual).
- Sistem mengidentifikasi talent berisiko low-performance dari kombinasi sinyal, dan **memberi diagnosis penyebab** (under-utilization, overtime tinggi + output rendah, ticket aging/overdue, blocker, skill mismatch, workload, koordinasi) — bukan sekadar label.
- Sistem menghasilkan **slide deck bulanan siap presentasi** dengan narasi & rekomendasi.
- Deck/insight dapat **di-review & di-approve** tim internal sebelum dipakai ke client.

> Timeline: fleksibel — kualitas integrasi data, scoring, dan approval lebih diutamakan daripada kecepatan. Metrik di atas masih kualitatif/kapabilitas; angka target terukur (mis. % talent ter-cover, waktu siapkan deck turun dari X→Y jam) belum ditetapkan dan sebaiknya disepakati di Planning.

## Scope
**In:**
- Web app read-only: dashboard monitoring internal.
- Integrasi API otomatis: Google Sheet (master talent), Jira (tiket/status/aging/overdue/reopened), Clockify (jam/utilization/overtime/basis budget burn).
- Perhitungan utilization (asumsi awal jam kerja 08.00–17.00, 8 jam produktif/hari dengan 1 jam istirahat).
- **Performance scoring hybrid** (kuantitatif + lead assessment) dengan bobot awal usulan: Delivery 35% · Utilization 25% · Efficiency 20% · Overtime Health 10% · Lead Assessment 10%.
- Flagging talent: Low (<60 / dua indikator merah 2 periode), Needs review (60–74 / mismatch), Healthy (≥75 tanpa risk flag besar).
- AI-generated insight, diagnosis penyebab, narasi, rekomendasi, dan slide deck bulanan.
- Approval flow internal sebelum deck client-facing.

**Out:**
- Editing / write-back data ke Jira, Clockify, atau Google Sheet.
- Payroll, pembayaran, invoice, transaksi uang.
- Mobile app native.
- Realtime operational alerting di luar kebutuhan monthly monitoring/reporting.
- Pengiriman otomatis deck ke client tanpa approval internal.

## Platform & kebutuhan AI
**Platform:** Web (read-only).
**AI:** Agent/LLM untuk insight, diagnosis low-performance, rekomendasi perbaikan, narasi executive summary, dan generasi slide deck final. (Pilihan model & arsitektur AI adalah ranah Planning — tidak diputuskan di sini.)

## Kelayakan teknis (kasar)
Secara umum **bisa dibangun** dengan tooling umum; ketiga API (Google Sheets, Jira, Clockify) matang dan terdokumentasi, dan generasi report/deck berbasis AI sudah lazim di pasar. Bagian tersulit & risiko teknis utama — **bukan rancangan, hanya penanda kelayakan**:
1. **Identity mapping antar-sistem.** Tidak ada join key kanonik yang dijamin: identitas talent di Google Sheet ↔ user Jira ↔ user Clockify ↔ project/client perlu dipetakan andal. Ini fondasi seluruh scoring; bila rapuh, semua angka ikut salah.
2. **Kualitas & disiplin data.** Time entry Clockify yang tidak disiplin, tiket Jira yang tidak merefleksikan kompleksitas, dan inkonsistensi mapping = garbage-in untuk skor. Perlu validasi/profiling kualitas data lebih dulu.
3. **Budget burn butuh cost rate.** Clockify memberi jam, tetapi konversi ke cost/budget burn perlu rate per talent/role yang sumbernya belum jelas di brief — perlu dikonfirmasi.
4. **CSV master multi-row header** (~917 baris) butuh schema profiling sebelum dipakai; saat ini hanya tersedia sebagai export lokal berisi data personal (belum disetujui untuk diprofil).
5. **Kalibrasi scoring model.** Bobot & threshold (35/25/20/10/10; <60, 60–74, ≥75) masih usulan awal; perlu divalidasi terhadap penilaian lead agar tidak menghasilkan vonis yang keliru.
6. **Guardrail AI.** Deck/insight client-facing harus melewati review manusia; narasi AI atas performa individu rawan over-claim dan harus dapat ditelusuri ke data sumbernya.

## Lanskap kompetitif
Komponen sejenis ada **terpisah**, tidak ada yang menutup kebutuhan utuh:
- **Resource/utilization di Jira:** Tempo, ActivityTimeline, Epicflow, Planyway (time tracking & utilization report).
- **Time/budget:** Clockify dashboard (planned vs actual, budget tracking) — sumber data, bukan produk akhir.
- **AI client reporting/deck:** Matik (presentasi data-driven berulang), RaiseReturn, plus generator deck umum (Gamma, Slidesgo, dll.).

**Celah yang diisi (alasan build, bukan buy):** tidak ada tool jadi yang sekaligus (a) menggabungkan **Google Sheet master talent + Jira + Clockify + lead assessment** menjadi satu **hybrid performance score per talent**, (b) menghasilkan **diagnosis penyebab** low-performance dan **deck client-ready bernarasi**, dan (c) menyesuaikan dengan konteks talent-pool Hitopia + approval internal & pemisahan view internal vs client. Tool pasar memecahkan potongan, bukan rantai end-to-end ini.

## Potensi & nilai
Sebagai **venture internal**, nilainya bukan profit langsung melainkan:
- **Efisiensi:** mengurangi jam tim menyiapkan deck bulanan dan diagnosis manual (industri AI-reporting mengklaim penghematan puluhan jam/bulan — indikatif, perlu validasi di konteks Hitopia).
- **Objektivitas keputusan talent:** dasar kuantitatif menggantikan penilaian subjektif untuk keputusan pembinaan/penempatan.
- **Kredibilitas ke client:** deck berbasis data meningkatkan kepercayaan & retensi client.
- **Opsi reuse:** bila terbukti, model scoring + deck-gen bisa menjadi produk/keunggulan jasa Hitopia (di luar scope MVP).

ROI diukur dari waktu & kualitas keputusan, bukan revenue. Belum ada estimasi biaya (budget belum ditentukan) — sebaiknya Planning memberi rough order of magnitude sebelum komitmen besar.

## Asumsi & risiko
**Asumsi yang harus benar:**
- Jam kerja standar 08.00–17.00, 8 jam produktif/hari (1 jam istirahat) — perlu konfirmasi apakah seragam lintas talent/klien.
- Jira, Clockify, Google Sheet dapat diakses via API dan punya identifier yang bisa di-mapping antar-sistem.
- Tersedia sumber cost rate untuk menghitung budget burn.
- CSV master boleh diprofil (struktur/kualitas) setelah persetujuan eksplisit.

**Risiko terbesar:**
- **Data tidak konsisten / time entry tidak disiplin / tiket tak merefleksikan kompleksitas / lead assessment terlalu subjektif** → skor menyesatkan. (Risiko #1.)
- **Interpretasi overtime:** bisa dedication, overload, scope creep, atau inefisiensi — sistem wajib mendiagnosis, bukan melabeli buruk otomatis.
- **Scoring sebagai vonis:** karena menyangkut performa individu, hasil harus diposisikan sebagai **decision-support untuk review internal**, bukan keputusan otomatis yang merugikan orang.
- **Kebocoran kredensial:** token Jira/Clockify yang sempat dibagikan di chat dianggap **exposed** dan harus di-rotate sebelum integrasi production/MVP.

## Kepatuhan / regulasi
🔴 **Memicu Gerbang 3 (R5) — menyentuh data pribadi & data performa individu.**
- **UU PDP:** data talent = data pribadi; skor performa individu adalah pemrosesan sensitif. Perlu dasar pemrosesan yang sah, minimisasi data, kebijakan retensi, dan menghormati hak subjek data.
- **Pembatasan akses & audit trail:** akses dashboard diagnostik internal harus dibatasi; semua akses/aksi tercatat (R6).
- **Pemisahan internal vs client:** dashboard diagnosis internal (berisi analisis sensitif) harus terpisah tegas dari deck final client agar analisis sensitif tidak otomatis terekspos ke client.
- **Human-in-the-loop:** hindari automated decision-making yang berdampak merugikan individu; insight/deck wajib di-review & di-approve tim internal sebelum client-facing.
- **Secret management (R8):** credential Jira/Clockify hanya lewat secret manager/env (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `CLOCKIFY_API_KEY`) — tidak pernah masuk repo, brief, prompt, log, atau generated report. Credential yang sudah exposed di chat **di-rotate** dulu.
- **Data personal lokal:** CSV master talent di mesin lokal tidak boleh dicopy ke repo tanpa keputusan eksplisit; gunakan hanya untuk profiling bila disetujui.

## Rekomendasi Intake
**Lanjut (Go) — dengan syarat.** Masalahnya nyata dan berulang, scope-nya jelas dan sudah dibatasi read-only, kelayakan teknis wajar, dan integrasinya terdokumentasi. Yang membuatnya layak dibangun (bukan beli) adalah rantai unik Sheet+Jira+Clockify+lead → skor hybrid → diagnosis → deck client-ready.

Syarat yang sebaiknya dijernihkan sebelum/di awal Planning:
1. **Konfirmasi identity-mapping key** antar Google Sheet ↔ Jira ↔ Clockify ↔ project/client (fondasi seluruh scoring).
2. **Tetapkan sumber cost rate** untuk budget burn.
3. **Beresi data sensitif & secret:** persetujuan profiling CSV; rotasi kredensial yang exposed; mekanisme secret manager.
4. **Frame scoring sebagai decision-support** + jalur **Gerbang 3 / kepatuhan PDP** untuk data performa individu.
5. **Validasi sample kualitas data** Jira/Clockify/Sheet sebelum mengunci bobot scoring.

Ini Go bersyarat, bukan pivot/stop — risikonya terkelola dan berada di ranah eksekusi (data quality & kepatuhan), bukan pada kelayakan dasar.

---
## Keputusan Gerbang 1  (diisi MANUSIA)
```
Keputusan : < Go | No-Go | Pivot >
Oleh      : <nama pemutus>
Tanggal   : <YYYY-MM-DD>
Catatan   : <syarat / batasan / alasan>
```

---
*Nafanesia — Template Assessment v1.0*
