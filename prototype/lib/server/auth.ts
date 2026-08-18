/** Password hashing for email/password auth (bcrypt). */
import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Strip secrets/PII-ish fields before returning an AppUser to the client. */
export function publicUser<T extends Record<string, any>>(u: T): Omit<T, "password_hash"> {
  const { password_hash, ...rest } = u;
  return rest;
}
