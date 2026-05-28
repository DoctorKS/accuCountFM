/**
 * Typed wrappers around Tauri IPC commands (defined in `src-tauri/src/lib.rs`).
 *
 * Each `invoke()` is one of `tauri::generate_handler!` entries; signatures must
 * stay in lockstep with the Rust side. Frontend should never call `invoke()`
 * directly — go through these helpers so the type-checker catches drift.
 */
import { invoke } from "@tauri-apps/api/core";

export interface AppInfo { version: string; name: string }
export const appInfo = () => invoke<AppInfo>("app_info");

// ─── Anthropic API key (Windows Credential Manager) ─────────────────────────

export const hasApiKey = () => invoke<boolean>("has_api_key");
export const getApiKey = () => invoke<string | null>("get_api_key");
export const setApiKey = (value: string) => invoke<void>("set_api_key", { value });
export const clearApiKey = () => invoke<void>("clear_api_key");

// ─── OCR ────────────────────────────────────────────────────────────────────

export interface OcrSlot { outHos: string; inHos: string }
export interface OcrDay {
  date: number;
  weekday: string;
  shifts: { "0000-0800": OcrSlot; "0800-1600": OcrSlot; "1600-2400": OcrSlot };
}
export interface OcrResult { month: string; days: OcrDay[] }

export const ocrRun = (params: { imagePath: string; yearMonth: string; holidays?: number[] }) =>
  invoke<OcrResult>("ocr_run", {
    imagePath: params.imagePath,
    yearMonth: params.yearMonth,
    holidays: params.holidays ?? [],
  });

// ─── Excel export ───────────────────────────────────────────────────────────

import type { ShiftType, Slot } from "./constants";

export interface AssignmentForExport {
  shiftType: ShiftType;
  date: string;
  slot: Slot;
  doctorName: string | null;
}

export interface CaseForExport {
  shiftType: ShiftType;
  date: string;
  slot: Slot;
  leaveTime: string | null;
  returnTime: string | null;
}

export interface ShiftBundle {
  assignments: AssignmentForExport[];
  cases: CaseForExport[];
}

export interface ExportPayload {
  yearMonth: string;
  savePath: string;
  holidays: number[];          // day-of-month integers — same scoping as calc
  outHos: ShiftBundle | null;
  inHos: ShiftBundle | null;
}

export interface DoctorTotal { outHos: number; inHos: number; total: number }
export interface ExportResult { path: string; doctorTotals: Record<string, DoctorTotal> }

export const exportMonthXlsx = (payload: ExportPayload) =>
  invoke<ExportResult>("export_month_xlsx", { payload });
