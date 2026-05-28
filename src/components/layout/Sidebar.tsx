import { NavLink } from "react-router-dom";
import { LayoutDashboard, Sigma, FileText, FileSearch, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/",            label: "Dashboard",              Icon: LayoutDashboard, end: true },
  { to: "/summary/in",  label: "สรุปเงินเวรชันสูตรใน",     Icon: FileText },
  { to: "/summary/out", label: "สรุปเงินเวรชันสูตรนอก",    Icon: FileSearch },
  { to: "/summary",     label: "เงินเวรรวมทั้งหมด",        Icon: Sigma },
];

export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center px-5 border-b border-zinc-200">
        <span className="text-base font-bold tracking-tight">🦴 accuCountFM</span>
      </div>
      <nav className="p-3 space-y-1">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-violet-50 text-violet-900 ring-1 ring-violet-200"
                  : "text-zinc-700 hover:bg-zinc-100",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-3 border-t border-zinc-200">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              isActive ? "bg-zinc-100" : "text-zinc-600 hover:bg-zinc-100",
            )
          }
        >
          <SettingsIcon className="h-4 w-4" />
          ตั้งค่า
        </NavLink>
      </div>
    </aside>
  );
}
