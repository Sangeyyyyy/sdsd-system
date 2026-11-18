import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDb } from "./db";

const COOKIE_NAME = "sdsd_admin";
const SESSION_SECONDS = 60 * 60 * 8; // 8 hours

export type AdminRole = "super_admin" | "staff";

export type AdminSession = {
  id: number;
  username: string;
  displayName: string;
  role: AdminRole;
  mustChangePassword: boolean;
  sessionVersion: number;
};

/**
 * Development-only fallback so `npm run dev` works before `.env` is created.
 * Production must always provide AUTH_SECRET: a shared hardcoded value would
 * let anyone forge an admin session cookie.
 */
const DEV_FALLBACK_SECRET =
  "sdsd-dev-only-session-secret-do-not-use-in-production";

function secretKey(): Uint8Array {
  const value = process.env.AUTH_SECRET?.trim();

  if (value) {
    return new TextEncoder().encode(value);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is not set. Add a long random value (32+ characters) to the environment before signing in.",
    );
  }

  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

function parseRole(value: unknown): AdminRole {
  return value === "super_admin" ? "super_admin" : "staff";
}

/**
 * Signs a session token. Only the id and session version are stored in the
 * token; the role, name, and active flag are always read from the database so
 * demotions and deactivations take effect immediately.
 */
export async function createSession(session: {
  id: number;
  sessionVersion: number;
}): Promise<void> {
  const token = await new SignJWT({
    id: session.id,
    sv: session.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, secretKey());
    payload = verified.payload as Record<string, unknown>;
  } catch {
    return null;
  }

  const id = Number(payload.id);
  const sessionVersion = Number(payload.sv);
  if (!Number.isFinite(id) || id <= 0) return null;

  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT id, username, display_name, role, is_active, session_version, must_change_password
          FROM admins WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const admin = result.rows[0];
  if (!admin) return null;
  if (Number(admin.is_active) !== 1) return null;
  if (Number(admin.session_version) !== sessionVersion) return null;

  return {
    id: Number(admin.id),
    username: String(admin.username),
    displayName: String(admin.display_name || admin.username),
    role: parseRole(admin.role),
    mustChangePassword: Number(admin.must_change_password) === 1,
    sessionVersion: Number(admin.session_version),
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Use in protected server components and server actions. */
export async function requireSession(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Account management and the audit log are super-admin only. */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireSession();
  if (session.role !== "super_admin") redirect("/admin?denied=1");
  return session;
}
