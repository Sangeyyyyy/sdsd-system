# SDSD Q — ID Verification Appointment System

<img src="assets/SDSD logo.png" width="72" alt="SDSD logo" />

SDSD Q is a web-based appointment and queue system for first-year ID
verification at the SDSD office. Students reserve a slot without creating an
account. Staff get a simple admin side for the daily list, verification, search,
exports, and capacity settings.

- **Students:** enter Student ID + last name, confirm the displayed first name,
  and receive a whole-day queue number.
- **Office:** accepts students **Monday–Thursday** only. The system is online
  24/7 and assigns the earliest open office day automatically.
- **Capacity:** 200 slots per day by default (configurable).
- **No student login:** confirmation is shown on screen and can be printed or
  screenshotted. There is no SMS or email.

## Roster

The app is seeded from `excel/roster.xlsx`:

| Scope | Students |
|---|---:|
| Main campus | 2,491 |
| SAMAL campus | 43 |
| **Total** | **2,534** |

The importer excludes the `INCOMPLETE`, `Sheet1`, `1 (2)`, and `BEHIND BARS`
sheets and only imports first-year students. The SAMAL campus is an
**off-by-default toggle** until the supervisor approves it.

### School years

Every student belongs to one school year, such as `2026-2027`. Only students
in the year stored in **Settings → Active school year** can look up or book an
appointment. Student IDs carry the start year (`2026-00001`), and the prefix
must match the student's school year.

Previous-year students stay in the database for history and reports. The
Students page has a school-year filter, including an **All school years**
view. Editing a student never moves them to another year; only a roster import
does that.

### Importing a new school year

A super admin replaces the active roster at **Students → Import roster**:

1. Download the template for the new school year.
2. Fill in the `ROSTER` sheet and upload the `.xlsx` file.
3. Preview the file. The preview reports new and updated students, the
   outgoing cohort, and any row errors.
4. Tick the acknowledgement and import. The file stays in the browser until
   the import succeeds.

An import replaces the active cohort. Students who are not in the new file
have their outstanding `booked` appointments cancelled (and the day's capacity
released). Records with appointment history are archived: they keep their old
school year, become inactive, and stay visible under the previous-year filter.
Records with no history are deleted. The new roster becomes the active school
year, and every import is recorded on the import page and in the activity log.

The import is blocked while any row error exists. Headers are matched by name,
so column order can change; extra columns and extra sheets are ignored. Blank
rows are skipped.

| Column | Required | Rules |
|---|---|---|
| Student ID | Yes | `YYYY-NNNNN`; the first four digits must match the school year |
| First Name | Yes | 1–80 characters |
| Middle Initial | No | Up to 5 characters |
| Last Name | Yes | 1–80 characters |
| Program | Yes | Program code, up to 40 characters (for example `BSIT`) |
| Year Level | No | Must be `1` when filled in |
| Campus | Yes | `MAIN` or `SAMAL` |
| School Year | No | Must match the school year in the form |

The same importer is available from the command line:

```bash
# Preview a file without writing anything
npm run db:import -- --file excel/roster-2027.xlsx --year 2027-2028 --dry-run

# Replace the active cohort (the default)
npm run db:import -- --file excel/roster-2027.xlsx --year 2027-2028

# Add or update rows without retiring the current cohort
npm run db:import -- --file excel/roster-2027.xlsx --year 2027-2028 --mode merge
```

`--year` defaults to the active school year and `--file` defaults to
`excel/roster.xlsx`.

## Features

### Student side

- Booking wizard: Student ID + last name → confirm first name → queue number.
- Automatic assignment of the earliest open office day.
- Whole-day queue number (not a time slot).
- Printable appointment pass at `/confirmation/<reference-code>`.
- Lookup by reference code, or by Student ID + last name.
- Duplicate bookings are idempotent: a student cannot hold two active slots.
- Rebooking after a no-show, up to **3** times by default.
- SAMAL students are blocked while the campus toggle is off.
- Required consent to the **Data Privacy Notice** (`/privacy`) before a booking
  is accepted; the consent timestamp is stored with the appointment.

### Admin side

- Two roles: **super admin** (admin1) and **staff** (admin2 and any accounts
  the super admin creates).
