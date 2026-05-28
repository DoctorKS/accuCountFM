import { Route, Routes } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHome } from "@/routes/DashboardHome";
import { ShiftMonthPage } from "@/routes/ShiftMonthPage";
import { ShiftDayPage } from "@/routes/ShiftDayPage";
import { DoctorBreakdownPage } from "@/routes/DoctorBreakdownPage";
import { TotalSummary } from "@/routes/TotalSummary";
import { SettingsPage } from "@/routes/SettingsPage";
import { ShortcutsPage } from "@/routes/ShortcutsPage";

export default function App() {
  return (
    <div className="flex h-full bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/out" element={<ShiftMonthPage shiftType="outHos" />} />
          <Route path="/in" element={<ShiftMonthPage shiftType="inHos" />} />
          <Route path="/shift/:type/:date" element={<ShiftDayPage />} />
          <Route path="/breakdown/:type/:doctor/:ym" element={<DoctorBreakdownPage />} />
          <Route path="/summary" element={<TotalSummary mode="all" />} />
          <Route path="/summary/out" element={<TotalSummary mode="outHos" />} />
          <Route path="/summary/in" element={<TotalSummary mode="inHos" />} />
          <Route path="/shortcuts" element={<ShortcutsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
