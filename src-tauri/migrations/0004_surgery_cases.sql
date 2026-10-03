ALTER TABLE shift_cases ADD COLUMN case_kind TEXT NOT NULL DEFAULT 'examination'
CHECK(case_kind IN ('examination', 'surgery'));
CREATE TRIGGER assignment_doctor_conflict_insert BEFORE INSERT ON shift_assignments
WHEN NEW.doctor_name IS NOT NULL AND NEW.doctor_name <> ''
AND (NEW.slot <> '0800-1600' OR strftime('%w', NEW.date) IN ('0','6')
 OR EXISTS(SELECT 1 FROM holidays WHERE year_month = substr(NEW.date,1,7) AND day = CAST(substr(NEW.date,9,2) AS INTEGER)))
AND EXISTS(SELECT 1 FROM shift_assignments WHERE date=NEW.date AND slot=NEW.slot
 AND shift_type<>NEW.shift_type AND doctor_name=NEW.doctor_name)
BEGIN SELECT RAISE(ABORT, 'แพทย์อยู่เวรสองประเภทพร้อมกันได้เฉพาะในเวลาราชการ'); END;

CREATE TRIGGER assignment_doctor_conflict_update BEFORE UPDATE ON shift_assignments
WHEN NEW.doctor_name IS NOT NULL AND NEW.doctor_name <> ''
AND (NEW.slot <> '0800-1600' OR strftime('%w', NEW.date) IN ('0','6')
 OR EXISTS(SELECT 1 FROM holidays WHERE year_month = substr(NEW.date,1,7) AND day = CAST(substr(NEW.date,9,2) AS INTEGER)))
AND EXISTS(SELECT 1 FROM shift_assignments WHERE date=NEW.date AND slot=NEW.slot
 AND shift_type<>NEW.shift_type AND doctor_name=NEW.doctor_name)
BEGIN SELECT RAISE(ABORT, 'แพทย์อยู่เวรสองประเภทพร้อมกันได้เฉพาะในเวลาราชการ'); END;

CREATE TRIGGER holiday_doctor_conflict_insert BEFORE INSERT ON holidays
WHEN EXISTS(SELECT 1 FROM shift_assignments a JOIN shift_assignments b
 ON a.date=b.date AND a.slot=b.slot AND a.shift_type<>b.shift_type
 WHERE substr(a.date,1,7)=NEW.year_month AND CAST(substr(a.date,9,2) AS INTEGER)=NEW.day
 AND a.slot='0800-1600' AND a.doctor_name IS NOT NULL AND a.doctor_name=b.doctor_name)
BEGIN SELECT RAISE(ABORT, 'กรุณาแยกแพทย์เวรในและนอกก่อนเพิ่มวันหยุด'); END;
