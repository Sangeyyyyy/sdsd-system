import { existsSync } from "node:fs";

/**
 * Loads `.env` for CLI scripts. Next.js loads it automatically at runtime,
 * but `tsx scripts/*.ts` does not, so every script imports this first.
 */
if (existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore malformed or unreadable env files; defaults still apply.
  }
}
