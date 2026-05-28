/**
 * 24-hour time picker — two side-by-side dropdowns for hour (00-23) and
 * minute (00-59). Stores ISO "HH:MM" strings; `null` means unset.
 *
 * Used by CaseRow for เวลาออก / เวลากลับ. Both dropdowns scroll if
 * needed (60 minute options). User can clear by picking the "--" option.
 */
export function TimePicker24({
  value,
  onChange,
  ariaLabel,
}: {
  value: string | null;          // "HH:MM" or null
  onChange: (next: string | null) => void;
  ariaLabel?: string;
}) {
  const [hStr, mStr] = (value ?? ":").split(":");
  const h = parseDigits(hStr);
  const m = parseDigits(mStr);

  const update = (nextH: number | null, nextM: number | null) => {
    if (nextH == null && nextM == null) {
      onChange(null);
      return;
    }
    // If only one side is set, fall back to 00 on the missing side.
    const finalH = nextH ?? 0;
    const finalM = nextM ?? 0;
    onChange(`${pad2(finalH)}:${pad2(finalM)}`);
  };

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={ariaLabel}>
      <select
        value={h ?? ""}
        onChange={(e) => update(e.target.value === "" ? null : Number(e.target.value), m)}
        className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-sm font-mono tabular-nums focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
        aria-label="ชั่วโมง"
      >
        <option value="">--</option>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{pad2(i)}</option>
        ))}
      </select>
      <span className="text-zinc-400">:</span>
      <select
        value={m ?? ""}
        onChange={(e) => update(h, e.target.value === "" ? null : Number(e.target.value))}
        className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-sm font-mono tabular-nums focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
        aria-label="นาที"
      >
        <option value="">--</option>
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{pad2(i)}</option>
        ))}
      </select>
    </span>
  );
}

function parseDigits(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
