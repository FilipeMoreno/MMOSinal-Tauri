import { useEffect, useState } from "react";
import { getVersion, getTauriVersion, getName } from "@tauri-apps/api/app";
import {
  ArrowDownCircle, CheckCircle, Loader2, RefreshCw,
  Music2, Clock, FileText, HardDrive, Wifi, Monitor,
  CheckCircle as CheckCircle2, XCircle, Folder, Activity, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdater } from "@/hooks/useUpdater";
import { usePlayerStore } from "@/stores/playerStore";
import { settingsService } from "@/services/backupService";
import { audioService } from "@/services/audioService";
import { scheduleService } from "@/services/scheduleService";
import { logService } from "@/services/logService";
import { changeLogService } from "@/services/changeLogService";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AppSettings, AudioFolder, AudioFile, Schedule } from "@/types";
import changelogRaw from "../../CHANGELOG.md?raw";

// ── Changelog parser ──────────────────────────────────────────────────────────

interface ChangelogSection {
  version: string;
  date: string;
  groups: { label: string; items: string[] }[];
}

function parseChangelog(raw: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  let currentGroup: { label: string; items: string[] } | null = null;
  for (const line of raw.split("\n")) {
    const versionMatch = line.match(/^##\s+\[([^\]]+)\]\s*-\s*(.+)/);
    if (versionMatch) {
      currentGroup = null;
      const rawDate = versionMatch[2].trim();
      const [y, m, d] = rawDate.split("-");
      const date = d && m && y ? `${d}/${m}/${y}` : rawDate;
      current = { version: versionMatch[1], date, groups: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const groupMatch = line.match(/^###\s+(.+)/);
    if (groupMatch) { currentGroup = { label: groupMatch[1].trim(), items: [] }; current.groups.push(currentGroup); continue; }
    const itemMatch = line.match(/^-\s+(.+)/);
    if (itemMatch && currentGroup) currentGroup.items.push(itemMatch[1].replace(/\*\*([^*]+)\*\*/g, "$1"));
  }
  return sections;
}

const CHANGELOG = parseChangelog(changelogRaw);

// ── Static data ───────────────────────────────────────────────────────────────

const FRONTEND_DEPS = [
  { name: "React", version: "18", license: "MIT" },
  { name: "Tauri", version: "2", license: "Apache-2.0 / MIT" },
  { name: "Vite", version: "6", license: "MIT" },
  { name: "TypeScript", version: "5", license: "Apache-2.0" },
  { name: "Tailwind CSS", version: "3", license: "MIT" },
  { name: "shadcn/ui + Radix UI", version: "latest", license: "MIT" },
  { name: "React Router DOM", version: "7", license: "MIT" },
  { name: "Zustand", version: "5", license: "MIT" },
  { name: "React Hook Form", version: "7", license: "MIT" },
  { name: "Zod", version: "3", license: "MIT" },
  { name: "Lucide React", version: "0.473", license: "ISC" },
  { name: "date-fns", version: "4", license: "MIT" },
  { name: "TanStack Table", version: "8", license: "MIT" },
  { name: "Sonner", version: "1", license: "MIT" },
];

const BACKEND_DEPS = [
  { name: "Tauri", version: "2", license: "Apache-2.0 / MIT" },
  { name: "Rodio", version: "0.20", license: "Apache-2.0 / MIT" },
  { name: "Symphonia", version: "0.5", license: "MPL-2.0 / MIT" },
  { name: "SQLx", version: "0.8", license: "Apache-2.0 / MIT" },
  { name: "Tokio", version: "1", license: "MIT" },
  { name: "Serde", version: "1", license: "Apache-2.0 / MIT" },
  { name: "Chrono", version: "0.4", license: "Apache-2.0 / MIT" },
  { name: "Tracing", version: "0.1", license: "MIT" },
  { name: "Zip", version: "2", license: "MIT" },
  { name: "Walkdir", version: "2", license: "Unlicense / MIT" },
  { name: "UUID", version: "1", license: "Apache-2.0 / MIT" },
  { name: "Dirs", version: "5", license: "Apache-2.0 / MIT" },
  { name: "Anyhow / Thiserror", version: "1", license: "Apache-2.0 / MIT" },
];

const GROUP_COLORS: Record<string, string> = {
  Adicionado: "text-green-700 bg-green-50 border-green-200",
  Added:      "text-green-700 bg-green-50 border-green-200",
  Alterado:   "text-blue-700 bg-blue-50 border-blue-200",
  Changed:    "text-blue-700 bg-blue-50 border-blue-200",
  Corrigido:  "text-amber-700 bg-amber-50 border-amber-200",
  Fixed:      "text-amber-700 bg-amber-50 border-amber-200",
  Removido:   "text-red-700 bg-red-50 border-red-200",
  Removed:    "text-red-700 bg-red-50 border-red-200",
};

const PLAYER_STATUS_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  idle:       { label: "Ocioso",   color: "text-slate-500",  dot: "bg-slate-300"  },
  playing:    { label: "Tocando",  color: "text-green-600",  dot: "bg-green-500"  },
  paused:     { label: "Pausado",  color: "text-amber-600",  dot: "bg-amber-500"  },
  fading_in:  { label: "Fade In",  color: "text-blue-600",   dot: "bg-blue-500"   },
  fading_out: { label: "Fade Out", color: "text-purple-600", dot: "bg-purple-500" },
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function Card({ icon: Icon, title, children, action }: {
  icon: React.ElementType; title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-slate-800 text-right break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{children}</h2>;
}

function DepRow({ name, version, license }: { name: string; version: string; license: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div>
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="ml-2 text-xs text-slate-400">v{version}</span>
      </div>
      <span className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">{license}</span>
    </div>
  );
}

// ── System data ───────────────────────────────────────────────────────────────

interface SystemData {
  appName: string;
  settings: AppSettings;
  folders: AudioFolder[];
  filesPerFolder: Record<number, AudioFile[]>;
  schedules: Schedule[];
  execLogCount: number;
  changeLogCount: number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "sistema" | "changelog" | "sobre";

export function About() {
  const [tab, setTab] = useState<Tab>("sistema");

  // Hero state
  const [appVersion, setAppVersion] = useState("");
  const [tauriVersion, setTauriVersion] = useState("");

  // Changelog state
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const expanded = activeVersion ?? CHANGELOG[0]?.version ?? null;

  // System state
  const [sysData, setSysData] = useState<SystemData | null>(null);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysError, setSysError] = useState<string | null>(null);

  const { status, current_file, current_schedule } = usePlayerStore();
  const { checkForUpdates, dialog: updateDialog, checking, checked, hasUpdate, updateVersion, installing, installUpdate, dismissUpdate } = useUpdater();

  useEffect(() => {
    getVersion().then(setAppVersion);
    getTauriVersion().then(setTauriVersion);
    checkForUpdates(true);
  }, []);

  const loadSystem = async () => {
    setSysLoading(true);
    setSysError(null);
    try {
      const [appName, settings, folders, schedules, execLogs, changeLogs] = await Promise.all([
        getName(),
        settingsService.get(),
        audioService.listFolders(),
        scheduleService.list(),
        logService.list(9999),
        changeLogService.list(9999),
      ]);
      const fileEntries = await Promise.all(
        folders.map(async (f) => [f.id, await audioService.listFiles(f.id)] as [number, AudioFile[]])
      );
      setSysData({
        appName, settings, folders,
        filesPerFolder: Object.fromEntries(fileEntries),
        schedules,
        execLogCount: execLogs.length,
        changeLogCount: changeLogs.length,
      });
    } catch (e) {
      setSysError(String(e));
    } finally {
      setSysLoading(false);
    }
  };

  useEffect(() => { loadSystem(); }, []);

  // Computed system values
  const totalFiles = sysData ? Object.values(sysData.filesPerFolder).reduce((a, f) => a + f.length, 0) : 0;
  const totalDurationMs = sysData ? Object.values(sysData.filesPerFolder).flat().reduce((a, f) => a + (f.duration_ms ?? 0), 0) : 0;
  const activeSchedules = sysData?.schedules.filter((s) => s.is_active).length ?? 0;
  const inactiveSchedules = (sysData?.schedules.length ?? 0) - activeSchedules;
  const playerCfg = PLAYER_STATUS_LABEL[status] ?? PLAYER_STATUS_LABEL.idle;
  const platform = navigator.platform ?? "Desconhecido";
  const osName = platform.includes("Win") ? "Windows" : platform.includes("Mac") ? "macOS" : platform.includes("Linux") ? "Linux" : platform;

  return (
    <div className="p-6 w-full max-w-5xl mx-auto space-y-5">
      {updateDialog}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-5">
        <img src="/icon.png" alt="MMO Sinal" className="h-16 w-16 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800">MMO Sinal</h1>
          <p className="text-sm text-slate-500">Gerenciador de Sinal Escolar</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-0.5">v{appVersion}</span>
            {tauriVersion && (
              <span className="font-mono text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-0.5">Tauri v{tauriVersion}</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {hasUpdate ? (
            <Button size="sm" onClick={() => installUpdate().then(dismissUpdate)} disabled={installing}
              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5">
              {installing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownCircle className="h-3 w-3" />}
              {installing ? "Instalando..." : `Instalar v${updateVersion}`}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => checkForUpdates(false)} disabled={checking} className="h-8 text-xs gap-1.5">
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : checked ? <CheckCircle className="h-3 w-3 text-green-500" /> : <RefreshCw className="h-3 w-3" />}
              {checking ? "Verificando..." : checked ? "Atualizado" : "Verificar atualizações"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {(["sistema", "changelog", "sobre"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            {t === "sistema" ? "Sistema" : t === "changelog" ? "Histórico de Versões" : "Sobre & Licenças"}
          </button>
        ))}
      </div>

      {/* ── Tab: Sistema ──────────────────────────────────────────────────── */}
      {tab === "sistema" && (
        <>
          {sysLoading && !sysData && (
            <div className="flex justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          )}
          {sysError && (
            <div className="flex flex-col items-center py-16 gap-3">
              <AlertTriangle className="h-10 w-10 text-red-300" />
              <p className="text-slate-600 font-medium">Falha ao carregar informações</p>
              <p className="text-sm text-slate-400">{sysError}</p>
              <Button variant="outline" size="sm" onClick={loadSystem}>Tentar novamente</Button>
            </div>
          )}
          {sysData && (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Music2 className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{totalFiles}</p>
                    <p className="text-xs text-slate-400">Músicas</p>
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Folder className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{sysData.folders.length}</p>
                    <p className="text-xs text-slate-400">Pastas</p>
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{activeSchedules}</p>
                    <p className="text-xs text-slate-400">Agendamentos ativos</p>
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${status === "idle" ? "bg-slate-50" : "bg-green-50"}`}>
                    <Activity className={`h-4 w-4 ${status === "idle" ? "text-slate-400" : "text-green-500"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${playerCfg.dot}`} />
                      <p className={`text-sm font-bold ${playerCfg.color}`}>{playerCfg.label}</p>
                    </div>
                    <p className="text-xs text-slate-400">Player</p>
                  </div>
                </div>
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">

                  {/* App info */}
                  <Card icon={Monitor} title="Aplicativo"
                    action={
                      <Button variant="ghost" size="sm" onClick={loadSystem} disabled={sysLoading} className="h-7 text-xs text-slate-400">
                        <RefreshCw className={cn("h-3.5 w-3.5", sysLoading && "animate-spin")} />
                      </Button>
                    }
                  >
                    <InfoRow label="Nome" value={sysData.appName} />
                    <InfoRow label="Versão" value={`v${appVersion}`} mono />
                    <InfoRow label="Tauri" value={`v${tauriVersion}`} mono />
                    <InfoRow label="Identificador" value="br.com.mmosinal" mono />
                    <InfoRow label="Plataforma" value={osName} />
                    <InfoRow label="Arquitetura" value={platform} mono />
                  </Card>

                  {/* Player */}
                  <Card icon={Activity} title="Status do Player">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="relative flex h-3 w-3 flex-shrink-0">
                        {status !== "idle" && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${playerCfg.dot}`} />}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${playerCfg.dot}`} />
                      </span>
                      <span className={`font-semibold ${playerCfg.color}`}>{playerCfg.label}</span>
                    </div>
                    {status !== "idle" ? (
                      <div className="space-y-1.5 text-sm">
                        {current_file && <p className="text-slate-700"><span className="text-slate-400">Arquivo: </span>{current_file.name}</p>}
                        {current_schedule && <p className="text-slate-700"><span className="text-slate-400">Agendamento: </span>{current_schedule.name?.trim() || current_schedule.time}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">Nenhum sinal em execução</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-50">
                      <p className="text-xs text-slate-400">Agendador ativo</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium">Rodando</span>
                      </div>
                    </div>
                  </Card>

                  {/* Logs */}
                  <Card icon={FileText} title="Logs">
                    <div className="grid grid-cols-2 gap-4">
                      <Stat label="Execuções" value={sysData.execLogCount} sub="registradas" />
                      <Stat label="Alterações" value={sysData.changeLogCount} sub="registradas" />
                    </div>
                  </Card>

                </div>
                <div className="space-y-4">

                  {/* Audio library */}
                  <Card icon={Music2} title="Biblioteca de Áudio">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <Stat label="Pastas" value={sysData.folders.length} />
                      <Stat label="Músicas" value={totalFiles} />
                      <Stat label="Duração total" value={totalDurationMs > 0 ? formatDuration(totalDurationMs) : "—"} />
                    </div>
                    <div className="pt-3 border-t border-slate-50">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Pastas</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {sysData.folders.length === 0 ? (
                          <p className="text-sm text-slate-400">Nenhuma pasta cadastrada</p>
                        ) : sysData.folders.map((f) => {
                          const count = sysData.filesPerFolder[f.id]?.length ?? 0;
                          return (
                            <div key={f.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <Folder className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                                <span className="text-sm text-slate-700 truncate">{f.name}</span>
                              </div>
                              <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                {count} {count === 1 ? "arquivo" : "arquivos"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {sysData.settings.audio_storage_folder && (
                      <div className="pt-3 mt-3 border-t border-slate-50">
                        <p className="text-xs text-slate-400 mb-0.5">Pasta de armazenamento</p>
                        <p className="text-xs font-mono text-slate-600 break-all">{sysData.settings.audio_storage_folder}</p>
                      </div>
                    )}
                  </Card>

                  {/* Schedules */}
                  <Card icon={Clock} title="Agendamentos">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <Stat label="Total" value={sysData.schedules.length} />
                      <Stat label="Ativos" value={activeSchedules} />
                      <Stat label="Inativos" value={inactiveSchedules} />
                    </div>
                    {sysData.schedules.length > 0 && (
                      <div className="pt-3 border-t border-slate-50">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Próximos ativos</p>
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {[...sysData.schedules].filter((s) => s.is_active).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 5).map((s) => (
                            <div key={s.id} className="flex items-center gap-2 py-0.5">
                              <span className="font-mono text-xs text-slate-500 w-12 flex-shrink-0">{s.time}</span>
                              <span className="text-sm text-slate-700 truncate">{s.name || "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Backup & Settings */}
                  <Card icon={HardDrive} title="Backup & Configurações">
                    <InfoRow label="Backup automático"
                      value={sysData.settings.backup_auto_enabled
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />Ativo ({sysData.settings.backup_interval_hours}h)</span>
                        : <span className="flex items-center gap-1 text-slate-400"><XCircle className="h-3.5 w-3.5" />Desativado</span>}
                    />
                    <InfoRow label="Pasta de backup"
                      value={sysData.settings.backup_folder || <span className="text-slate-400 font-normal">Não configurada</span>}
                      mono={!!sysData.settings.backup_folder}
                    />
                    <InfoRow label="Volume padrão" value={`${Math.round(sysData.settings.default_volume * 100)}%`} mono />
                    <div className="pt-2 mt-2 border-t border-slate-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Wifi className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">NTP</span>
                      </div>
                      <InfoRow label="Servidor" value={sysData.settings.ntp_server} mono />
                      <InfoRow label="Sincronização"
                        value={sysData.settings.ntp_auto_sync
                          ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />Ativa</span>
                          : <span className="text-slate-400">Desativada</span>}
                      />
                    </div>
                  </Card>

                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Changelog ────────────────────────────────────────────────── */}
      {tab === "changelog" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex h-[520px]">
            <div className="w-36 flex-shrink-0 border-r border-slate-100 bg-slate-50 overflow-y-auto py-1">
              {CHANGELOG.map((section) => {
                const isActive = expanded === section.version;
                return (
                  <button key={section.version} onClick={() => setActiveVersion(section.version)}
                    className={cn("w-full text-left px-3 py-2.5 border-l-2 transition-colors",
                      isActive ? "bg-blue-50 border-l-blue-500" : "border-l-transparent hover:bg-white")}>
                    <p className={cn("text-sm font-semibold", isActive ? "text-blue-700" : "text-slate-600")}>v{section.version}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{section.date}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {CHANGELOG.filter((s) => s.version === expanded).map((section) => (
                <div key={section.version}>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h3 className="text-sm font-bold text-slate-800">v{section.version}</h3>
                    <span className="text-xs text-slate-400">{section.date}</span>
                  </div>
                  {section.groups.length === 0 ? (
                    <p className="text-xs text-slate-400">Sem notas de versão.</p>
                  ) : section.groups.map((group) => {
                    const colorClass = GROUP_COLORS[group.label] ?? "text-slate-700 bg-slate-50 border-slate-200";
                    return (
                      <div key={group.label} className="mb-3">
                        <span className={cn("inline-block text-xs font-semibold px-2 py-0.5 rounded border mb-2", colorClass)}>{group.label}</span>
                        <ul className="space-y-1">
                          {group.items.map((item, i) => (
                            <li key={i} className="flex gap-2 text-xs text-slate-600">
                              <span className="text-slate-300 flex-shrink-0 mt-0.5">–</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Sobre ────────────────────────────────────────────────────── */}
      {tab === "sobre" && (
        <>
          {/* Developer + libs */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-5">
              {/* Developer */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <SectionTitle>Desenvolvedor</SectionTitle>
                <div className="flex items-center gap-4">
                  <img src="/prestar-logo.png" alt="Prestar Soluções" className="h-12 w-12 flex-shrink-0 object-contain" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Prestar Soluções</p>
                    <p className="text-xs text-slate-500 mt-0.5">Prestar Serviços e Soluções LTDA</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Identificador</span>
                    <span className="font-mono text-xs text-slate-600">br.com.mmosinal</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Licença</span>
                    <span className="font-mono text-xs text-slate-600">Proprietário</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Plataforma</span>
                    <span className="font-mono text-xs text-slate-600">Windows (x64)</span>
                  </div>
                </div>
              </div>

              {/* Frontend libs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <SectionTitle>Bibliotecas Frontend</SectionTitle>
                <div className="divide-y divide-slate-50">
                  {FRONTEND_DEPS.map((d) => <DepRow key={d.name} {...d} />)}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* Backend libs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <SectionTitle>Bibliotecas Backend (Rust)</SectionTitle>
                <div className="divide-y divide-slate-50">
                  {BACKEND_DEPS.map((d) => <DepRow key={d.name} {...d} />)}
                </div>
              </div>

              {/* Stack */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <SectionTitle>Tecnologias base</SectionTitle>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Construído com <span className="font-medium text-slate-800">Tauri 2</span> — framework para aplicações desktop usando tecnologias web com backend em Rust.</p>
                  <p>Áudio via <span className="font-medium text-slate-800">Rodio</span> e <span className="font-medium text-slate-800">Symphonia</span>, suportando MP3, WAV, OGG e FLAC.</p>
                  <p>Banco de dados local com <span className="font-medium text-slate-800">SQLite</span> via <span className="font-medium text-slate-800">SQLx</span>.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
