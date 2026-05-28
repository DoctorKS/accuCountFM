import { Link } from "react-router-dom";
import logoOutHos from "@/assets/logo-out-hos.png";
import logoInHos from "@/assets/logo-in-hos.png";

/**
 * Dashboard home — two image-only buttons.
 *
 * The logo PNGs themselves ARE the interactive surface. No card wrapper,
 * no label text — the artwork is expected to carry the "เวรชันสูตรนอก/ใน"
 * meaning visually. We keep the page <header> with the app name so the
 * route still has context above the fold.
 */
export function DashboardHome() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center gap-10 p-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">accuCountFM</h1>
        <p className="mt-2 text-sm text-zinc-500">คำนวณเงินเวรแพทย์นิติเวช · เลือกประเภทเวรที่ต้องการ</p>
      </header>

      <div className="grid w-full grid-cols-1 items-center gap-8 md:grid-cols-2">
        <LogoButton to="/out" src={logoOutHos} alt="เวรชันสูตรนอก" />
        <LogoButton to="/in"  src={logoInHos}  alt="เวรชันสูตรใน"  />
      </div>
    </div>
  );
}

/**
 * The PNG is the button. Focus ring + hover scale give the usual
 * "this is clickable" affordances without overlaying any chrome on the art.
 */
function LogoButton({ to, src, alt }: { to: string; src: string; alt: string }) {
  return (
    <Link
      to={to}
      aria-label={alt}
      className="group inline-flex items-center justify-center rounded-2xl transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        // max-w keeps the image from stretching on huge screens; mx-auto
        // centres it inside its half of the grid; drop-shadow tightens on hover.
        className="mx-auto max-h-[320px] w-full max-w-xs object-contain drop-shadow-md transition-all duration-150 group-hover:drop-shadow-xl"
      />
    </Link>
  );
}
