# Preview — Hitopia Monitoring & Monthly Report (Prototype)

> Front-end **nyata** (Next.js + TypeScript + Tailwind + Recharts) di atas **lapisan data MOCK**
> yang persis mengikuti `contract/foundation.frozen.md`. Klien bisa mencoba seluruh alur langsung
> di browser. **Tidak ada backend nyata, tidak ada Jira/Clockify/Sheets sungguhan, tidak ada secret,
> tidak ada orang sungguhan** — semua angka adalah fixture deterministik & ilustratif.

> **Re-verifikasi 2026-06-15:** kontrak sudah **frozen** (`contract/foundation.frozen.md`; isi identik
> dengan draft yang dipakai saat prototype dibangun — perubahan hanya rename, jadi prototype tetap 100%
> valid). Build static export di-rebuild bersih (Next.js 15.5.19, 33 halaman) dan URL preview di bawah
> di-tes ulang **live** (HTTP 200 di seluruh rute).

## 🔗 URL preview yang bisa dibagikan

```
https://nonvalorously-illogical-gwenn.ngrok-free.dev
```

- Saat pertama membuka, ngrok menampilkan halaman peringatan "**You are about to visit …**".
  Klik **"Visit Site"** **satu kali** — setelah itu aplikasi berjalan normal (asset & navigasi lolos).
- Tunnel ini **ephemeral**: hidup selama mesin dev menjalankan proses `ngrok` + static server (lihat
  *Menyalakan ulang* di bawah). Bila URL mati, jalankan ulang atau pakai opsi hosting permanen.

> Catatan jujur: rencana awal memakai **Cloudflare quick tunnel** (`trycloudflare.com`, tanpa
> interstitial). Saat sesi ini, edge routing trycloudflare gagal me-route hostname (QUIC & HTTP/2,
> 3 hostname dicoba — request tak pernah sampai origin), jadi dipakai **ngrok** yang terbukti jalan.
> Untuk URL bersih tanpa interstitial, lihat *Opsi hosting permanen*.

## 👤 Akun demo (mock SSO — pilih peran)

Di layar masuk, pilih salah satu kartu peran. Di produksi ini adalah Google Workspace SSO
dibatasi domain org. Ganti peran kapan saja lewat menu avatar kanan-atas ("Switch role").

| Nama | Peran | Bisa apa |
|---|---|---|
| **Dewi Anggraini** | `admin` | Akses penuh — trigger ingestion, ubah scoring config, lihat audit log. |
| **Rangga Pratama** | `analyst` | Diagnosa talent, generate insight, draft & submit report, verifikasi mapping. |
| **Sari Wijaya** | `reviewer` | Review & approve/reject insight dan report client. |
| **Bima Saputra** | `viewer` | Dashboard read-only. |

> Coba bandingkan peran: aksi yang tak diizinkan akan **ter-disable dengan penjelasan** (RBAC).
> Untuk melihat **gerbang approval**: sebagai analyst submit report → sebagai reviewer approve →
> baru tombol **Export deck** aktif (ekspor diblok sebelum approved).

## 🧭 Alur yang bisa dicoba

- **Dashboard** — distribusi flag, rata-rata per divisi, kualitas data, daftar "needs attention".
- **Talent roster → detail** — breakdown skor per sub-metrik **dengan formula & metrik sumber**
  (traceability nyata), tren skor, identity mapping, lead assessment, insight per talent.
- **Identity mapping** — verifikasi mapping yang belum terselesaikan (badge di sidebar).
- **Data integration** — riwayat ingestion per sumber/periode, quality flags, trigger run (admin).
- **Scoring config** — bobot & threshold **berversi**, edit (admin) dengan validasi jumlah bobot = 100.
- **AI insights** — diagnosis + narasi + rekomendasi + referensi sumber; generate → submit → approve.
- **Monthly reports** — draft → in_review → approved/published; **pemisahan internal vs client** +
  **gerbang ekspor**.
- **Audit log** (admin-only) — aksi material tercatat.

Pemilih **periode** ada di header (data tersedia: **2026-03, 2026-04, 2026-05**; default 2026-05).
Sengaja ada beberapa kondisi tepi: satu talent **tidak bisa diskor** (mapping tak yakin), role Data
**tanpa cost rate** → budget burn "tidak tersedia", dan satu ingestion Jira berstatus **partial**.

## 💻 Menjalankan lokal

```bash
cd projects/hitopia-monitoring-report/prototype
npm install
npm run build      # static export → out/
npm run serve      # sajikan out/ di http://localhost:4173
# atau dev mode:
npm run dev        # http://localhost:3000
```

## 🔁 Menyalakan ulang URL preview (ngrok)

Tunnel hidup hanya selama proses berjalan. Untuk menyalakan ulang:

```bash
cd projects/hitopia-monitoring-report/prototype
# 1) static server (origin) — salah satu:
python3 -m http.server 8765 --bind 127.0.0.1 --directory out
#    atau: npm run serve   (port 4173 — sesuaikan port ngrok di bawah)

# 2) tunnel (di terminal lain):
ngrok http 8765            # URL publik ada di output / http://127.0.0.1:4040
```

URL ngrok berubah setiap kali dijalankan (kecuali pakai domain ngrok berbayar). Perbarui URL di file ini.

## 🌐 Opsi hosting permanen (URL stabil, tanpa interstitial)

`out/` adalah **static export murni** (`output: "export"`) → bisa di-host di mana saja:

- **Vercel** — `npx vercel deploy --prebuilt` (atau hubungkan repo; framework: Next.js, output static).
- **Netlify** — drag-drop folder `out/` atau `netlify deploy --dir=out --prod`.
- **GitHub Pages / Cloudflare Pages** — unggah isi `out/`.

Untuk menyambungkan ke **backend nyata** nanti: set `NEXT_PUBLIC_API_BASE=<url-api>` →
`lib/api/client.ts` otomatis memakai `fetch` ke API itu (bentuk data identik kontrak), **call site UI
tidak berubah**. Tanpa env itu, aplikasi tetap mode mock.

## ⚠️ Batasan (disengaja)

- Bukan backend nyata; mutasi (verify/approve/dll.) **reset saat reload** halaman.
- Angka skoring/efisiensi **ilustratif & belum dikalibrasi** — lihat data gap di `reports/ui.md`.
- Kontrak sudah **frozen**, tetapi **open questions** (cost rate, identity key, kalibrasi scoring) belum
  terjawab — UI dibangun fleksibel terhadapnya; sebagian field/angka masih bergantung jawaban itu (lihat `reports/ui.md`).

— Data gap & kebutuhan yang kurang: lihat `reports/ui.md`.
