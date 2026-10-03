import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        for version in range(1, 4):
            self.db.executescript(next((ROOT / "src-tauri/migrations").glob(f"{version:04d}_*.sql")).read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO shift_cases(shift_type,date,slot,case_name) VALUES ('outHos','2026-05-12','0000-0800','123/69')")
        self.db.executescript((ROOT / "src-tauri/migrations/0004_surgery_cases.sql").read_text(encoding="utf-8"))

    def test_examination_time_migration_preserves_cases(self):
        self.db.executescript((ROOT / "src-tauri/migrations/0005_examination_time.sql").read_text(encoding="utf-8"))
        self.assertEqual(self.db.execute("SELECT case_name,examination_time FROM shift_cases").fetchone(), ('123/69', None))
        self.db.execute("UPDATE shift_cases SET examination_time='08:15'")
        self.assertEqual(self.db.execute("SELECT examination_time FROM shift_cases").fetchone()[0], '08:15')

    def assign(self, typ, date, slot):
        self.db.execute("INSERT INTO shift_assignments(shift_type,date,slot,doctor_name) VALUES (?,?,?,'doctor')", (typ,date,slot))

    def test_legacy_case_is_preserved(self):
        self.assertEqual(self.db.execute("SELECT case_name,case_kind FROM shift_cases").fetchone(), ('123/69','examination'))

    def test_regular_office_allows_both_types(self):
        self.assign('outHos','2026-05-12','0800-1600')
        self.assign('inHos','2026-05-12','0800-1600')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO holidays(year_month,day) VALUES ('2026-05',12)")

    def test_off_hour_rejects_simultaneous_doctor(self):
        for date,slot in [('2026-05-12','0000-0800'),('2026-05-16','0800-1600'),('2026-05-12','1600-2400')]:
            self.assign('outHos',date,slot)
            with self.assertRaises(sqlite3.IntegrityError):
                self.assign('inHos',date,slot)

    def test_holiday_rejects_simultaneous_doctor(self):
        self.db.execute("INSERT INTO holidays(year_month,day) VALUES ('2026-05',12)")
        self.assign('outHos','2026-05-12','0800-1600')
        with self.assertRaises(sqlite3.IntegrityError):
            self.assign('inHos','2026-05-12','0800-1600')

    def test_update_rejects_simultaneous_doctor(self):
        self.assign('outHos','2026-05-12','0000-0800')
        self.db.execute("INSERT INTO shift_assignments(shift_type,date,slot,doctor_name) VALUES ('inHos','2026-05-12','0000-0800','other')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE shift_assignments SET doctor_name='doctor' WHERE shift_type='inHos'")

if __name__ == '__main__':
    unittest.main()
