import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { useUpdater } from "@/hooks/useUpdater";
import { usePlayerNotification } from "@/hooks/usePlayerNotification";
import { settingsService } from "@/services/backupService";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";
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
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20 translate-x-1"
            : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:translate-x-1"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative flex-shrink-0">
            <Icon className={cn("h-[18px] w-[18px] transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-500")} />
            {badge && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500 ring-1 ring-white animate-pulse" />
            )}
          </span>
          {!collapsed && <span className="flex-1">{label}</span>}
          {!collapsed && badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 leading-none shadow-sm">
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
    checkForUpdates, checkAndAutoInstall, dialog: updateDialog,
    hasUpdate, updateVersion,
  } = useUpdater();
  const [version, setVersion] = useState("");
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);
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
    import("@tauri-apps/api/app").then(({ getVersion }) => getVersion().then((v) => {
      setVersion(v);
      const lastSeen = localStorage.getItem("last_seen_version");
      if (lastSeen && lastSeen !== v) {
        setWhatsNewVersion(v);
      }
      localStorage.setItem("last_seen_version", v);
    }));
    settingsService.get().then((s) => {
      if (s.auto_update) {
        checkAndAutoInstall();
      } else {
        checkForUpdates(true);
      }
    }).catch(() => {
      checkForUpdates(true);
    });
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
      {whatsNewVersion && (
        <WhatsNewDialog version={whatsNewVersion} onClose={() => setWhatsNewVersion(null)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-20 shadow-sm",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >

        {/* Brand */}
        <div className={cn("py-6 border-b border-slate-100 transition-all duration-300", collapsed ? "px-2" : "px-6")}>
          <div className={cn("flex items-center gap-3 group cursor-default", collapsed && "justify-center")}>
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 opacity-20 blur group-hover:opacity-40 transition-opacity rounded-full"></div>
              <img src="/icon.png" alt="MMO Sinal" className="h-[38px] w-[38px] flex-shrink-0 relative z-10 drop-shadow-sm" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-extrabold text-[15px] tracking-tight text-slate-900 leading-none">MMO Sinal</div>
                <div className="text-[11px] font-bold text-slate-400 truncate tracking-widest mt-1.5 uppercase">Sistema de Sinal Escolar</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar transition-all duration-300", collapsed ? "px-2" : "px-4")}>
          {NAV_PRIMARY.map((item) => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}

          {!collapsed && (
            <div className="pt-4 pb-1 px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistema</span>
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
          className="w-full flex justify-center py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
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
          <div className={cn("mx-3 mb-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 transition-all duration-300 relative overflow-hidden", collapsed ? "px-1.5 py-2.5" : "px-4 py-3")}>
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" />
            {collapsed ? (
              <div className="flex justify-center relative z-10">
                <span className="relative flex h-5 w-5 flex-shrink-0">
                  <Radio className="h-full w-full text-white flex-shrink-0 animate-pulse drop-shadow-sm" />
                </span>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  </span>
                  <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Tocando Agora</span>
                </div>
                <p className="text-sm font-bold text-white mt-1.5 truncate drop-shadow-sm leading-tight">{playingLabel}</p>
                <div className="mt-0.5">
                  <p className="text-[10px] font-semibold text-emerald-100 truncate bg-black/10 inline-block px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10 uppercase tracking-wider">{scheduleLabel}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Version / About shortcut */}
        <button
          onClick={() => navigate("/about")}
          className={cn(
            "py-3 border-t border-slate-100 flex items-center transition-all duration-300 w-full hover:bg-slate-50",
            collapsed ? "justify-center px-2" : "justify-between px-5",
          )}
          title={
            collapsed
              ? `Sobre o aplicativo${version ? ` (v${version})` : ""}${hasUpdate && updateVersion ? ` — v${updateVersion} disponível` : ""}`
              : "Sobre o aplicativo"
          }
        >
          {collapsed ? (
            <span className={cn(
              "text-[10px] font-bold leading-none",
              hasUpdate ? "text-emerald-500" : "text-slate-500",
            )}>
              {version ? `v${version}` : "v--"}
            </span>
          ) : (
            <>
              <span className={cn(
                "text-xs font-semibold",
                hasUpdate ? "text-emerald-500 drop-shadow-sm" : "text-slate-400",
              )}>
                {version ? `v${version}` : ""}
                {hasUpdate && ` · v${updateVersion} disponível`}
              </span>
              <div
                className={cn("h-2 w-2 rounded-full flex-shrink-0 shadow-sm", hasUpdate ? "bg-emerald-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" : "bg-emerald-400 opacity-80")}
                title={hasUpdate ? `v${updateVersion} disponível` : "Online"}
              />
            </>
          )}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
