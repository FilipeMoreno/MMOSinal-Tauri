import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { useUpdater } from "@/hooks/useUpdater";
import {
  LayoutDashboard, Clock, Music2, CalendarOff, FileText, Settings, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/schedules", label: "Agendamentos", icon: Clock },
  { to: "/audio", label: "Biblioteca", icon: Music2 },
  { to: "/holidays", label: "Feriados", icon: CalendarOff },
  { to: "/logs", label: "Logs", icon: FileText },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function Layout() {
  const { initListener } = usePlayerStore();
  const { checkForUpdates, dialog: updateDialog } = useUpdater();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    initListener().then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    // Check silently on startup — only shows dialog if update is available.
    checkForUpdates(true);
  }, []);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {updateDialog}
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-400" />
            <div>
              <div className="font-bold text-sm">MMO Sinal</div>
              <div className="text-xs text-slate-400">Gerenciador de Sirenes</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700 text-xs text-slate-500 text-center">
          v1.0.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
