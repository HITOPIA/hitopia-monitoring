# Brief Discovery Handoff — Hitopia Monitoring & Monthly Report

## Ringkasan
Brief awal sudah disusun untuk project web app read-only yang membantu Hitopia memonitor performa talent dan menghasilkan monthly report client-facing dalam bentuk slide deck final siap presentasi.

## Keputusan Utama
- Platform: web app.
- Output: dashboard internal Hitopia dan slide deck bulanan untuk client.
- Data source: Google Sheet master talent, Jira, Clockify.
- Master data talent discovery file: `/Users/denameidina/Downloads/2026.Database Outsource - Prodia - Talent 2026 (2).csv` (54 KB, 917 lines).
- Mode data: read-only dari integrasi API otomatis.
- Jira dan Clockify credential tersedia secara operasional, tetapi harus dikonfigurasi via secret/env (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `CLOCKIFY_API_KEY`) setelah rotasi.
- AI: digunakan untuk insight, diagnosis low performance, rekomendasi perbaikan, narasi, dan deck final.
- Approval: tim internal Hitopia wajib review sebelum presentasi ke client.
- Decision maker Go/No-Go prototype: Denameidina.

## Risiko yang Perlu Dibawa ke Intake
- Data menyangkut performa individu, sehingga perlu kontrol akses dan perhatian UU PDP.
- CSV master data adalah referensi eksternal berisi data personal; jangan copy ke repo tanpa keputusan eksplisit.
- CSV tampak memiliki multi-row header, sehingga schema profiling perlu dilakukan sebelum mapping final ke Google Sheet/API.
- Secret Jira/Clockify tidak boleh ditulis ke repo, prompt, log, brief, atau generated report. Karena sempat dibagikan di chat, treat sebagai exposed secret dan rotate sebelum koneksi API dibuat.
- Mapping antar Google Sheet, Jira, dan Clockify perlu divalidasi.
- Scoring low performance tidak boleh menjadi vonis otomatis; harus diposisikan sebagai decision-support.
- Overtime perlu dianalisis hati-hati karena bisa berarti overload, scope creep, dedication, atau inefficiency.

## Artefak
- `projects/hitopia-monitoring-report/brief.md`
