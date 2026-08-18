# Blueprint — Platform & Compliance

<!--
  Output: Planning Agent (Fase 02). Pasangan teknis dari prd.md.
  PRD = APA & KENAPA. Blueprint = BAGAIMANA. Merujuk contract/foundation.draft.md (jangan definisikan ulang).
-->

```
Unit       : Platform & Compliance
Level      : module
Depends-on : Foundation Contract (APP_USER, AUDIT_LOG, konvensi auth/error) — fondasi semua modul lain
```

## Pendekatan teknis
- **Auth:** Auth.js (NextAuth) Google OAuth, `hd`/domain check membatasi ke domain org. Sesi → token bearer/session untuk API.
- **RBAC:** middleware otorisasi server-side; matriks peran→permission terpusat (mis. `requireRole('admin')`, `requirePermission('report:approve')`). Default **deny**.
- **Audit:** interceptor/middleware yang menulis `AUDIT_LOG` untuk aksi material (mutasi + akses entitas sensitif). Tabel append-only (tanpa UPDATE/DELETE grant ke service role).
- **Secret:** loader env terpusat yang membaca dari secret manager/env saat boot; validasi keberadaan saat startup (fail closed). Tidak ada secret yang ditulis ke DB/log.
- **Enkripsi:** enkripsi kolom (application-level atau pgcrypto) untuk field sensitif; TLS untuk transport; redaksi nilai sensitif di logger.

## Data yang disentuh
- **Menulis/membaca (owner):** `APP_USER` (CRUD peran, status), `AUDIT_LOG` (append-only).
- **Lintas-potong:** menyediakan helper enkripsi/redaksi & guard RBAC yang dipakai modul lain saat menyentuh entitas sensitif (`TALENT`, `PERFORMANCE_SCORE`, `LEAD_ASSESSMENT`, `INSIGHT`, `REPORT_ITEM`). Definisi entitas ada di kontrak — tidak diulang di sini.

## Interface / API unit
Rujuk Foundation Contract:
- `POST /auth/login` — login SSO → `{ token, user }` (401 luar domain).
- `GET /me` — profil pengguna saat ini.
- `GET /audit-logs?entity=&actor=&page=` — admin-only, terpaginasi.
- **Disediakan ke modul lain (internal):** guard `requireRole/requirePermission`, `audit(action, entity)`, `getSecret(key)`, `encryptField/decryptField`, `redact()`.

## Komponen reusable
- Calon promosi ke `shared-library/`: middleware RBAC, audit interceptor, secret loader, logger dengan redaksi PII. Tandai untuk Library Curator setelah terbukti stabil.

## Alur utama
1. Pengguna login Google → callback verifikasi domain → buat/temukan `APP_USER` → terbitkan sesi.
2. Request masuk → middleware auth (valid sesi?) → middleware RBAC (peran punya permission?) → handler.
3. Handler mengakses entitas sensitif → audit interceptor menulis `AUDIT_LOG` (metadata diredaksi).
4. Akses sumber eksternal → `getSecret()` mengambil credential dari secret manager (tidak pernah dari DB).

## Edge cases & error handling
- Akun di luar domain org → 401, tidak membuat `APP_USER`.
- Peran tidak dikenal / pengguna disabled → 403 (fail closed).
- Secret hilang saat startup → boot gagal dengan pesan jelas (tanpa membocorkan nilai), bukan fallback diam-diam.
- Upaya UPDATE/DELETE audit log → ditolak di level DB grant.
- Error tak terduga → pesan generik ke klien; detail (tanpa PII/secret) hanya ke log internal.

## Rencana uji
- Unit: matriks RBAC (peran×endpoint), domain check, redaksi logger, secret loader fail-closed.
- Integrasi: login end-to-end (mock OAuth), audit tertulis untuk aksi material, audit immutable, query audit terpaginasi.
- Keamanan: tidak ada secret di response/log; PII tidak bocor di error; enkripsi kolom terverifikasi. Mengarah ke `acceptance.test`.

## Catatan keamanan
🔴 Gerbang 3. Inti R5/R6/R8: default-deny RBAC, audit immutable, secret manager only (rotasi credential exposed sebelum production), enkripsi at rest + TLS, redaksi PII di log/error, retensi & hak subjek data.

---
*Nafanesia — Template Blueprint v1.0*
