import fs from "node:fs";
import path from "node:path";

/**
 * Admin account and role tests against a throwaway SQLite database.
 *
 * Run with: npm run test:admin
 */

const dbPath = path.join(process.cwd(), "data", "test-admin.db");
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  try {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  } catch {
    // Ignore.
  }
}

process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.ADMIN1_USERNAME = "admin1";

const { ensureDb } = await import("../src/lib/db");
const { hashPassword, verifyPassword } = await import("../src/lib/password");
const {
  MAX_ADMIN_ACCOUNTS,
  changeOwnPassword,
  createAdmin,
  generateTempPassword,
  getAdminById,
  listAdmins,
  recordLogin,
  resetAdminPassword,
  setAdminActive,
  updateAdminProfile,
  updateOwnProfile,
  validatePassword,
} = await import("../src/lib/admins");

const db = await ensureDb();

const superHash = await hashPassword("super-secret-pass-123");
await db.execute({
  sql: `INSERT INTO admins (username, password_hash, display_name, role)
        VALUES ('admin1', ?, 'Admin One', 'super_admin')`,
  args: [superHash],
});

const superRow = await db.execute(
  "SELECT id, session_version FROM admins WHERE username = 'admin1'",
);
const superId = Number(superRow.rows[0].id);
const actor = { id: superId, displayName: "Admin One" };

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- Temporary password shape ---------------------------------------------

const sample = generateTempPassword();
check(
  "temp password has four groups of four",
  /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/.test(sample),
  sample,
);

// --- Create ---------------------------------------------------------------

const created = await createAdmin(
  { username: "Maria.Santos", displayName: "Maria Santos", role: "staff" },
  actor,
);
check("create admin succeeds", created.ok);
if (!created.ok) throw new Error("Cannot continue without a staff account.");

const staffId = created.admin.id;
check("username is normalized to lowercase", created.admin.username === "maria.santos");
check("new account starts inactive-free and must change password", created.admin.mustChangePassword);

const staffRow = await db.execute({
  sql: "SELECT password_hash FROM admins WHERE id = ?",
  args: [staffId],
});
check(
  "generated temp password matches the stored hash",
  await verifyPassword(created.tempPassword, String(staffRow.rows[0].password_hash)),
);

check(
  "duplicate username is rejected (case-insensitive)",
  !(await createAdmin(
    { username: "MARIA.SANTOS", displayName: "Copy", role: "staff" },
    actor,
  )).ok,
);

check(
  "short usernames are rejected",
  !(await createAdmin(
    { username: "ab", displayName: "Too Short", role: "staff" },
    actor,
  )).ok,
);

check("short passwords are rejected", validatePassword("short") !== null);
check("12-character passwords are accepted", validatePassword("abcdefghijkl") === null);

// --- Password reset -------------------------------------------------------

const reset = await resetAdminPassword({ id: staffId }, actor);
check("password reset succeeds", reset.ok);
if (reset.ok) {
  const afterReset = await db.execute({
    sql: "SELECT password_hash, must_change_password, session_version FROM admins WHERE id = ?",
    args: [staffId],
  });
  const row = afterReset.rows[0];
  check(
    "reset password replaces the old hash",
    !(await verifyPassword(created.tempPassword, String(row.password_hash))),
  );
  check(
    "reset password matches the new hash",
    await verifyPassword(reset.tempPassword, String(row.password_hash)),
  );
  check("reset forces a password change", Number(row.must_change_password) === 1);
  check("reset bumps the session version", Number(row.session_version) > 1);
}

check(
  "super admin cannot reset their own password here",
  !(await resetAdminPassword({ id: superId }, actor)).ok,
);

// --- Role guardrails ------------------------------------------------------

check(
  "cannot change your own role",
  !(await updateAdminProfile(
    { id: superId, displayName: "Admin One", role: "staff" },
    actor,
  )).ok,
);

const super2 = await createAdmin(
  { username: "admin3", displayName: "Admin Three", role: "super_admin" },
  actor,
);
check("a second super admin can be created", super2.ok);
if (!super2.ok) throw new Error("Cannot continue without a second super admin.");

const super2Id = super2.admin.id;
const actor2 = { id: super2Id, displayName: "Admin Three" };

check(
  "a super admin can demote another super admin when one remains",
  (await updateAdminProfile(
    { id: superId, displayName: "Admin One", role: "staff" },
    actor2,
  )).ok,
);

