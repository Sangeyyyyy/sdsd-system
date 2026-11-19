/**
 * Database schema for the SDSD Q appointment system.
 *
 * The app is written for libSQL/SQLite. The same SQL works on a local
 * `file:data/app.db` and on Turso in production.
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_no TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_initial TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  program TEXT NOT NULL,
  year_level INTEGER NOT NULL DEFAULT 1,
  campus TEXT NOT NULL DEFAULT 'MAIN',
  school_year TEXT NOT NULL DEFAULT '2026-2027',
  match_first TEXT NOT NULL,
  match_last TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_match ON students(match_last, match_first);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program);
CREATE INDEX IF NOT EXISTS idx_students_campus ON students(campus);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  appointment_date TEXT NOT NULL,
  queue_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  reference_code TEXT NOT NULL UNIQUE,
  booked_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  verified_by TEXT,
  consent_at TEXT,
  UNIQUE (appointment_date, queue_number)
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_student ON appointments(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_appointment
  ON appointments(student_id) WHERE status = 'booked';

CREATE TABLE IF NOT EXISTS day_capacity (
  date TEXT PRIMARY KEY,
  booked INTEGER NOT NULL DEFAULT 0,
  issued INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 200
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  date TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff',
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT NOT NULL,
  appointment_id INTEGER,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year TEXT NOT NULL,
  filename TEXT NOT NULL,
  admin_id INTEGER,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  cancelled_bookings INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
