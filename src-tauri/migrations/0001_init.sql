-- accuCountFM — initial schema
-- Reference: CLAUDE.md §"DB schema"
-- DOCTORS are a code-level constant (4 fixed names) — not stored as a table.

CREATE TABLE IF NOT EXISTS shift_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_type   TEXT NOT NULL CHECK(shift_type IN ('outHos','inHos')),
  date         TEXT NOT NULL,                -- ISO 'YYYY-MM-DD' Gregorian
  slot         TEXT NOT NULL CHECK(slot IN ('0000-0800','0800-1600','1600-2400')),
  doctor_name  TEXT,                          -- nullable; '' or NULL = unassigned
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(shift_type, date, slot)
);

CREATE TABLE IF NOT EXISTS shift_cases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_type   TEXT NOT NULL CHECK(shift_type IN ('outHos','inHos')),
  date         TEXT NOT NULL,
  slot         TEXT NOT NULL CHECK(slot IN ('0000-0800','0800-1600','1600-2400')),
  case_name    TEXT NOT NULL DEFAULT '',
  leave_time   TEXT,                          -- 'HH:MM'; NULL for inHos
  return_time  TEXT,                          -- 'HH:MM'; NULL for inHos
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ocr_uploads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month   TEXT NOT NULL,                 -- 'YYYY-MM'
  image_path   TEXT NOT NULL,                 -- relative path under appData/images/
  raw_json     TEXT NOT NULL,                 -- JSON returned by Claude
  applied_at   TEXT,                          -- set when user confirms apply
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assign_month ON shift_assignments(shift_type, substr(date, 1, 7));
CREATE INDEX IF NOT EXISTS idx_cases_slot   ON shift_cases(shift_type, date, slot);
CREATE INDEX IF NOT EXISTS idx_cases_month  ON shift_cases(shift_type, substr(date, 1, 7));
CREATE INDEX IF NOT EXISTS idx_ocr_month    ON ocr_uploads(year_month);