- Super admins manage accounts at `/admin/users`: create staff accounts, edit
  names and roles, reset passwords, and deactivate or reactivate access.
- Every staff member can change their own name and password at `/admin/account`.
- Read-only **Activity log** at `/admin/audit` (super admin only) covering
  appointment and account changes, with filters by staff member, action, and date.
- Dashboard with today's queue, verified count, no-shows, and upcoming days.
- Daily appointment list with search, status filters, and campus filters.
- Mark **Verified** or **No-show**, with undo.
- CSV export and a print-friendly list.
- Search the full student roster, with a school-year filter and archived history.
- Import a new school-year roster from an `.xlsx` workbook, with a preview and
  super-admin-only replacement (see [Importing a new school year](#importing-a-new-school-year)).
- Set the daily limit, same-day cutoff hour, and max rebookings.
- Block specific dates (holidays, office events).
- Enable or disable SAMAL booking.

## Tech stack

- Next.js 16 (App Router, Server Components, Server Actions)
- React 19 + TypeScript
- Tailwind CSS v4
- libSQL / SQLite via `@libsql/client` (local file, Turso-ready)
- Raw SQL with a small data-access layer
- `bcryptjs` + `jose` for admin authentication
- `exceljs` for roster import
- `zod` for request validation

## Quick start

Requirements: **Node.js 20.9+** (developed on Node 24).

```bash
npm install

# 1. Create your local environment file
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux

# 2. Edit .env: set AUTH_SECRET and the two admin passwords

# 3. Create the schema and generate capacity days
npm run db:init

# 4. Import the first-year roster (expects 2,534 students)
npm run db:import

# 5. Create the two admin accounts
npm run db:seed

# 6. Run the app
npm run dev
```

Open <http://localhost:3000>.

The local database is `data/app.db` and is gitignored. The roster workbook must
stay at `excel/roster.xlsx`.

### Default admin accounts

`npm run db:seed` reads these variables from `.env`:

```env
ADMIN1_USERNAME=admin1
ADMIN1_PASSWORD=change-me-1
ADMIN1_NAME=SDSD Admin 1

ADMIN2_USERNAME=admin2
ADMIN2_PASSWORD=change-me-2
ADMIN2_NAME=SDSD Admin 2
```

**Admin 1 is the super admin** and can manage accounts in the panel; **admin 2
is staff**. Additional accounts are created in the UI, not in `.env`.

**Change the passwords before real use.** After editing `.env`, run:

```bash
npm run db:seed -- --reset-passwords
```

This updates the existing accounts instead of creating duplicates.

If you get locked out, the same command is the recovery path: it restores both
env passwords and makes admin 1 a super admin again.

#### Account rules

- Up to **10 active accounts**. Deactivating one frees a slot.
- Usernames are permanent; display names and roles can change.
- You cannot deactivate or demote yourself, and the last active super admin
  cannot be removed.
- Accounts are deactivated, never deleted, so the audit log keeps its history.
- New and reset accounts get a one-time temporary password (shown once) and a
  banner asking them to change it under **My account**.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:data/app.db` locally, or `libsql://...` for Turso |
| `DATABASE_AUTH_TOKEN` | Turso token (empty for local files) |
| `AUTH_SECRET` | Long random string used to sign admin session cookies. **Required in production** — the app refuses to sign or verify sessions when it is missing |
| `ADMIN1_*` / `ADMIN2_*` | Bootstrap the first two accounts (`ADMIN1` becomes super admin) |
| `NEXT_PUBLIC_SITE_NAME` | Optional display name |
| `NEXT_PUBLIC_SITE_URL` | Public origin used for canonical links, `sitemap.xml`, and link previews. Leave unset on Vercel to use the project's production domain |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## How booking works

1. The student enters their **Student ID** (`YYYY-NNNNN`) and **last name**.
2. The app matches them against the roster using normalized names, so case,
   spacing, and suffixes like `JR` do not matter.
3. The student confirms the displayed first name.
4. The app picks the earliest office day that still has room:

   ```sql
   SELECT date FROM day_capacity
   WHERE date >= ?
     AND booked < capacity
     AND date NOT IN (SELECT date FROM blocked_dates)
   ORDER BY date ASC
   LIMIT 1;
   ```

5. A slot is taken atomically and the queue number is issued:

   ```sql
   UPDATE day_capacity
   SET booked = booked + 1, issued = issued + 1
   WHERE date = ? AND booked < capacity
   RETURNING issued;
   ```

6. The queue number is the `issued` value, so it is unique within that day.
7. The appointment is saved with a reference code such as `SDSD-ABC123`.

Dates are calculated in **Asia/Manila** time. Same-day booking is allowed until
the configured cutoff hour (default **15:00**); after that, the next office day
is used.

### Statuses

| Status | Meaning |
|---|---|
| `booked` | Active reservation |
| `verified` | Student attended and was verified |
| `no_show` | Missed the appointment; can rebook |
| `cancelled` | Cancelled by staff; can rebook |

A student can hold only one active `booked` appointment at a time. After a
no-show or cancellation, they may book again until they reach the configured
rebook limit (default 3).

### Queue numbers

Queue numbers are **whole-day** and start at `001` each office day. They are not
time slots. The confirmation pass displays the padded number for readability.

## Admin guide

1. Sign in at `/admin/login`.
2. **Dashboard** shows today's queue, verified count, no-shows, and upcoming
   office days.
3. **Appointments** lets you:
   - pick any date,
   - search by name, Student ID, or reference code,
   - filter by status or campus,
   - mark students **Verified** or **No-show**,
   - undo a status change,
   - export CSV or print the list.
4. **Students** searches the full 2,534-record roster.
5. **Settings** controls:
   - daily slot limit,
   - same-day cutoff hour,
   - max rebookings,
   - booking open/closed,
   - SAMAL campus toggle,
   - blocked dates.

Changing the daily limit updates future capacity rows but never reduces a day
below its current number of bookings.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run db:init` | Create the schema and capacity horizon |
| `npm run db:migrate` | Apply pending schema updates (safe to repeat) |
| `npm run db:import` | Import `excel/roster.xlsx` into the active school year |
| `npm run db:import -- --file <path> --year <YYYY-YYYY>` | Import a specific workbook for a school year |
| `npm run db:import -- --dry-run` | Preview an import without writing anything |
| `npm run db:import -- --mode merge` | Add or update rows without retiring the current cohort |
| `npm run db:seed` | Create the two bootstrap admin accounts |
| `npm run db:seed -- --reset-passwords` | Restore the env passwords and super admin role |
| `npm run test:booking` | Run the end-to-end booking test |
| `npm run test:admin` | Run the account, role, and audit tests |
| `npm run test:students` | Verify roster add/edit corrections |
| `npm run test:year` | Verify active school-year gating and history |
| `npm run test:roster-import` | Verify the workbook parser and template |
| `npm run test:roster-replace` | Verify replace/merge imports and archiving |
| `npm run test:cancel` | Verify student self-cancellation |
| `npm run test:bulk` | Verify bulk status updates |
| `npm run test:reports` | Verify report ranges and totals |
| `npm run test:reset` | Verify the super-admin booking reset |
| `npm run test:migrate` | Verify production upgrades an older database |

Imports never run automatically. The in-app flow previews the file first and
blocks confirmation while any row has an error.

## Deployment

The app runs anywhere Node.js runs, but **do not deploy the local SQLite file to
a serverless host** — it will not persist. Use Turso (free tier) for production.

1. Create a Turso database and token.
2. Set these environment variables on your host:
   - `DATABASE_URL=libsql://...`
   - `DATABASE_AUTH_TOKEN=...`
   - `AUTH_SECRET=...`
   - `ADMIN1_*`, `ADMIN2_*`
3. Run the setup scripts once against the Turso database:

   ```bash
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:init
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:import -- --file excel/roster.xlsx --year 2026-2027
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:seed
   ```

4. Deploy to Vercel (or any Node host) and build with `npm run build`.

In production the app checks the database schema version once per server
process. If the database is older than the running code, it applies the
idempotent schema updates before serving that request; an up-to-date database
pays one small lookup in the `_schema_version` table per cold start. This means
a deploy that adds columns or tables (for example `students.school_year`,
`students.is_active`, and `roster_imports`) upgrades itself on first use.
Turso Cloud makes `PRAGMA user_version` read-only, so the version is stored in
a table rather than the SQLite header.

You can also run the migration explicitly, before or after deploying:

```bash
DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate
```

`npm run db:init` still creates a new database and its capacity horizon.
`FORCE_DB_INIT=1` forces the full setup even when the recorded version is
current.

The libSQL client works over HTTP with Turso, so no persistent disk is needed.
The app is pinned to the Node.js runtime for database access.

## Security and rate limiting

- Admin pages and server actions require a signed, HTTP-only session cookie.
- Passwords are hashed with bcrypt.
- Public lookup and booking endpoints validate input with `zod`.
- A small **in-memory** rate limiter protects `/api/lookup`, `/api/book`, and
  `/api/appointment`.

The rate limiter is intentionally a first-stage measure. It resets on restart
and is per-instance. A durable limiter (for example Upstash Redis or a
`rate_limits` table) is marked as a later-stage upgrade in
`src/lib/rate-limit.ts`.

Reference codes are six characters from an unambiguous alphabet
(`SDSD-ABC123`). Anyone with a reference code can view that appointment pass;
this is intentional so students can screenshot and re-open it.

## Search engines and link previews

- `src/app/robots.ts` allows the public pages and disallows `/admin`,
  `/confirmation/`, and `/api/`.
- `/admin` and `/confirmation/[code]` also send `noindex, nofollow` so passes
  containing a student's name never appear in search results.
- `src/app/sitemap.ts` lists the home, booking, lookup, and privacy pages.
- `src/app/opengraph-image.tsx` generates the 1200×630 preview card shown when
  the link is shared in a group chat or social app.
- Set `NEXT_PUBLIC_SITE_URL` so canonical links and the sitemap use the real
  domain. Without it, Vercel's production domain is used automatically.

## Accessibility

- Body text and badges meet WCAG 2.2 AA contrast (4.5:1). Muted labels use
  `text-slate-500` (4.76:1 on white); the step pills and appointment pass labels
  were adjusted to match.
- Focus indicators are **solid**, not translucent, rings: a 30%-opacity ring
  blends to about 1.4:1 against white and is effectively invisible. See the
  comment above `.btn-primary` in `globals.css`.
- Icons that repeat an adjacent label stay at `text-slate-400`; they are
  decorative, so the 3:1 non-text rule does not apply to them.

## Project structure

```text
excel/roster.xlsx          Authoritative first-year roster
scripts/                   init, import, seed, and booking test
src/app/                   Pages and API routes
src/app/admin/(protected)  Authenticated admin pages
src/app/api                Public and admin API routes
src/components             Shared UI components
src/lib/booking.ts         Booking engine and student state
src/lib/queries.ts         Admin queries and status changes
src/lib/admins.ts          Admin accounts, roles, and password resets
src/lib/audit.ts           Activity log queries and labels
src/lib/settings.ts        Settings and day-capacity management
src/lib/site.ts            Site name, description, and public URL
src/lib/dates.ts           Asia/Manila date helpers
src/lib/schema.ts          SQL schema
src/lib/db.ts              libSQL client and schema bootstrap
```

## Troubleshooting

**“We could not find that Student ID and last name.”**
Check the ID format (`YYYY-NNNNN`) and the spelling of the last name. If the
student is a first-year but not in the roster, add them to `excel/roster.xlsx`
and re-run `npm run db:import`.

**A student cannot book.**
Check whether they already have an active appointment, are already verified, hit
the rebook limit, or are a SAMAL student while the toggle is off.

**SAMAL students see “not open yet.”**
Enable **Include SAMAL campus** in Settings once approved.

**The queue jumped to a later date.**
The current day is full, blocked, or past the same-day cutoff. The system
assigns the earliest day with room.

**Admin login fails.**
Confirm the account exists (`npm run db:seed`) and the password in `.env`
matches. To reset, update `.env` and run
`npm run db:seed -- --reset-passwords`.

If the account exists but still cannot sign in, it may be **deactivated**. Sign
in as a super admin and reactivate it at `/admin/users`. If no super admin can
sign in, `npm run db:seed -- --reset-passwords` restores both env passwords and
makes admin 1 a super admin again.

**An account is missing from `/admin/users`.**
Only super admins see that page. Staff who open it directly are sent back to the
dashboard with a notice.
