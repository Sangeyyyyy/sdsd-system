import "./env";
import { ensureDb } from "../src/lib/db";
import { ensureDefaultSettings, ensureHorizon } from "../src/lib/settings";
import { hashPassword } from "../src/lib/password";

type SeedAdmin = {
  username: string;
  password: string;
  displayName: string;
  role: "super_admin" | "staff";
};

function seedAdmins(): SeedAdmin[] {
  return [
    {
      username: process.env.ADMIN1_USERNAME ?? "admin1",
      password: process.env.ADMIN1_PASSWORD ?? "change-me-1",
      displayName: process.env.ADMIN1_NAME ?? "SDSD Admin 1",
      role: "super_admin",
    },
    {
      username: process.env.ADMIN2_USERNAME ?? "admin2",
      password: process.env.ADMIN2_PASSWORD ?? "change-me-2",
      displayName: process.env.ADMIN2_NAME ?? "SDSD Admin 2",
      role: "staff",
    },
  ];
}

async function main() {
  const resetPasswords = process.argv.includes("--reset-passwords");
  const db = await ensureDb();
  await ensureDefaultSettings();
  await ensureHorizon(120);

  for (const admin of seedAdmins()) {
    const existing = await db.execute({
      sql: "SELECT id FROM admins WHERE username = ?",
      args: [admin.username],
    });

    if (existing.rows.length > 0) {
      if (!resetPasswords) {
        console.log(`Admin "${admin.username}" already exists.`);
        continue;
      }
      const passwordHash = await hashPassword(admin.password);
      await db.execute({
        sql: "UPDATE admins SET password_hash = ?, display_name = ?, role = ? WHERE username = ?",
        args: [passwordHash, admin.displayName, admin.role, admin.username],
      });
      console.log(`Updated password and role for admin "${admin.username}".`);
      continue;
    }

    const passwordHash = await hashPassword(admin.password);
    await db.execute({
      sql: "INSERT INTO admins (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
      args: [admin.username, passwordHash, admin.displayName, admin.role],
    });
    console.log(
      `Created admin "${admin.username}" (${admin.displayName}) as ${admin.role}.`,
    );
  }

  console.log(
    "\nAdmin 1 is the super admin and manages accounts in the admin panel.",
  );
  console.log(
    "Change the default admin passwords in .env before using this in production.",
  );
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
