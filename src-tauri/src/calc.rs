//! # Shift pay calculation — single source of truth
//!
//! Constants and rules here MUST match `src/lib/calc.ts` / `src/lib/constants.ts`.
//! Any change requires updating both sides AND the table in `CLAUDE.md`.
//!
//! The TS mirror exists only so the UI can show a running total while the user
//! types. Persisted totals always come from this Rust implementation.
//!
//! ## Pay model (v2 — post chain-detection)
//!
//! Each slot is evaluated independently:
//!   1. `is_off_hour(date, slot, holidays)` decides base pay:
//!        off-hour → 780 ฿
//!        in-hour  → 0 ฿
//!   2. Deduction applies only to off-hour base (in-hour base is already 0).
//!   3. Case bonus is paid per case regardless of off/in hour.
//!
//! Off-hour is defined as (matches Shift_count CLAUDE.md):
//!   - Night slot (00-08 or 16-24) on a non-holiday weekday, OR
//!   - Any slot on a weekend (Sat/Sun), OR
//!   - Any slot on a holiday.

use serde::{Deserialize, Serialize};

// ─── Constants — DO NOT change without going through CLAUDE.md guardrails ────
pub const OFF_HOUR_SHIFT_PAY: f64 = 780.0;
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
    pub off_hour: bool,
    pub reason: String,
}

// ─── Off-hour rule (port of Shift_count's isOffHour) ────────────────────────

