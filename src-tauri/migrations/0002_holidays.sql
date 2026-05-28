-- accuCountFM — holidays
-- One row per (year_month, day) holiday. Used by calc::is_off_hour to flag
-- weekday slots that otherwise look in-hour as off-hour (paid 780).
-- Note: ranges across months are NOT supported; each calendar day stands alone.

CREATE TABLE IF NOT EXISTS holidays (
  year_month  TEXT NOT NULL,                     -- 'YYYY-MM'
  day         INTEGER NOT NULL CHECK(day BETWEEN 1 AND 31),
  note        TEXT,                              -- optional Thai label (e.g. "วันแรงงาน")
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (year_month, day)
);

CREATE INDEX IF NOT EXISTS idx_holidays_month ON holidays(year_month);
