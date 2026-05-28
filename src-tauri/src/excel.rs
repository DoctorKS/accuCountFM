//! XLSX export — uses `rust_xlsxwriter` (native UTF-8, no BOM hacks).
//!
//! Workbook layout (4 sheets):
//!   1. "ตารางเวร"        — every assignment row, both shift_types
//!   2. "เคสชันสูตร"      — every case row with minutes-out computed
//!   3. "แจกแจงเงิน"      — per-slot pay breakdown (base / deduction / bonus / total)
//!   4. "สรุปรวม"         — 4 doctors × {outHos, inHos, grand} totals
//!
//! Rust re-runs `calc::compute_slot_pay` over the input data — this is the
//! canonical source of truth, so the spreadsheet always agrees with the UI
//! (which uses calc.ts, kept in lockstep via fixture tests).

use crate::calc::{compute_slot_pay, Assignment, ShiftCase, ShiftType, Slot, case_minutes};
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShiftBundle {
    pub assignments: Vec<Assignment>,
    pub cases: Vec<ShiftCase>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPayload {
    pub year_month: String,
    pub save_path: String,
    pub out_hos: Option<ShiftBundle>,
    pub in_hos: Option<ShiftBundle>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub path: String,
    pub doctor_totals: HashMap<String, DoctorTotal>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DoctorTotal {
    pub out_hos: f64,
    pub in_hos: f64,
    pub total: f64,
}

const DOCTORS: &[&str] = &["อนิรุต", "พฤพงศ์", "กนก", "กวินท์"];

fn slot_str(s: Slot) -> &'static str {
    match s {
        Slot::S00_08 => "0000-0800",
        Slot::S08_16 => "0800-1600",
        Slot::S16_24 => "1600-2400",
    }
}

fn shift_type_str(t: ShiftType) -> &'static str {
    match t {
        ShiftType::OutHos => "ชันสูตรนอก",
        ShiftType::InHos => "ชันสูตรใน",
    }
}

fn build_lookup(bundle: &ShiftBundle) -> HashMap<(String, Slot), String> {
    let mut m = HashMap::new();
    for a in &bundle.assignments {
        if let Some(d) = &a.doctor_name {
            m.insert((a.date.clone(), a.slot), d.clone());
        }
    }
    m
}

