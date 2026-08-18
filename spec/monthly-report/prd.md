# PRD — Monthly Report

<!--
  Output: Planning Agent (Fase 02). Perakitan & ekspor slide deck client-ready dengan pemisahan internal/client.
  Pasangan: blueprint.md + acceptance.test. Merujuk contract/foundation.draft.md.
-->

```
Unit    : Monthly Report
Level   : module
Parent  : Hitopia Monitoring & Monthly Report
Status  : draft
Owner   : Planning Agent — model claude-opus-4-8
```

## Tujuan unit
Merakit **monthly slide deck client-ready** per periode dari konten yang sudah di-approve (skor, insight, narasi,
rekomendasi), dengan **pemisahan tegas** antara konten diagnostik internal (sensitif) dan konten client-facing.
Deck **hanya bisa diekspor setelah approval** ([[approval-workflow]]). Modul ini mengubah hasil analisis menjadi
artefak presentasi, bukan menghitung atau menafsirkan ulang data.

## Kebutuhan (user stories)
- Sebagai **analyst internal**, saya ingin men-generate draft report bulanan dari konten approved, agar tidak menyusun deck manual.
- Sebagai **reviewer**, saya ingin menandai item mana yang **client-visible** vs internal-only, agar analisis sensitif tidak bocor.
- Sebagai **management**, saya ingin mengekspor deck final (hanya jika approved) dalam format presentasi, agar siap dipakai ke client.
- Sebagai **DPO**, saya ingin jaminan teknis bahwa konten internal tidak masuk deck client kecuali eksplisit, agar patuh PDP.

## Functional requirements
F1. Generate draft `MONTHLY_REPORT` per periode dengan `scope` (talent/project/client tercakup) dari konten approved/relevan.
F2. Report tersusun dari `REPORT_ITEM` bertanda `section`, `content`, dan **`client_visible`** (boolean) + `audience` (`internal|client`).
F3. **Pemisahan internal vs client:** item internal-only **tidak** dimasukkan ke render/ekspor client; default aman = tidak client-visible kecuali ditandai.
F4. Sertakan `exec_summary` (narasi) dari konten approved; tautkan ke insight/skor sumber.
F5. Report mengikuti alur review→approve ([[approval-workflow]]); status `draft|in_review|approved|published`.
F6. **Ekspor hanya jika `approved`:** `GET /reports/{id}/export` menolak bila belum approved; menghasilkan file deck (PDF presentasi untuk MVP; .pptx/Google Slides bila disepakati).
F7. Ekspor client menggunakan **hanya** item `client_visible=true`; ekspor menandai report `published`/teraudit.
F8. Endpoint: `GET /reports`, `GET /reports/{id}`, `POST /reports/generate`, `GET /reports/{id}/export`.

## Non-functional
- **Fail-safe privasi:** default item = internal (tidak client-visible); kebocoran konten internal ke deck client = cacat kritis.
- **Ketertelusuran:** tiap item deck dapat dirujuk ke insight/skor sumbernya.
- **Reproduksibilitas:** ekspor report approved menghasilkan deck konsisten.

## Acceptance criteria
- Draft report ter-generate dari konten approved dengan `scope` & item ber-`client_visible`.
- Item internal-only tidak pernah muncul di ekspor client.
- Ekspor diblokir kecuali report `approved`.
- Deck final ter-ekspor dalam format presentasi; aksi ekspor teraudit.
- Detail tegas di `spec/monthly-report/acceptance.test`.

## Dependencies
- **Foundation Contract** — `MONTHLY_REPORT`, `REPORT_ITEM` (+ membaca `INSIGHT`, `PERFORMANCE_SCORE`).
- [[ai-insight]] — sumber narasi/diagnosis/rekomendasi (approved).
- [[metrics-scoring]] — sumber skor/metrik.
- [[approval-workflow]] — gate approve sebelum ekspor.
- [[platform-compliance]] — RBAC, audit.

## Keamanan & kepatuhan
🔴 **WAJIB Gerbang 3.** Pemisahan internal vs client adalah kontrol PDP inti. Wajib: default tidak client-visible,
gate ekspor approved-only, audit ekspor, tidak ada konten sensitif di deck client, tidak ada pengiriman otomatis
ke client tanpa approval.

## Out of scope
- Generasi insight/narasi → [[ai-insight]] (modul ini merakit, tidak mengarang).
- Keputusan approve → [[approval-workflow]].
- **Pengiriman otomatis** deck ke client (email/share) — di luar scope MVP; deck diunduh setelah approve.
- Editor deck WYSIWYG penuh (MVP: template terstruktur).

## Open questions
1. **Format deck final** yang disepakati client (PDF presentasi vs .pptx editable vs Google Slides).
2. **Template & branding** deck (struktur slide, identitas visual Hitopia/client).
3. Tingkat **kustomisasi manual** sebelum ekspor (MVP: minimal/templated?).
4. Aturan penurunan **apa yang client-visible** secara default per section.

---
*Nafanesia — Template PRD v1.0*