/// `true` when the slot pays the off-hour rate (780 ฿).
///
/// `holidays` lists day-of-month integers for the *same* month as `date`
/// — the caller must scope the list to the relevant month before calling.
pub fn is_off_hour(date: &str, slot: Slot, holidays: &[u32]) -> bool {
    use chrono::{Datelike, NaiveDate, Weekday};
    let dt = NaiveDate::parse_from_str(date, "%Y-%m-%d").expect("invalid date");
    let is_weekend = matches!(dt.weekday(), Weekday::Sat | Weekday::Sun);
    let day = dt.day();
    let is_holiday = holidays.contains(&day);
    let is_night_slot = matches!(slot, Slot::S00_08 | Slot::S16_24);

    (is_night_slot && !is_weekend && !is_holiday) || is_weekend || is_holiday
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

/// Per-slot pay using the off-hour rule.
///
/// `holidays` is the day-of-month list for the SAME month as `assignment.date`.
/// (Pre-filter at the boundary so this function stays simple — see calc-month.ts
/// for the equivalent on the TS side.)
pub fn compute_slot_pay(
    assignment: &Assignment,
    cases: &[ShiftCase],
    holidays: &[u32],
) -> SlotPay {
    let Some(_doctor) = &assignment.doctor_name else {
        return SlotPay {
            base: 0.0,
            deduction: 0.0,
            case_bonus: 0.0,
            total: 0.0,
            off_hour: false,
            reason: "ไม่มีแพทย์ในเวรนี้".into(),
        };
    };

    let off_hour = is_off_hour(&assignment.date, assignment.slot, holidays);
    let base = if off_hour { OFF_HOUR_SHIFT_PAY } else { 0.0 };

    let is_out = matches!(assignment.shift_type, ShiftType::OutHos);
    let case_count = cases.len() as i32;

    // Deduction only computed for off-hour slots — in-hour base is 0 so any
    // deduction would just stay capped at 0 anyway, and we avoid double-counting
    // minutes_out when the user has cases on an in-hour slot too.
    let (minutes_out, minutes_label) = if off_hour {
        if is_out {
            let m: i32 = cases
                .iter()
                .map(|c| case_minutes(c.leave_time.as_deref(), c.return_time.as_deref()))
                .sum();
            (m, format!("ออกรวม {m} นาที"))
        } else {
            let m = case_count * IN_HOS_MIN_PER_CASE;
            (m, format!("{case_count}×{IN_HOS_MIN_PER_CASE}={m} นาที"))
        }
    } else {
        (0, String::new())
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

    let tag = if off_hour { "นอกเวลา" } else { "ในเวลา" };
    let pieces: Vec<String> = [
        Some(tag.to_string()),
        Some(format!("{case_count} เคส")),
        (!minutes_label.is_empty()).then(|| minutes_label.clone()),
        (units > 0).then(|| format!("หัก {units}×{DEDUCT_PER_HALF_HOUR}")),
    ]
    .into_iter()
    .flatten()
    .collect();

    SlotPay {
        base,
        deduction: capped_deduct,
        case_bonus,
        total,
        off_hour,
        reason: pieces.join(" · "),
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    fn assign(date: &str, slot: Slot, doc: Option<&str>, shift_type: ShiftType) -> Assignment {
        Assignment {
            shift_type,
            date: date.into(),
            slot,
            doctor_name: doc.map(str::to_owned),
        }
    }

    // 2026-05-12 is a Tuesday (weekday). 2026-05-16 is a Saturday.
    const WEEKDAY: &str = "2026-05-12";
    const SATURDAY: &str = "2026-05-16";

    #[test]
    fn off_hour_weekday_night_slots() {
        assert!(is_off_hour(WEEKDAY, Slot::S00_08, &[]));
        assert!(!is_off_hour(WEEKDAY, Slot::S08_16, &[]));
        assert!(is_off_hour(WEEKDAY, Slot::S16_24, &[]));
    }

    #[test]
    fn off_hour_weekend_all_slots() {
        assert!(is_off_hour(SATURDAY, Slot::S00_08, &[]));
        assert!(is_off_hour(SATURDAY, Slot::S08_16, &[]));
        assert!(is_off_hour(SATURDAY, Slot::S16_24, &[]));
    }

    #[test]
    fn off_hour_holiday_promotes_in_hour() {
        // Weekday in-hour slot but with holiday flag → counts as off-hour
        assert!(!is_off_hour(WEEKDAY, Slot::S08_16, &[]));
        assert!(is_off_hour(WEEKDAY, Slot::S08_16, &[12]));
    }

    #[test]
    fn no_doctor_returns_zero() {
        let a = assign(WEEKDAY, Slot::S00_08, None, ShiftType::OutHos);
        let p = compute_slot_pay(&a, &[], &[]);
        assert_eq!(p.total, 0.0);
        assert_eq!(p.base, 0.0);
    }

    #[test]
    fn off_hour_no_cases_pays_780() {
        let a = assign(WEEKDAY, Slot::S00_08, Some("อนิรุต"), ShiftType::OutHos);
        let p = compute_slot_pay(&a, &[], &[]);
        assert_eq!(p.base, 780.0);
        assert_eq!(p.total, 780.0);
        assert!(p.off_hour);
    }

    #[test]
    fn in_hour_weekday_pays_zero_base() {
        let a = assign(WEEKDAY, Slot::S08_16, Some("อนิรุต"), ShiftType::OutHos);
        let p = compute_slot_pay(&a, &[], &[]);
        assert_eq!(p.base, 0.0);
        assert_eq!(p.total, 0.0);
        assert!(!p.off_hour);
    }

    #[test]
    fn in_hour_with_cases_still_pays_bonus() {
        // 3 cases on a weekday in-hour outHos slot:
        //   base = 0, deduction = 0 (in-hour skips), bonus = 3 × 1800 = 5400
        let a = assign(WEEKDAY, Slot::S08_16, Some("กนก"), ShiftType::OutHos);
        let cases = vec![
            ShiftCase { shift_type: ShiftType::OutHos, date: WEEKDAY.into(), slot: Slot::S08_16, leave_time: Some("13:00".into()), return_time: Some("13:25".into()) },
            ShiftCase { shift_type: ShiftType::OutHos, date: WEEKDAY.into(), slot: Slot::S08_16, leave_time: Some("14:00".into()), return_time: Some("14:30".into()) },
            ShiftCase { shift_type: ShiftType::OutHos, date: WEEKDAY.into(), slot: Slot::S08_16, leave_time: Some("15:00".into()), return_time: Some("15:20".into()) },
        ];
        let p = compute_slot_pay(&a, &cases, &[]);
        assert_eq!(p.base, 0.0);
        assert_eq!(p.deduction, 0.0); // no deduction on in-hour
        assert_eq!(p.case_bonus, 5400.0);
        assert_eq!(p.total, 5400.0);
    }

    #[test]
    fn weekend_in_hour_promoted_pays_780() {
        let a = assign(SATURDAY, Slot::S08_16, Some("อนิรุต"), ShiftType::OutHos);
        let p = compute_slot_pay(&a, &[], &[]);
        assert_eq!(p.base, 780.0);
        assert!(p.off_hour);
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
    fn out_hos_off_hour_with_deduction() {
        // Weekday 16-24 (off-hour), 1 case 25min out → base 780 − 48.75 + 1800
        let a = assign(WEEKDAY, Slot::S16_24, Some("อนิรุต"), ShiftType::OutHos);
        let cases = vec![ShiftCase {
            shift_type: ShiftType::OutHos,
            date: WEEKDAY.into(),
            slot: Slot::S16_24,
            leave_time: Some("18:00".into()),
            return_time: Some("18:25".into()),
        }];
        let p = compute_slot_pay(&a, &cases, &[]);
        assert_eq!(p.base, 780.0);
        assert_eq!(p.deduction, 48.75);
        assert_eq!(p.case_bonus, 1800.0);
        assert_eq!(p.total, 780.0 - 48.75 + 1800.0);
    }

    #[test]
    fn in_hos_off_hour_three_cases_30min_virtual() {
        // Weekend 08-16 (off-hour), 3 inHos cases × 10 = 30min → 1 unit deduct
        let a = assign(SATURDAY, Slot::S08_16, Some("กนก"), ShiftType::InHos);
        let cases: Vec<_> = (0..3)
            .map(|_| ShiftCase {
                shift_type: ShiftType::InHos,
                date: SATURDAY.into(),
                slot: Slot::S08_16,
                leave_time: None,
                return_time: None,
            })
            .collect();
        let p = compute_slot_pay(&a, &cases, &[]);
        assert_eq!(p.base, 780.0);
        assert_eq!(p.deduction, 48.75);
        assert_eq!(p.case_bonus, 3600.0);
        assert_eq!(p.total, 780.0 - 48.75 + 3600.0);
    }

    #[test]
    fn deduction_capped_at_base_pay() {
        // Off-hour, 100 inHos cases × 10 = 1000min → many units → capped at 780
        let a = assign(WEEKDAY, Slot::S00_08, Some("กนก"), ShiftType::InHos);
        let cases: Vec<_> = (0..100)
            .map(|_| ShiftCase {
                shift_type: ShiftType::InHos,
                date: WEEKDAY.into(),
                slot: Slot::S00_08,
                leave_time: None,
                return_time: None,
            })
            .collect();
        let p = compute_slot_pay(&a, &cases, &[]);
        assert_eq!(p.deduction, 780.0);
        assert_eq!(p.case_bonus, 120_000.0);
        assert_eq!(p.total, 120_000.0);
    }

    #[test]
    fn cross_midnight_case_duration() {
        assert_eq!(case_minutes(Some("23:30"), Some("00:15")), 45);
    }
}