check(
  "the last active super admin cannot be demoted",
  !(await updateAdminProfile(
    { id: super2Id, displayName: "Admin Three", role: "staff" },
    { id: superId, displayName: "Admin One" },
  )).ok,
);

check(
  "the last active super admin cannot be deactivated",
  !(await setAdminActive(
    { id: super2Id, active: false },
    { id: superId, displayName: "Admin One" },
  )).ok,
);

check(
  "you cannot deactivate your own account",
  !(await setAdminActive({ id: super2Id, active: false }, actor2)).ok,
);

// --- Deactivation and session invalidation --------------------------------

const beforeDeactivate = await db.execute({
  sql: "SELECT session_version FROM admins WHERE id = ?",
  args: [staffId],
});
const versionBefore = Number(beforeDeactivate.rows[0].session_version);

check("staff can be deactivated", (await setAdminActive({ id: staffId, active: false }, actor2)).ok);
const afterDeactivate = await getAdminById(staffId);
check("deactivated account is inactive", afterDeactivate?.isActive === false);
check(
  "deactivation bumps the session version",
  Number(
    (
      await db.execute({
        sql: "SELECT session_version FROM admins WHERE id = ?",
        args: [staffId],
      })
    ).rows[0].session_version,
  ) > versionBefore,
);

check("staff can be reactivated", (await setAdminActive({ id: staffId, active: true }, actor2)).ok);
check("reactivated account is active", (await getAdminById(staffId))?.isActive === true);

// --- Own profile and password --------------------------------------------

check(
  "own display name can be updated",
  (await updateOwnProfile({ id: staffId, displayName: "Maria S. Santos" })).ok,
);
check(
  "display name change is stored",
  (await getAdminById(staffId))?.displayName === "Maria S. Santos",
);

check(
  "wrong current password is rejected",
  !(await changeOwnPassword({
    id: staffId,
    currentPassword: "not-the-password",
    newPassword: "brand-new-password-1",
  })).ok,
);

const changed = await changeOwnPassword({
  id: staffId,
  currentPassword: reset.ok ? reset.tempPassword : "",
  newPassword: "brand-new-password-1",
});
check("own password change succeeds", changed.ok);

if (changed.ok) {
  const row = await db.execute({
    sql: "SELECT password_hash, must_change_password, session_version FROM admins WHERE id = ?",
    args: [staffId],
  });
  check(
    "new password verifies",
    await verifyPassword("brand-new-password-1", String(row.rows[0].password_hash)),
  );
  check("password change clears the reset flag", Number(row.rows[0].must_change_password) === 0);
  check("password change returns the new session version", changed.sessionVersion > 0);
}

check(
  "too-short new password is rejected",
  !(await changeOwnPassword({
    id: staffId,
    currentPassword: "brand-new-password-1",
    newPassword: "short",
  })).ok,
);

// --- Login timestamp ------------------------------------------------------

await recordLogin(staffId);
check("last sign-in is recorded", Boolean((await getAdminById(staffId))?.lastLoginAt));

// --- Account cap ----------------------------------------------------------

let activeCount = (await listAdmins()).filter((admin) => admin.isActive).length;
let index = 0;
while (activeCount < MAX_ADMIN_ACCOUNTS) {
  index += 1;
  const result = await createAdmin(
    {
      username: `staff${index}`,
      displayName: `Staff ${index}`,
      role: "staff",
    },
    actor2,
  );
  if (!result.ok) break;
  activeCount += 1;
}
check(
  "active accounts can reach the cap",
  activeCount === MAX_ADMIN_ACCOUNTS,
  `${activeCount} of ${MAX_ADMIN_ACCOUNTS}`,
);
check(
  "accounts beyond the cap are rejected",
  !(await createAdmin(
    { username: "one.too.many", displayName: "One Too Many", role: "staff" },
    actor2,
  )).ok,
);

// --- Audit trail ----------------------------------------------------------

const audit = await db.execute("SELECT action, COUNT(*) AS n FROM audit_log GROUP BY action");
const actions = new Map(
  audit.rows.map((row) => [String(row.action), Number(row.n)]),
);

check("audit records account creation", (actions.get("admin.created") ?? 0) > 0);
check("audit records password resets", (actions.get("admin.password_reset") ?? 0) > 0);
check("audit records account updates", (actions.get("admin.updated") ?? 0) > 0);
check("audit records deactivations", (actions.get("admin.deactivated") ?? 0) > 0);
check("audit records own password changes", (actions.get("admin.password_changed") ?? 0) > 0);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
