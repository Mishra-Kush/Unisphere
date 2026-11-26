-- UNISPHERE schema (SQLite). Run with foreign keys ON.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 100),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  enrollment_no TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  -- students must use the college domain; admin email is set only by the init tool
  CHECK (role = 'admin' OR email LIKE '%@mitsgwl.ac.in')
);

CREATE TABLE IF NOT EXISTS clubs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL UNIQUE,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT NOT NULL,
  instagram_handle TEXT UNIQUE,
  category         TEXT NOT NULL CHECK (category IN ('technical','coding-ai','cultural','music-dance','sports-fitness','arts-photography','entrepreneurship-career','environment-social','research-innovation','wellness-community')),
  image_path       TEXT,
  faculty_advisor  TEXT NOT NULL DEFAULT 'Not yet provided',
  student_leads    TEXT NOT NULL DEFAULT 'Not yet provided',
  recruitment_status TEXT NOT NULL DEFAULT 'To be announced' CHECK (recruitment_status IN ('open','closed','To be announced')),
  is_archived      INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id         INTEGER NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  description     TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('workshop','hackathon','technical-fest','cultural-fest','seminar','competition','sports','music-dance','career','environmental','community-service','other')),
  cover_image     TEXT,
  event_date      TEXT NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- college-local (IST) date
  start_time      TEXT NOT NULL CHECK (start_time GLOB '[0-9][0-9]:[0-9][0-9]'),
  end_time        TEXT NOT NULL CHECK (end_time GLOB '[0-9][0-9]:[0-9][0-9]'),
  venue           TEXT NOT NULL,
  reg_opens       TEXT,            -- YYYY-MM-DD
  reg_closes      TEXT,
  capacity        INTEGER CHECK (capacity IS NULL OR capacity > 0),
  is_published    INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
  registration_enabled INTEGER NOT NULL DEFAULT 1 CHECK (registration_enabled IN (0,1)),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','archived')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK (end_time > start_time),
  CHECK (reg_opens IS NULL OR reg_closes IS NULL OR reg_opens <= reg_closes)
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_club ON events(club_id);

CREATE TABLE IF NOT EXISTS registrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);

-- Overbooking guard enforced by the database itself (in addition to the transaction in the C code)
CREATE TRIGGER IF NOT EXISTS trg_registration_capacity BEFORE INSERT ON registrations
WHEN (SELECT capacity FROM events WHERE id = NEW.event_id) IS NOT NULL
 AND (SELECT count(*) FROM registrations WHERE event_id = NEW.event_id) >= (SELECT capacity FROM events WHERE id = NEW.event_id)
BEGIN
  SELECT RAISE(ABORT, 'EVENT_FULL');
END;

CREATE TABLE IF NOT EXISTS announcements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 150),
  message     TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
  club_id     INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
  event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
  published_at TEXT,
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,   -- SHA-256 of the cookie token; raw token is never stored
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,   -- unix seconds
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts(identifier, attempted_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
