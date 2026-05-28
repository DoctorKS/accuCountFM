-- accuCountFM — per-doctor autopsy counts (ผ่า + ผ่าไม่ตัดเนื้อ)
-- One row per (year_month, doctor). User enters integers in TotalSummary.
-- Rate constants (4500 for cuts, 2250 for non-cuts) are NOT stored — they
-- live in src/lib/constants.ts so the UI can change them without migration.

CREATE TABLE IF NOT EXISTS doctor_autopsy_counts (
  year_month   TEXT NOT NULL,
  doctor_name  TEXT NOT NULL,
  cuts         INTEGER NOT NULL DEFAULT 0,       -- ผ่า
  non_cuts     INTEGER NOT NULL DEFAULT 0,       -- ผ่าไม่ตัดเนื้อ
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (year_month, doctor_name)
);

CREATE INDEX IF NOT EXISTS idx_autopsy_month ON doctor_autopsy_counts(year_month);
