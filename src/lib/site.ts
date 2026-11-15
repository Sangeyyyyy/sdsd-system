/**
 * Shared site identity used by page metadata, robots.txt, and the sitemap.
 *
 * Set `NEXT_PUBLIC_SITE_URL` to the public production origin (for example
 * `https://sdsd-q.dnsc.edu.ph`). On Vercel we fall back to the project's
 * production domain so previews never leak localhost URLs into metadata.
 */

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "SDSD Q";

export const SITE_TITLE = `${SITE_NAME} — ID Verification Appointments`;

export const SITE_DESCRIPTION =
  "Book your first-year ID verification appointment at the SDSD Office, DNSC. Pick an open day and get a queue number instantly — no account needed.";

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export function absoluteUrl(path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${suffix}`;
}
