ALTER TABLE shift_cases ADD COLUMN surgeon_name TEXT;
UPDATE shift_cases SET surgeon_name = (
  SELECT doctor_name FROM shift_assignments a
  WHERE a.shift_type = shift_cases.shift_type AND a.date = shift_cases.date AND a.slot = shift_cases.slot
) WHERE case_kind = 'surgery';
