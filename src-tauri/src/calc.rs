//! # Shift pay calculation — single source of truth
//!
//! Constants and rules here MUST match `src/lib/calc.ts` / `src/lib/constants.ts`.
//! Any change requires updating both sides AND the table in `CLAUDE.md`.
//!
//! The TS mirror exists only so the UI can show a running total while the user
//! types. Persisted totals always come from this Rust implementation.

use serde::{Deserialize, Serialize};

// ─── Constants — DO NOT change without going through CLAUDE.md guardrails ────
pub const SHIFT_PAY_SOLO_8H: f64 = 780.0;
pub const SHIFT_PAY_CHAIN_16H: f64 = 760.0;
pub const CASE_BONUS_OUT_HOS: f64 = 1800.0;
pub const CASE_BONUS_IN_HOS: f64 = 1200.0;
pub const DEDUCT_PER_HALF_HOUR: f64 = 48.75;
pub const IN_HOS_MIN_PER_CASE: i32 = 10;
pub const GRACE_MIN: i32 = 4;

// ─── Types ───────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ShiftType {
    OutHos,
    InHos,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Slot {
    #[serde(rename = "0000-0800")]
    S00_08,
    #[serde(rename = "0800-1600")]
    S08_16,
    #[serde(rename = "1600-2400")]
    S16_24,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assignment {
    pub shift_type: ShiftType,
    pub date: String, // YYYY-MM-DD
    pub slot: Slot,
    pub doctor_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShiftCase {
    pub shift_type: ShiftType,
    pub date: String,
    pub slot: Slot,
    pub leave_time: Option<String>,  // "HH:MM"
    pub return_time: Option<String>, // "HH:MM"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotPay {
    pub base: f64,
    pub deduction: f64,
    pub case_bonus: f64,
    pub total: f64,
    pub reason: String,
}

// ─── Internals ───────────────────────────────────────────────────────────────
fn parse_hm(hm: &str) -> Option<i32> {
    let (h_s, m_s) = hm.split_once(':')?;
    let h: i32 = h_s.parse().ok()?;
    let m: i32 = m_s.parse().ok()?;
    if !(0..=23).contains(&h) || !(0..=59).contains(&m) {
        return None;
    }
    Some(h * 60 + m)
}

/// Half-hour deduction units; 0 if `minutes_out <= GRACE_MIN`.
pub fn deduction_units(minutes_out: i32) -> u32 {
    if minutes_out <= GRACE_MIN {
        0
    } else {
        ((minutes_out - GRACE_MIN) as f64 / 30.0).ceil() as u32
    }
}

/// Minutes between leave and return, handling cross-midnight by +24h.
pub fn case_minutes(leave: Option<&str>, ret: Option<&str>) -> i32 {
    let (Some(l), Some(r)) = (leave.and_then(parse_hm), ret.and_then(parse_hm)) else {
        return 0;
    };
    let mut diff = r - l;
    if diff < 0 {
        diff += 24 * 60;
    }
    diff
}

/// Add `days` to ISO `YYYY-MM-DD`. Returns the shifted date as `YYYY-MM-DD`.
pub fn shift_date(date: &str, days: i32) -> String {
    use chrono::NaiveDate;
    let parsed = NaiveDate::parse_from_str(date, "%Y-%m-%d").expect("invalid date");
    let shifted = parsed
        .checked_add_signed(chrono::Duration::days(days as i64))
        .expect("date overflow");
    shifted.format("%Y-%m-%d").to_string()
}

/// `(prev_date, prev_slot)` and `(next_date, next_slot)` for chain detection.
pub fn adjacent_slots(date: &str, slot: Slot) -> ((String, Slot), (String, Slot)) {
    use Slot::*;
    let prev = match slot {
        S00_08 => (shift_date(date, -1), S16_24),
        S08_16 => (date.to_owned(), S00_08),
        S16_24 => (date.to_owned(), S08_16),
    };
    let next = match slot {
        S00_08 => (date.to_owned(), S08_16),
        S08_16 => (date.to_owned(), S16_24),
        S16_24 => (shift_date(date, 1), S00_08),
    };
    (prev, next)
}

/// Per-slot pay. `lookup` returns the doctor assigned to (date, slot) in the
/// same shift_type as `assignment` — chain detection is intra-type only.
pub fn compute_slot_pay<F>(assignment: &Assignment, cases: &[ShiftCase], lookup: F) -> SlotPay
where
    F: Fn(&str, Slot) -> Option<String>,
{
    let Some(doctor) = &assignment.doctor_name else {
        return SlotPay {
            base: 0.0,
            deduction: 0.0,
            case_bonus: 0.0,
            total: 0.0,
            reason: "ไม่มีแพทย์ในเวรนี้".into(),
        };
    };

    let (prev, next) = adjacent_slots(&assignment.date, assignment.slot);
    let chained = lookup(&prev.0, prev.1).as_deref() == Some(doctor)
        || lookup(&next.0, next.1).as_deref() == Some(doctor);
    let base = if chained {
        SHIFT_PAY_CHAIN_16H
    } else {
        SHIFT_PAY_SOLO_8H
    };

    let is_out = matches!(assignment.shift_type, ShiftType::OutHos);
    let case_count = cases.len() as i32;

    let (minutes_out, reason_detail) = if is_out {
        let m: i32 = cases
            .iter()
            .map(|c| case_minutes(c.leave_time.as_deref(), c.return_time.as_deref()))
            .sum();
        (m, format!("{case_count} เคส, ออกรวม {m} นาที"))
    } else {
        let m = case_count * IN_HOS_MIN_PER_CASE;
        (
            m,
            format!("{case_count} เคส × {IN_HOS_MIN_PER_CASE} นาที = {m} นาที"),
        )
    };

    let units = deduction_units(minutes_out);
    let deduction = (units as f64) * DEDUCT_PER_HALF_HOUR;
    let capped_deduct = deduction.min(base);
    let case_bonus = (case_count as f64)
        * if is_out {
            CASE_BONUS_OUT_HOS
        } else {
            CASE_BONUS_IN_HOS
        };
    let total = (base - capped_deduct) + case_bonus;

    let chain_tag = if chained { "16ชม.chain" } else { "8ชม." };
    let deduct_tag = if units > 0 {
        format!(" → หัก {units}×{DEDUCT_PER_HALF_HOUR}")
    } else {
        String::new()
    };
    SlotPay {
        base,
        deduction: capped_deduct,
        case_bonus,
        total,
        reason: format!("{chain_tag} · {reason_detail}{deduct_tag}"),
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    fn empty_lookup(_d: &str, _s: Slot) -> Option<String> { None }

    fn assign(date: &str, slot: Slot, doc: Option<&str>, shift_type: ShiftType) -> Assignment {
        Assignment {
            shift_type,
            date: date.into(),
            slot,
            doctor_name: doc.map(str::to_owned),
        }
    }

    #[test]
    fn no_doctor_returns_zero() {
        let a = assign("2026-05-12", Slot::S08_16, None, ShiftType::OutHos);
        let p = compute_slot_pay(&a, &[], empty_lookup);
        assert_eq!(p.total, 0.0);
        assert_eq!(p.base, 0.0);
    }

    #[test]
    fn solo_8h_no_cases_pays_780() {
        let a = assign("2026-05-12", Slot::S08_16, Some("อนิรุต"), ShiftType::OutHos);
        let p = compute_slot_pay(&a, &[], empty_lookup);
        assert_eq!(p.total, 780.0);
        assert_eq!(p.base, 780.0);
    }

    #[test]
    fn chain_detected_via_next_slot_pays_760() {
        let a = assign("2026-05-12", Slot::S08_16, Some("อนิรุต"), ShiftType::OutHos);
        let lookup = |d: &str, s: Slot| {
            if d == "2026-05-12" && s == Slot::S16_24 { Some("อนิรุต".into()) } else { None }
        };
        let p = compute_slot_pay(&a, &[], lookup);
        assert_eq!(p.base, 760.0);
        assert_eq!(p.total, 760.0);
    }

    #[test]
    fn chain_across_midnight() {
        // 16-24 on May 12 + 00-08 on May 13 = chain
        let a = assign("2026-05-12", Slot::S16_24, Some("อนิรุต"), ShiftType::OutHos);
        let lookup = |d: &str, s: Slot| {
            if d == "2026-05-13" && s == Slot::S00_08 { Some("อนิรุต".into()) } else { None }
        };
        let p = compute_slot_pay(&a, &[], lookup);
        assert_eq!(p.base, 760.0);
    }

    #[test]
    fn grace_period_zero_to_four_min_no_deduction() {
        assert_eq!(deduction_units(0), 0);
        assert_eq!(deduction_units(4), 0);
        assert_eq!(deduction_units(5), 1);
    }

    #[test]
    fn deduction_steps_correct() {
        assert_eq!(deduction_units(5), 1);
        assert_eq!(deduction_units(34), 1);
        assert_eq!(deduction_units(35), 2);
        assert_eq!(deduction_units(64), 2);
        assert_eq!(deduction_units(65), 3);
        assert_eq!(deduction_units(94), 3);
    }

    #[test]
    fn out_hos_one_case_with_deduction() {
        // Doctor out 13:00-13:25 = 25 min → 1 unit deduction × 48.75
        // + 1 case bonus 1800 = base 780 - 48.75 + 1800 = 2531.25
        let a = assign("2026-05-12", Slot::S08_16, Some("อนิรุต"), ShiftType::OutHos);
        let cases = vec![ShiftCase {
            shift_type: ShiftType::OutHos,
            date: "2026-05-12".into(),
            slot: Slot::S08_16,
            leave_time: Some("13:00".into()),
            return_time: Some("13:25".into()),
        }];
        let p = compute_slot_pay(&a, &cases, empty_lookup);
        assert_eq!(p.base, 780.0);
        assert_eq!(p.deduction, 48.75);
        assert_eq!(p.case_bonus, 1800.0);
        assert_eq!(p.total, 780.0 - 48.75 + 1800.0);
    }

    #[test]
    fn in_hos_three_cases_30min_virtual_one_unit() {
        // 3 cases × 10 = 30 min → still within 5-34 range → 1 unit deduction
        // + 3 case bonus 1200 = 780 - 48.75 + 3600 = 4331.25
        let a = assign("2026-05-12", Slot::S08_16, Some("กนก"), ShiftType::InHos);
        let cases: Vec<_> = (0..3)
            .map(|_| ShiftCase {
                shift_type: ShiftType::InHos,
                date: "2026-05-12".into(),
                slot: Slot::S08_16,
                leave_time: None,
                return_time: None,
            })
            .collect();
        let p = compute_slot_pay(&a, &cases, empty_lookup);
        assert_eq!(p.base, 780.0);
        assert_eq!(p.deduction, 48.75);
        assert_eq!(p.case_bonus, 3600.0);
        assert_eq!(p.total, 780.0 - 48.75 + 3600.0);
    }

    #[test]
    fn cross_midnight_case_duration() {
        // 23:30 → 00:15 = 45 min
        assert_eq!(case_minutes(Some("23:30"), Some("00:15")), 45);
    }

    #[test]
    fn deduction_capped_at_base_pay() {
        // 30 cases × 10 = 300 min = 10 units × 48.75 = 487.50 > base 780
        // 100 cases × 10 = 1000 min = 34 units × 48.75 = 1657.50, capped at base 780
        // base goes to 0, case_bonus = 100 × 1200 = 120,000
        let a = assign("2026-05-12", Slot::S08_16, Some("กนก"), ShiftType::InHos);
        let cases: Vec<_> = (0..100)
            .map(|_| ShiftCase {
                shift_type: ShiftType::InHos,
                date: "2026-05-12".into(),
                slot: Slot::S08_16,
                leave_time: None,
                return_time: None,
            })
            .collect();
        let p = compute_slot_pay(&a, &cases, empty_lookup);
        assert_eq!(p.deduction, 780.0); // capped
        assert_eq!(p.case_bonus, 120_000.0);
        assert_eq!(p.total, 120_000.0);
    }
}
