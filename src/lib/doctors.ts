/**
 * Canonical doctor list — order is significant for UI card layout in
 * Dashboard / Summary pages. Do NOT reorder without updating the
 * "doctor color" mapping in tailwind.config.ts and CLAUDE.md.
 */
export const DOCTORS = ["อนิรุต", "พฤพงศ์", "กนก", "กวินท์"] as const;
export type Doctor = (typeof DOCTORS)[number];

/** Full names used in monthly reports and signature blocks. */
export const DOCTOR_FULL_NAME: Record<Doctor, string> = {
  อนิรุต: "นายแพทย์อนิรุต  วรวาท",
  พฤพงศ์: "นายแพทย์พฤพงศ์  มกรเสน",
  กนก: "นายแพทย์กนก  วัยธรรม",
  กวินท์: "นายแพทย์กวินท์  ศัลย์วิเศษ",
};

/** Tailwind class tokens — matches color hint used by Claude OCR system prompt. */
export const DOCTOR_COLOR_HEX: Record<Doctor, string> = {
  อนิรุต: "#7c3aed", // violet
  พฤพงศ์: "#e11d48", // rose
  กนก: "#2563eb", // blue
  กวินท์: "#059669", // emerald
};

export const DOCTOR_BG_CLASS: Record<Doctor, string> = {
  อนิรุต: "bg-violet-50 ring-violet-200",
  พฤพงศ์: "bg-rose-50 ring-rose-200",
  กนก: "bg-blue-50 ring-blue-200",
  กวินท์: "bg-emerald-50 ring-emerald-200",
};

export function isDoctor(v: unknown): v is Doctor {
  return typeof v === "string" && (DOCTORS as readonly string[]).includes(v);
}
