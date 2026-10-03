//! Single-sheet, printable monthly in-hospital duty report.
use chrono::{Datelike, NaiveDate};
use rust_xlsxwriter::{Format, FormatAlign, FormatBorder, Formula, Workbook};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorReportRow {
    pub date: String,
    pub start: String,
    pub end: String,
    pub activity: String,
    pub compensation: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorReportPayload {
    pub year_month: String,
    pub doctor_full_name: String,
    pub save_path: String,
    pub rows: Vec<DoctorReportRow>,
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
const NOTE: &str = "*หมายเหตุ กรณีปฏิบัติงาน เศษของชั่วโมงถ้าไม่ถึงครึ่งชั่วโมงให้ปัดเศสเป็นครึ่งชั่วโมง กรณีถึงครึ่งชั่วโมง ให้ปัดเศษเป็น 1 ชั่วโมง";

pub fn write_doctor_report(payload: &DoctorReportPayload) -> Result<String, String> {
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
    let note = plain.clone().set_text_wrap().set_align(FormatAlign::Top);
    let write = |e: rust_xlsxwriter::XlsxError| e.to_string();
    sheet.set_name("รายงานเวรชันสูตรใน").map_err(write)?;
    sheet.set_screen_gridlines(false);
    sheet.set_default_row_height(24);
    for (col, width) in [16.0, 12.0, 12.0, 40.0, 18.0].iter().enumerate() {
        sheet.set_column_width(col as u16, *width).map_err(write)?;
    }
    sheet
        .merge_range(0, 0, 0, 4, "แบบรายงานการปฏิบัติงานนอกเวลา", &title)
        .map_err(write)?;
    sheet
        .merge_range(
            1,
            0,
            1,
            4,
            &format!("ของ {} กลุ่มงานนิติเวช", payload.doctor_full_name),
            &centered,
        )
        .map_err(write)?;
    sheet
        .merge_range(
            2,
            0,
            2,
            4,
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
        .merge_range(4, 4, 5, 4, "ค่าตอบแทน", &header)
        .map_err(write)?;
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
            .write_string_with_format(row, 3, &entry.activity, &cell)
            .map_err(write)?;
        sheet
            .write_number_with_format(row, 4, entry.compensation, &money)
            .map_err(write)?;
        total += entry.compensation;
        row += 1;
    }
    sheet
        .merge_range(row, 0, row, 3, "รวมเงิน", &header)
        .map_err(write)?;
    if payload.rows.is_empty() {
        sheet
            .write_number_with_format(row, 4, 0, &money)
            .map_err(write)?;
    } else {
        sheet
            .write_formula_with_format(
                row,
                4,
                Formula::new(format!("=SUM(E7:E{row})")).set_result(total.to_string()),
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
            4,
            "ลงนาม..............................................................ผู้ปฏิบัติงาน",
            &centered,
        )
        .map_err(write)?;
    sheet
        .merge_range(
            row + 1,
            0,
            row + 1,
            4,
            &format!("({})", payload.doctor_full_name),
            &centered,
        )
        .map_err(write)?;
    sheet.merge_range(row + 3, 0, row + 3, 4, "รับรองโดย..............................................................หัวหน้ากลุ่มงานนิติเวช", &centered).map_err(write)?;
    sheet
        .merge_range(row + 4, 0, row + 4, 4, "(นายแพทย์กนก  วัยธรรม)", &centered)
        .map_err(write)?;
    sheet
        .merge_range(row + 6, 0, row + 7, 4, NOTE, &note)
        .map_err(write)?;
    sheet
        .set_paper_size(9)
        .set_portrait()
        .set_margins(0.4, 0.4, 0.4, 0.4, 0.2, 0.2);
    sheet
        .set_print_fit_to_pages(1, 0)
        .set_print_center_horizontally(true);
    sheet.set_repeat_rows(4, 5).map_err(write)?;
    sheet.set_print_area(0, 0, row + 7, 4).map_err(write)?;
    workbook.save(&payload.save_path).map_err(write)?;
    Ok(payload.save_path.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_printable_report_and_checks_month() {
        let preview = std::env::var("ACCUCOUNT_REPORT_PREVIEW").ok();
        let path = preview.clone().unwrap_or_else(|| {
            std::env::temp_dir()
                .join(format!("doctor-report-{}.xlsx", std::process::id()))
                .to_string_lossy()
                .into_owned()
        });
        let mut payload = DoctorReportPayload {
            year_month: "2026-10".into(),
            doctor_full_name: "นายแพทย์กวินท์  ศัลย์วิเศษ".into(),
            save_path: path.clone(),
            rows: vec![
                DoctorReportRow {
                    date: "2026-10-01".into(),
                    start: "00.00 น.".into(),
                    end: "08.00 น.".into(),
                    activity: "เวรรับปรึกษานิติเวช".into(),
                    compensation: 780.0,
                },
                DoctorReportRow {
                    date: "2026-10-02".into(),
                    start: "16.00 น.".into(),
                    end: "24.00 น.".into(),
                    activity: "ปฏิบัติงานชันสูตรนอกเวลา".into(),
                    compensation: 633.75,
                },
            ],
        };
        assert_eq!(write_doctor_report(&payload).unwrap(), path);
        assert!(std::fs::metadata(&path).unwrap().len() > 0);
        payload.rows[0].date = "2026-09-30".into();
        assert!(write_doctor_report(&payload).is_err());
        if preview.is_none() {
            std::fs::remove_file(&path).unwrap();
        }
    }

    #[test]
    fn empty_report_has_zero_total_and_signatures() {
        let path =
            std::env::temp_dir().join(format!("empty-doctor-report-{}.xlsx", std::process::id()));
        let payload = DoctorReportPayload {
            year_month: "2026-10".into(),
            doctor_full_name: "นายแพทย์อนิรุต  วรวาท".into(),
            save_path: path.to_string_lossy().into_owned(),
            rows: vec![],
        };
        assert!(write_doctor_report(&payload).is_ok());
        std::fs::remove_file(path).unwrap();
    }
}
