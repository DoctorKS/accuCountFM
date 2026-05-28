import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format baht — 0 decimals if integer, else 2. Returns "฿ 1,520" or "฿ 731.25". */
export function fmtBaht(n: number): string {
  const isInt = Math.abs(n - Math.round(n)) < 0.005;
  return "฿ " + n.toLocaleString("th-TH", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
