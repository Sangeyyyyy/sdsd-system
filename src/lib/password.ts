import bcrypt from "bcryptjs";

/**
 * Password hashing lives in its own module so CLI scripts can use it
 * without importing `next/headers` (which only works inside Next.js).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