pub fn write_workbook(payload: &ExportPayload) -> Result<ExportResult, String> {
    let mut wb = Workbook::new();

    let header_fmt = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xEEEEFE))
        .set_border(FormatBorder::Thin)
        .set_align(FormatAlign::Center);
    let money_fmt = Format::new()
        .set_num_format("฿ #,##0.00;[Red]-฿ #,##0.00")
        .set_align(FormatAlign::Right);
    let center = Format::new().set_align(FormatAlign::Center);

    // ─── Sheet 1: assignments ───────────────────────────────────────────────
    let sh1 = wb.add_worksheet().set_name("ตารางเวร").map_err(|e| e.to_string())?;
    let h1 = ["วันที่", "ช่วงเวลา", "ประเภท", "แพทย์"];
    for (c, label) in h1.iter().enumerate() {
        sh1.write_with_format(0, c as u16, *label, &header_fmt).map_err(|e| e.to_string())?;
    }
    let mut row = 1u32;
    for bundle in [&payload.out_hos, &payload.in_hos].into_iter().flatten() {
        let mut sorted = bundle.assignments.iter().collect::<Vec<_>>();
        sorted.sort_by(|a, b| a.date.cmp(&b.date).then(slot_str(a.slot).cmp(slot_str(b.slot))));
        for a in sorted {
            sh1.write_with_format(row, 0, &a.date, &center).map_err(|e| e.to_string())?;
            sh1.write_with_format(row, 1, slot_str(a.slot), &center).map_err(|e| e.to_string())?;
            sh1.write_with_format(row, 2, shift_type_str(a.shift_type), &center).map_err(|e| e.to_string())?;
            sh1.write_string(row, 3, a.doctor_name.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
            row += 1;
        }
    }
    sh1.set_column_width(0, 12.0).ok();
    sh1.set_column_width(1, 14.0).ok();
    sh1.set_column_width(2, 14.0).ok();
    sh1.set_column_width(3, 14.0).ok();

    // ─── Sheet 2: cases ─────────────────────────────────────────────────────
    let sh2 = wb.add_worksheet().set_name("เคสชันสูตร").map_err(|e| e.to_string())?;
    let h2 = ["วันที่", "ช่วงเวลา", "ประเภท", "ชื่อเคส", "เวลาออก", "เวลากลับ", "นาทีออก"];
    for (c, label) in h2.iter().enumerate() {
        sh2.write_with_format(0, c as u16, *label, &header_fmt).map_err(|e| e.to_string())?;
    }
    let mut row = 1u32;
    for bundle in [&payload.out_hos, &payload.in_hos].into_iter().flatten() {
        let mut sorted = bundle.cases.iter().collect::<Vec<_>>();
        sorted.sort_by(|a, b| a.date.cmp(&b.date).then(slot_str(a.slot).cmp(slot_str(b.slot))));
        for c in sorted {
            sh2.write_with_format(row, 0, &c.date, &center).map_err(|e| e.to_string())?;
            sh2.write_with_format(row, 1, slot_str(c.slot), &center).map_err(|e| e.to_string())?;
            sh2.write_with_format(row, 2, shift_type_str(c.shift_type), &center).map_err(|e| e.to_string())?;
            sh2.write_string(row, 3, "").map_err(|e| e.to_string())?; // case_name not in calc::ShiftCase
            sh2.write_string(row, 4, c.leave_time.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
            sh2.write_string(row, 5, c.return_time.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
            let mins = case_minutes(c.leave_time.as_deref(), c.return_time.as_deref());
            sh2.write_number(row, 6, mins as f64).map_err(|e| e.to_string())?;
            row += 1;
        }
    }
    for (i, w) in [12.0, 14.0, 14.0, 22.0, 12.0, 12.0, 10.0].iter().enumerate() {
        sh2.set_column_width(i as u16, *w).ok();
    }

    // ─── Sheet 3: per-slot pay breakdown ────────────────────────────────────
    let sh3 = wb.add_worksheet().set_name("แจกแจงเงิน").map_err(|e| e.to_string())?;
    let h3 = ["วันที่", "ช่วงเวลา", "ประเภท", "แพทย์", "ฐาน", "หัก", "เคส", "โบนัส", "รวม"];
    for (c, label) in h3.iter().enumerate() {
        sh3.write_with_format(0, c as u16, *label, &header_fmt).map_err(|e| e.to_string())?;
    }
    let mut row = 1u32;
    let mut totals: HashMap<String, DoctorTotal> = HashMap::new();
    for &name in DOCTORS {
        totals.insert(name.to_string(), DoctorTotal::default());
    }
    for bundle in [&payload.out_hos, &payload.in_hos].into_iter().flatten() {
        let lookup_map = build_lookup(bundle);
        let lookup = |d: &str, s: Slot| -> Option<String> {
            lookup_map.get(&(d.to_string(), s)).cloned()
        };
        let mut sorted = bundle.assignments.iter().collect::<Vec<_>>();
        sorted.sort_by(|a, b| a.date.cmp(&b.date).then(slot_str(a.slot).cmp(slot_str(b.slot))));
        for a in sorted {
            if a.doctor_name.is_none() {
                continue;
            }
            let cases_in_slot: Vec<ShiftCase> = bundle
                .cases
                .iter()
                .filter(|c| c.date == a.date && c.slot == a.slot)
                .cloned()
                .collect();
            let pay = compute_slot_pay(a, &cases_in_slot, &lookup);
            let doc = a.doctor_name.clone().unwrap();
            sh3.write_with_format(row, 0, &a.date, &center).map_err(|e| e.to_string())?;
            sh3.write_with_format(row, 1, slot_str(a.slot), &center).map_err(|e| e.to_string())?;
            sh3.write_with_format(row, 2, shift_type_str(a.shift_type), &center).map_err(|e| e.to_string())?;
            sh3.write_string(row, 3, &doc).map_err(|e| e.to_string())?;
            sh3.write_number_with_format(row, 4, pay.base, &money_fmt).map_err(|e| e.to_string())?;
            sh3.write_number_with_format(row, 5, -pay.deduction, &money_fmt).map_err(|e| e.to_string())?;
            sh3.write_number(row, 6, cases_in_slot.len() as f64).map_err(|e| e.to_string())?;
            sh3.write_number_with_format(row, 7, pay.case_bonus, &money_fmt).map_err(|e| e.to_string())?;
            sh3.write_number_with_format(row, 8, pay.total, &money_fmt).map_err(|e| e.to_string())?;
            if let Some(t) = totals.get_mut(&doc) {
                match a.shift_type {
                    ShiftType::OutHos => t.out_hos += pay.total,
                    ShiftType::InHos => t.in_hos += pay.total,
                }
                t.total += pay.total;
            }
            row += 1;
        }
    }
    for (i, w) in [12.0, 14.0, 14.0, 14.0, 12.0, 12.0, 8.0, 14.0, 14.0].iter().enumerate() {
        sh3.set_column_width(i as u16, *w).ok();
    }

    // ─── Sheet 4: doctor totals ─────────────────────────────────────────────
    let sh4 = wb.add_worksheet().set_name("สรุปรวม").map_err(|e| e.to_string())?;
    sh4.write_with_format(0, 0, format!("เดือน {}", payload.year_month), &header_fmt).map_err(|e| e.to_string())?;
    let h4 = ["แพทย์", "ชันสูตรนอก", "ชันสูตรใน", "รวม"];
    for (c, label) in h4.iter().enumerate() {
        sh4.write_with_format(2, c as u16, *label, &header_fmt).map_err(|e| e.to_string())?;
    }
    let mut row = 3u32;
    for &name in DOCTORS {
        let t = totals.get(name).cloned().unwrap_or_default();
        sh4.write_string(row, 0, name).map_err(|e| e.to_string())?;
        sh4.write_number_with_format(row, 1, t.out_hos, &money_fmt).map_err(|e| e.to_string())?;
        sh4.write_number_with_format(row, 2, t.in_hos, &money_fmt).map_err(|e| e.to_string())?;
        sh4.write_number_with_format(row, 3, t.total, &money_fmt).map_err(|e| e.to_string())?;
        row += 1;
    }
    // Grand total row
    sh4.write_with_format(row, 0, "รวมทั้งหมด", &header_fmt).map_err(|e| e.to_string())?;
    let sum_out: f64 = DOCTORS.iter().map(|n| totals.get(*n).map(|t| t.out_hos).unwrap_or(0.0)).sum();
    let sum_in: f64 = DOCTORS.iter().map(|n| totals.get(*n).map(|t| t.in_hos).unwrap_or(0.0)).sum();
    let sum_all: f64 = sum_out + sum_in;
    sh4.write_number_with_format(row, 1, sum_out, &money_fmt).map_err(|e| e.to_string())?;
    sh4.write_number_with_format(row, 2, sum_in, &money_fmt).map_err(|e| e.to_string())?;
    sh4.write_number_with_format(row, 3, sum_all, &money_fmt).map_err(|e| e.to_string())?;
    for (i, w) in [14.0, 16.0, 16.0, 16.0].iter().enumerate() {
        sh4.set_column_width(i as u16, *w).ok();
    }

    wb.save(Path::new(&payload.save_path)).map_err(|e| e.to_string())?;

    Ok(ExportResult {
        path: payload.save_path.clone(),
        doctor_totals: totals,
    })
}
