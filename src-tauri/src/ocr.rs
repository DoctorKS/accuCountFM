//! OCR ตารางเวร via Claude Sonnet 4.6 vision + tool_use.
//!
//! Ported from `Shift_count/supabase/functions/ocr/index.ts` with two changes:
//!   1. Drop the `patient` (ตรวจผู้ป่วยคดี) column — out of scope for this app.
//!      System prompt explicitly tells Claude to ignore it.
//!   2. Slot schema is uniform across all 3 slots: { outHos, inHos } only.
//!
//! The model is asked to call a `submit_doctor_schedule` tool with input
//! matching the JSON schema below; this guarantees parseable output even
//! when the photo is poor.

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const MODEL: &str = "claude-sonnet-4-6";
const ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const DOCTORS: &[&str] = &["อนิรุต", "พฤพงศ์", "กนก", "กวินท์"];

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrSlot {
    #[serde(rename = "outHos")]
    pub out_hos: String,
    #[serde(rename = "inHos")]
    pub in_hos: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrDay {
    pub date: u32,
    pub weekday: String,
    pub shifts: OcrShifts,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrShifts {
    #[serde(rename = "0000-0800")]
    pub s00_08: OcrSlot,
    #[serde(rename = "0800-1600")]
    pub s08_16: OcrSlot,
    #[serde(rename = "1600-2400")]
    pub s16_24: OcrSlot,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OcrResult {
    pub month: String,
    pub days: Vec<OcrDay>,
}

/// Detect image format from leading bytes to set the right media_type on
/// the Anthropic vision content block. Defaults to image/jpeg for phone uploads.
fn guess_media_type(bytes: &[u8]) -> &'static str {
    if bytes.len() < 4 {
        return "image/jpeg";
    }
    if bytes.starts_with(b"\xFF\xD8\xFF") {
        return "image/jpeg";
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return "image/png";
    }
    if bytes.starts_with(b"GIF8") {
        return "image/gif";
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }
    "image/jpeg"
}

/// Build the calendar of weekdays for `ym` so the model can verify the
/// weekday column rather than reading it off the photo. Holidays come in
/// as day-of-month integers.
fn build_calendar(ym: &str, holidays: &[u32]) -> String {
    use chrono::{Datelike, NaiveDate, Weekday};
    let (y, m) = ym
        .split_once('-')
        .and_then(|(y, m)| Some((y.parse::<i32>().ok()?, m.parse::<u32>().ok()?)))
        .unwrap_or((2026, 5));
    let first = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    let last = if m == 12 {
        NaiveDate::from_ymd_opt(y + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(y, m + 1, 1).unwrap()
    };
    let dim = last.signed_duration_since(first).num_days() as u32;
    let th = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
    let mut out = String::new();
    for d in 1..=dim {
        let dt = NaiveDate::from_ymd_opt(y, m, d).unwrap();
        let wd_idx = match dt.weekday() {
            Weekday::Mon => 0,
            Weekday::Tue => 1,
            Weekday::Wed => 2,
            Weekday::Thu => 3,
            Weekday::Fri => 4,
            Weekday::Sat => 5,
            Weekday::Sun => 6,
        };
        let is_weekend = matches!(dt.weekday(), Weekday::Sat | Weekday::Sun);
        let is_hol = holidays.contains(&d);
        let tag = match (is_weekend, is_hol) {
            (true, true) => " (วันหยุดสุดสัปดาห์ + นักขัตฤกษ์)",
            (true, false) => " (วันหยุดสุดสัปดาห์)",
            (false, true) => " (วันนักขัตฤกษ์)",
            _ => "",
        };
        out.push_str(&format!("  {d} = {}{tag}\n", th[wd_idx]));
    }
    out
}

fn slot_schema(names: &[&str]) -> Value {
    let mut choices: Vec<String> = names.iter().map(|s| s.to_string()).collect();
    choices.push(String::new());
    json!({
      "type": "object",
      "required": ["outHos", "inHos"],
      "additionalProperties": false,
      "properties": {
        "outHos": { "type": "string", "enum": choices, "description": "ชื่อแพทย์เวรชันสูตรนอกรพ. ('' ถ้าไม่มี)" },
        "inHos": { "type": "string", "enum": choices, "description": "ชื่อแพทย์เวรชันสูตรในรพ./รับปรึกษารพช. ('' ถ้าไม่มี)" }
      }
    })
}

fn tool_schema(ym: &str) -> Value {
    let slot = slot_schema(DOCTORS);
    json!({
      "type": "object",
      "required": ["month", "days"],
      "additionalProperties": false,
      "properties": {
        "month": { "type": "string", "pattern": "^\\d{4}-\\d{2}$", "description": format!("ต้อง = {ym}") },
        "days": {
          "type": "array",
          "minItems": 28,
          "maxItems": 31,
          "items": {
            "type": "object",
            "required": ["date", "weekday", "shifts"],
            "additionalProperties": false,
            "properties": {
              "date": { "type": "integer", "minimum": 1, "maximum": 31 },
              "weekday": { "type": "string", "description": "ตัวย่อภาษาไทย: อา จ อ พ พฤ ศ ส" },
              "shifts": {
                "type": "object",
                "required": ["0000-0800", "0800-1600", "1600-2400"],
                "additionalProperties": false,
                "properties": {
                  "0000-0800": slot.clone(),
                  "0800-1600": slot.clone(),
                  "1600-2400": slot
                }
              }
            }
          }
        }
      }
    })
}

fn system_prompt(ym: &str, holidays: &[u32]) -> String {
    let calendar = build_calendar(ym, holidays);
    let names = DOCTORS.join(", ");
    format!(
        r#"คุณคือ OCR engine สำหรับตารางเวรชันสูตรของแพทย์โรงพยาบาลในประเทศไทย
เดือนปัจจุบัน: {ym}
รายชื่อแพทย์ในเวร (ใช้ชื่อจากรายการนี้เท่านั้น): {names}

🎨 สีในตารางเป็น primary signal ที่แม่นกว่าตัวอักษร — อ่านสีก่อนตัวอักษร:
  สีม่วง (purple)  → อนิรุต
  สีเขียว (green)  → กวินท์
  สีน้ำเงิน (blue) → กนก
  สีแดง (red)      → พฤพงศ์
ถ้าตัวอักษรที่อ่านได้ขัดแย้งกับสี ให้เชื่อ 'สี' เป็นหลัก เพราะลายมือ/พิมพ์อาจอ่านผิดได้

📅 ปฏิทินจริงของเดือน {ym} (ใช้ verify weekday column — ห้ามอ่านผิด):
{calendar}

📋 โครงตารางจริงในรูป — มีคอลัมน์เกี่ยวกับ:
  ก) 'ตรวจผู้ป่วยคดี ในเวลา 08.00-16.00 น.' → 🚫 'ห้ามอ่านคอลัมน์นี้' — out of scope ของ app นี้ ข้ามไป
  ข) 'ชันสูตรพลิกศพนอกรพ.' มี 3 ช่วง:
     00.00-08.00 → 0000-0800.outHos
     08.00-16.00 → 0800-1600.outHos
     16.00-24.00 → 1600-2400.outHos
  ค) 'ชันสูตรพลิกศพในรพ.+รับปรึกษารพช.' มี 3 ช่วง:
     00.00-08.00 → 0000-0800.inHos
     08.00-16.00 → 0800-1600.inHos
     16.00-24.00 → 1600-2400.inHos
→ ทุก slot มี 2 keys: outHos + inHos เท่านั้น (no patient)

🚫 กฎเกี่ยวกับช่องว่าง (สำคัญมาก):
  - ถ้าช่องไหนในตารางจริงๆ ว่าง (ไม่มีชื่อใคร) → ใส่ '' (empty string)
  - ห้ามเดาชื่อใส่ในช่องที่ว่างจริง — empty string ดีกว่าเดาผิด

กฎทั่วไป:
  - ใช้สีเป็น primary signal, ตัวอักษรเป็นการยืนยัน
  - ใส่ชื่อแพทย์เป็นภาษาไทยตรงตามรายชื่อ สะกดเหมือนเป๊ะ ไม่มีช่องว่างหรือเครื่องหมาย
  - month ต้อง = {ym}
  - days ต้องครบทุกวันของเดือน เรียงจาก 1 → จำนวนวันสูงสุด
  - weekday ใช้ตามปฏิทินข้างบน — ห้ามอ่านจากรูปแล้วได้ค่าไม่ตรง
เรียก tool 'submit_doctor_schedule' พร้อม JSON ที่ตรง schema — ห้ามตอบเป็น text เปล่า"#,
    )
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum AnthropicContent {
    #[serde(rename = "tool_use")]
    ToolUse { input: Value },
    #[serde(other)]
    Other,
}

/// Read an image file from disk, call Anthropic vision API, return parsed JSON.
pub async fn run_ocr(
    image_path: &std::path::Path,
    year_month: &str,
    api_key: &str,
    holidays: &[u32],
) -> Result<OcrResult, String> {
    if !regex_lite_ym(year_month) {
        return Err("year_month ต้องเป็นรูปแบบ YYYY-MM".into());
    }
    let bytes = tokio::fs::read(image_path)
        .await
        .map_err(|e| format!("อ่านไฟล์ไม่ได้: {e}"))?;
    let media_type = guess_media_type(&bytes);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let body = json!({
      "model": MODEL,
      "max_tokens": 8192,
      "system": system_prompt(year_month, holidays),
      "tools": [{
        "name": "submit_doctor_schedule",
        "description": "ส่งผลลัพธ์ OCR ตารางเวรในรูปแบบ JSON ที่ตรง schema",
        "input_schema": tool_schema(year_month)
      }],
      "tool_choice": { "type": "tool", "name": "submit_doctor_schedule" },
      "messages": [{
        "role": "user",
        "content": [
          { "type": "image", "source": { "type": "base64", "media_type": media_type, "data": b64 } },
          { "type": "text", "text": "อ่านตารางเวรในรูปและส่งผ่าน tool ที่กำหนด" }
        ]
      }]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(ENDPOINT)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("เรียก Claude API ไม่สำเร็จ: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API status {status}: {detail}"));
    }

    let parsed: AnthropicResponse = resp
        .json()
        .await
        .map_err(|e| format!("แปลงผลลัพธ์ Claude API ไม่ได้: {e}"))?;
    let tool_input = parsed
        .content
        .into_iter()
        .find_map(|c| match c {
            AnthropicContent::ToolUse { input } => Some(input),
            _ => None,
        })
        .ok_or_else(|| "Model ไม่ได้คืนผ่าน tool_use".to_string())?;

    let result: OcrResult = serde_json::from_value(tool_input)
        .map_err(|e| format!("ผลลัพธ์ไม่ตรง schema: {e}"))?;
    Ok(result)
}

/// Mini check — avoid pulling the regex crate just for this.
fn regex_lite_ym(s: &str) -> bool {
    let bytes = s.as_bytes();
    bytes.len() == 7
        && bytes[4] == b'-'
        && bytes[..4].iter().all(|b| b.is_ascii_digit())
        && bytes[5..].iter().all(|b| b.is_ascii_digit())
}
