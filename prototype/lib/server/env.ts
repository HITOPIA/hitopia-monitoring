/**
 * Secret/config loader. Reads ONLY from process.env (populated by Next from
 * .env files, or by a secret manager in production). No secret ever lives in the
 * DB, code, or logs (R8). Required secrets fail closed — the app refuses to boot
 * rather than fall back to an insecure default.
 */

export function getSecret(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required secret/config "${key}" — refusing to continue (fail-closed, R8).`);
  }
  return v;
}

export function getOptional(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v : undefined;
}

/** Allowed Google Workspace domains for sign-in (Phase 2). */
export function allowedDomains(): string[] {
  return (getOptional("AUTH_ALLOWED_DOMAIN") ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
