//! Single-sheet, printable monthly in-hospital duty report.
use chrono::{Datelike, NaiveDate};
use rust_xlsxwriter::{Format, FormatAlign, FormatBorder, Formula, Workbook};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseReportRow {
    pub date: String,
    pub start: String,
    pub end: String,
    pub activity: String,
    pub compensation: f64,
    pub deceased_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseReportPayload {
    pub year_month: String,
    pub doctor_full_name: String,
    pub save_path: String,
    pub rows: Vec<CaseReportRow>,
}

const MONTHS: [&str; 12] = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
];
const SHORT_MONTHS: [&str; 12] = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
];
pub fn write_case_report(payload: &CaseReportPayload) -> Result<String, String> {
    let month = NaiveDate::parse_from_str(&format!("{}-01", payload.year_month), "%Y-%m-%d")
        .map_err(|_| "เดือนที่ส่งออกไม่ถูกต้อง".to_string())?;
    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();
    let plain = Format::new()
        .set_font_name("TH Sarabun New")
        .set_font_size(16);
    let centered = plain
        .clone()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter);
    let cell = centered.clone().set_border(FormatBorder::Thin);
    let header = cell.clone().set_bold();
    let money = cell
        .clone()
        .set_align(FormatAlign::Right)
        .set_num_format("#,##0.00");
    let title = centered.clone().set_bold();

    let write = |e: rust_xlsxwriter::XlsxError| e.to_string();
    sheet.set_name("รายงานเคส").map_err(write)?;
    sheet.set_screen_gridlines(false);
    sheet.set_default_row_height(24);
    for (col, width) in [14.0, 10.0, 10.0, 46.0, 28.0, 24.0].iter().enumerate() {
        sheet.set_column_width(col as u16, *width).map_err(write)?;
    }
    sheet
        .merge_range(0, 0, 0, 5, "แบบรายงานการปฏิบัติงาน", &title)
        .map_err(write)?;
    sheet
        .merge_range(
            1,
            0,
            1,
            5,
            &format!("ของ {} กลุ่มงานนิติเวช", payload.doctor_full_name),
            &centered,
        )
        .map_err(write)?;
    sheet
        .merge_range(
            2,
            0,
            2,
            5,
            &format!(
                "ประจำเดือน {} พ.ศ. {}",
                MONTHS[month.month0() as usize],
                month.year() + 543
            ),
            &centered,
        )
        .map_err(write)?;
    sheet
        .merge_range(4, 0, 5, 0, "วันเดือนปี", &header)
        .map_err(write)?;
    sheet
        .merge_range(4, 1, 4, 2, "เวลาปฏิบัติงาน", &header)
        .map_err(write)?;
    sheet
        .write_string_with_format(5, 1, "เริ่ม", &header)
        .map_err(write)?;
    sheet
        .write_string_with_format(5, 2, "เสร็จสิ้น", &header)
        .map_err(write)?;
    sheet
        .merge_range(4, 3, 5, 3, "ปฏิบัติงาน", &header)
        .map_err(write)?;
    sheet
        .merge_range(
            4,
            5,
            5,
            5,
            "ค่าผ่า/\nค่าชันสูตรนอก/\nค่าชันสูตรใน",
            &header.clone().set_text_wrap(),
        )
        .map_err(write)?;
    sheet
        .merge_range(
            4,
            4,
            5,
            4,
            "ชื่อ-สกุล\nผู้เสียชีวิต",
            &header.clone().set_text_wrap(),
        )
        .map_err(write)?;
    sheet.set_row_height(4, 42).map_err(write)?;
    sheet.set_row_height(5, 30).map_err(write)?;
    let mut row = 6;
    let mut total = 0.0;
    for entry in &payload.rows {
        let date = NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d")
            .map_err(|_| "วันที่ไม่ถูกต้อง".to_string())?;
        if date.year() != month.year()
            || date.month() != month.month()
            || !entry.compensation.is_finite()
        {
            return Err("ข้อมูลรายงานไม่ตรงเดือนหรือค่าตอบแทนไม่ถูกต้อง".into());
        }
        let label = format!(
            "{} {} {:02}",
            date.day(),
            SHORT_MONTHS[date.month0() as usize],
            (date.year() + 543) % 100
        );
        sheet
            .write_string_with_format(row, 0, &label, &cell)
            .map_err(write)?;
        sheet
            .write_string_with_format(row, 1, &entry.start, &cell)
            .map_err(write)?;
        sheet
            .write_string_with_format(row, 2, &entry.end, &cell)
            .map_err(write)?;
        sheet
            .write_string_with_format(row, 3, &entry.activity, &cell.clone().set_text_wrap())
            .map_err(write)?;
        sheet
            .write_number_with_format(row, 5, entry.compensation, &money)
            .map_err(write)?;
        sheet
            .write_string_with_format(row, 4, &entry.deceased_name, &cell.clone().set_text_wrap())
            .map_err(write)?;
        sheet.set_row_height(row, 38).map_err(write)?;
        total += entry.compensation;
        row += 1;
    }
    sheet
        .merge_range(row, 0, row, 4, "รวมเงิน", &header)
        .map_err(write)?;
    if payload.rows.is_empty() {
        sheet
            .write_number_with_format(row, 5, 0, &money)
            .map_err(write)?;
    } else {
        sheet
            .write_formula_with_format(
                row,
                5,
                Formula::new(format!("=SUM(F7:F{row})")).set_result(total.to_string()),
                &money,
            )
            .map_err(write)?;
    }
    row += 2;
    sheet
        .merge_range(
            row,
            0,
            row,
            5,
            "ลงนาม..............................................................ผู้ปฏิบัติงาน",
            &centered,
        )
        .map_err(write)?;
    sheet
        .merge_range(
            row + 1,
            0,
            row + 1,
            5,
            &format!("({})", payload.doctor_full_name),
            &centered,
        )
        .map_err(write)?;
    sheet.merge_range(row + 3, 0, row + 3, 5, "รับรองโดย..............................................................หัวหน้ากลุ่มงานนิติเวช", &centered).map_err(write)?;
    sheet
        .merge_range(row + 4, 0, row + 4, 5, "(นายแพทย์กนก  วัยธรรม)", &centered)
        .map_err(write)?;

    sheet
        .set_paper_size(9)
        .set_portrait()
        .set_margins(0.4, 0.4, 0.4, 0.4, 0.2, 0.2);
    sheet
        .set_print_fit_to_pages(1, 0)
        .set_print_center_horizontally(true);
    sheet.set_repeat_rows(4, 5).map_err(write)?;
    sheet.set_print_area(0, 0, row + 4, 5).map_err(write)?;
    workbook.save(&payload.save_path).map_err(write)?;
    Ok(payload.save_path.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn writes_case_report() {
        let path = std::env::var("ACCUCOUNT_CASE_PREVIEW").unwrap_or_else(|_| {
            std::env::temp_dir()
                .join("case-report-test.xlsx")
                .to_string_lossy()
                .into_owned()
        });
        let payload = CaseReportPayload {
            year_month: "2026-10".into(),
            doctor_full_name: "นายแพทย์กวินท์  ศัลย์วิเศษ".into(),
            save_path: path.clone(),
            rows: [
                ("ชันสูตรพลิกศพในโรงพยาบาลพระปกเกล้า", 1200.0),
                ("ชันสูตรพลิกศพนอกโรงพยาบาลพระปกเกล้า", 1800.0),
                ("ผ่าตรวจภายในและตัดชิ้นเนื้อศพ", 4500.0),
            ]
            .iter()
            .map(|(activity, pay)| CaseReportRow {
                date: "2026-10-01".into(),
                start: "08.00 น.".into(),
                end: "08.10 น.".into(),
                activity: (*activity).into(),
                deceased_name: "นายทดสอบ นามสกุล".into(),
                compensation: *pay,
            })
            .collect(),
        };
        assert_eq!(write_case_report(&payload).unwrap(), path);
        if std::env::var("ACCUCOUNT_CASE_PREVIEW").is_err() {
            std::fs::remove_file(path).unwrap();
        }
    }
}
