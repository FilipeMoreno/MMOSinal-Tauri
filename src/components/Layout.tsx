import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { useUpdater } from "@/hooks/useUpdater";
import { usePlayerNotification } from "@/hooks/usePlayerNotification";
import {
  LayoutDashboard, Clock, Music2, CalendarOff, FileText, Settings, Radio,
  ChevronLeft, ChevronRight, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_PRIMARY = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/schedules", label: "Agendamentos", icon: Clock },
  { to: "/audio", label: "Biblioteca", icon: Music2 },
  { to: "/holidays", label: "Feriados", icon: CalendarOff },
];

const NAV_SECONDARY = [
  { to: "/logs", label: "Logs", icon: FileText },
  { to: "/settings", label: "Configurações", icon: Settings },
  { to: "/about", label: "Sobre", icon: BookOpen },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  badge,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  collapsed: boolean;
  badge?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? (badge ? `${label} — atualização disponível` : label) : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative flex-shrink-0">
            <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
            {badge && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 ring-1 ring-white animate-pulse" />
            )}
          </span>
          {!collapsed && <span className="flex-1">{label}</span>}
          {!collapsed && badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 leading-none">
              novo
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { initListener, status, current_file, current_schedule } = usePlayerStore();
  const {
    checkForUpdates, dialog: updateDialog,
    hasUpdate, updateVersion,
  } = useUpdater();
  const [version, setVersion] = useState("");
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true"
  );
  const navigate = useNavigate();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    initListener().then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    checkForUpdates(true);
    import("@tauri-apps/api/app").then(({ getVersion }) => getVersion().then(setVersion));
  }, []);

  usePlayerNotification();

  const isPlaying = status !== "idle";
  const playingLabel = current_file?.name ?? "";
  const scheduleLabel = current_schedule?.name?.trim() || current_schedule?.time || "Manual";

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {updateDialog}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >

        {/* Brand */}
        <div className={cn("py-5 border-b border-slate-100 transition-all duration-200", collapsed ? "px-2" : "px-4")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <img src="/icon.png" alt="MMO Sinal" className="h-9 w-9 flex-shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-800 leading-tight">MMO Sinal</div>
                <div className="text-xs text-slate-400 truncate">Gerenciador de Sinal Escolar</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 py-3 space-y-0.5 overflow-y-auto transition-all duration-200", collapsed ? "px-1" : "px-2")}>
          {NAV_PRIMARY.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}

          {!collapsed && (
            <div className="pt-4 pb-1 px-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sistema</span>
            </div>
          )}
          {collapsed && <div className="pt-4 pb-1" />}

          {NAV_SECONDARY.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              collapsed={collapsed}
              badge={item.to === "/about" && hasUpdate}
            />
          ))}
        </nav>

        {/* Collapse toggle button */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex justify-center py-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Mini player */}
        {isPlaying && (
          <div className={cn("mx-2 mb-2 rounded-lg bg-blue-50 border border-blue-100 transition-all duration-200", collapsed ? "px-1 py-2" : "px-3 py-2.5")}>
            {collapsed ? (
              <div className="flex justify-center">
                <span className="relative flex h-4 w-4 flex-shrink-0">
                  <Radio className="h-full w-full text-green-600 flex-shrink-0 animate-pulse" />
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-green-600 flex-shrink-0 animate-pulse" />
                  <span className="text-xs font-medium text-green-600">Tocando</span>
                </div>
                <p className="text-xs text-slate-700 mt-1 truncate">{playingLabel}</p>
                <p className="text-xs text-slate-500 truncate">{scheduleLabel}</p>
              </>
            )}
          </div>
        )}

        {/* Version / About shortcut */}
        <button
          onClick={() => navigate("/about")}
          className={cn(
            "py-3 border-t border-slate-100 flex items-center transition-all duration-200 w-full hover:bg-slate-50",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
          title="Sobre o aplicativo"
        >
          {!collapsed && (
            <span className={cn(
              "text-xs",
              hasUpdate ? "text-green-600 font-medium" : "text-slate-400",
            )}>
              {version ? `v${version}` : ""}
              {hasUpdate && ` · v${updateVersion} disponível`}
            </span>
          )}
          <div
            className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", hasUpdate ? "bg-green-500 animate-pulse" : "bg-green-500")}
            title={hasUpdate ? `v${updateVersion} disponível` : "Online"}
          />
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
