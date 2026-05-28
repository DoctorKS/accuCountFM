/**
 * Skull spinner — ported from Shift_count's OCR overlay.
 *
 * Spins via Tailwind's existing `animate-spin-slow` (1.4s linear infinite,
 * defined in tailwind.config.ts). Size is controlled by the `size` prop
 * (in pixels) so the same component fits both inline buttons (16-20px)
 * and full-screen OCR overlays (64-80px).
 */
export function SkullSpinner({
  size = 64,
  className = "",
  ariaLabel = "กำลังประมวลผล",
}: {
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      width={size}
      height={size}
      aria-label={ariaLabel}
      role="img"
      className={`animate-spin-slow inline-block ${className}`}
    >
      <path d="M32 4C18.7 4 8 14.4 8 27.3c0 7.1 3.3 13.4 8.5 17.7v6.2c0 2.1 1.7 3.8 3.8 3.8h3v2c0 1.7 1.3 3 3 3s3-1.3 3-3v-2h7v2c0 1.7 1.3 3 3 3s3-1.3 3-3v-2h3c2.1 0 3.8-1.7 3.8-3.8v-6.2C52.7 40.7 56 34.4 56 27.3 56 14.4 45.3 4 32 4zm-9 28c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm9 8l-3-6h6l-3 6zm9-8c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" />
    </svg>
  );
}

/**
 * Full-screen overlay variant — drop-in for any "OCR is running" moment.
 * Semi-transparent white backdrop + centered skull + message.
 */
export function OcrSkullOverlay({ message = "กำลังประมวลผล OCR…" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-sm">
      <SkullSpinner size={80} className="text-violet-700" ariaLabel={message} />
      <div className="text-sm font-medium text-zinc-600">{message}</div>
    </div>
  );
}
