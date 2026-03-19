import { useEffect, useState } from "react";
import { getVersion, getTauriVersion, getName } from "@tauri-apps/api/app";
import {
  Info, Music2, Clock, FileText, HardDrive, Wifi, Monitor,
  CheckCircle, XCircle, RefreshCw, Folder, Activity,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { settingsService } from "@/services/backupService";
import { audioService } from "@/services/audioService";
import { scheduleService } from "@/services/scheduleService";
import { logService } from "@/services/logService";
import { changeLogService } from "@/services/changeLogService";
import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/lib/utils";
import type { AppSettings, AudioFolder, AudioFile, Schedule } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-slate-800 text-right break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
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

// ── Status badge ─────────────────────────────────────────────────────────────

const PLAYER_STATUS_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  idle:       { label: "Ocioso",        color: "text-slate-500",  dot: "bg-slate-300"  },
  playing:    { label: "Tocando",       color: "text-green-600",  dot: "bg-green-500"  },
  paused:     { label: "Pausado",       color: "text-amber-600",  dot: "bg-amber-500"  },
  fading_in:  { label: "Fade In",       color: "text-blue-600",   dot: "bg-blue-500"   },
  fading_out: { label: "Fade Out",      color: "text-purple-600", dot: "bg-purple-500" },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface SystemData {
  appName: string;
  appVersion: string;
  tauriVersion: string;
  settings: AppSettings;
  folders: AudioFolder[];
  filesPerFolder: Record<number, AudioFile[]>;
  schedules: Schedule[];
  execLogCount: number;
  changeLogCount: number;
}

export function SystemInfo() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { status, current_file, current_schedule } = usePlayerStore();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appName, appVersion, tauriVersion, settings, folders, schedules, execLogs, changeLogs] =
        await Promise.all([
          getName(),
          getVersion(),
          getTauriVersion(),
          settingsService.get(),
          audioService.listFolders(),
          scheduleService.list(),
          logService.list(9999),
          changeLogService.list(9999),
        ]);

      // Load files per folder in parallel
      const fileEntries = await Promise.all(
        folders.map(async (f) => [f.id, await audioService.listFiles(f.id)] as [number, AudioFile[]])
      );
      const filesPerFolder = Object.fromEntries(fileEntries);

      setData({
        appName,
        appVersion,
        tauriVersion,
        settings,
        folders,
        filesPerFolder,
        schedules,
        execLogCount: execLogs.length,
        changeLogCount: changeLogs.length,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalFiles = data
    ? Object.values(data.filesPerFolder).reduce((acc, f) => acc + f.length, 0)
    : 0;

  const totalDurationMs = data
    ? Object.values(data.filesPerFolder)
        .flat()
        .reduce((acc, f) => acc + (f.duration_ms ?? 0), 0)
    : 0;

  const activeSchedules = data?.schedules.filter((s) => s.is_active).length ?? 0;
  const inactiveSchedules = (data?.schedules.length ?? 0) - activeSchedules;

  const playerCfg = PLAYER_STATUS_LABEL[status] ?? PLAYER_STATUS_LABEL.idle;

  if (loading) {
    return (
      <div className="p-6 w-full flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 w-full">
        <div className="flex flex-col items-center py-24 text-center gap-3">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="font-medium text-slate-700">Falha ao carregar informações</p>
          <p className="text-sm text-slate-400">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const { appName, appVersion, tauriVersion, settings, folders, filesPerFolder, schedules } = data;

  // ── Platform ─────────────────────────────────────────────────────────────
  const platform = navigator.platform ?? "Desconhecido";
  const osName = platform.includes("Win") ? "Windows"
    : platform.includes("Mac") ? "macOS"
    : platform.includes("Linux") ? "Linux"
    : platform;

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Informações do Sistema</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral do estado atual do aplicativo</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Top stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
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
            <p className="text-2xl font-bold text-slate-800">{folders.length}</p>
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

      {/* Main grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Col 1 */}
        <div className="space-y-4">

          {/* App info */}
          <Card icon={Info} title="Aplicativo">
            <InfoRow label="Nome" value={appName} />
            <InfoRow label="Versão" value={`v${appVersion}`} mono />
            <InfoRow label="Versão do Tauri" value={`v${tauriVersion}`} mono />
            <InfoRow label="Identificador" value="br.com.mmosinal" mono />
            <InfoRow label="Plataforma" value={osName} />
            <InfoRow label="Arquitetura" value={platform} mono />
          </Card>

          {/* Player status */}
          <Card icon={Activity} title="Status do Player">
            <div className="flex items-center gap-3 mb-3">
              <span className={`relative flex h-3 w-3 flex-shrink-0`}>
                {status !== "idle" && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${playerCfg.dot}`} />
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${playerCfg.dot}`} />
              </span>
              <span className={`font-semibold ${playerCfg.color}`}>{playerCfg.label}</span>
            </div>
            {status !== "idle" ? (
              <div className="space-y-1.5 text-sm">
                {current_file && (
                  <p className="text-slate-700">
                    <span className="text-slate-400">Arquivo: </span>
                    {current_file.name}
                  </p>
                )}
                {current_schedule && (
                  <p className="text-slate-700">
                    <span className="text-slate-400">Agendamento: </span>
                    {current_schedule.name?.trim() || current_schedule.time}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhum sinal em execução</p>
            )}
            <div className="mt-3 pt-3 border-t border-slate-50">
              <p className="text-xs text-slate-400">Agendador ativo</p>
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">Rodando</span>
              </div>
            </div>
          </Card>

          {/* Logs */}
          <Card icon={FileText} title="Logs">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Execuções" value={data.execLogCount} sub="registradas" />
              <Stat label="Alterações" value={data.changeLogCount} sub="registradas" />
            </div>
          </Card>

        </div>

        {/* Col 2 */}
        <div className="space-y-4">

          {/* Audio library */}
          <Card icon={Music2} title="Biblioteca de Áudio">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat label="Pastas" value={folders.length} />
              <Stat label="Músicas" value={totalFiles} />
              <Stat
                label="Duração total"
                value={totalDurationMs > 0 ? formatDuration(totalDurationMs) : "—"}
              />
            </div>
            <div className="pt-3 border-t border-slate-50">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Pastas</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {folders.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma pasta cadastrada</p>
                ) : (
                  folders.map((f) => {
                    const count = filesPerFolder[f.id]?.length ?? 0;
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
                  })
                )}
              </div>
            </div>
            {settings.audio_storage_folder && (
              <div className="pt-3 mt-3 border-t border-slate-50">
                <p className="text-xs text-slate-400 mb-0.5">Pasta de armazenamento</p>
                <p className="text-xs font-mono text-slate-600 break-all">{settings.audio_storage_folder}</p>
              </div>
            )}
          </Card>

          {/* Schedules */}
          <Card icon={Clock} title="Agendamentos">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat label="Total" value={schedules.length} />
              <Stat label="Ativos" value={activeSchedules} />
              <Stat label="Inativos" value={inactiveSchedules} />
            </div>
            {schedules.length > 0 && (
              <div className="pt-3 border-t border-slate-50">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Próximos agendamentos</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {[...schedules]
                    .filter((s) => s.is_active)
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .slice(0, 5)
                    .map((s) => (
                      <div key={s.id} className="flex items-center gap-2 py-0.5">
                        <span className="font-mono text-xs text-slate-500 w-12 flex-shrink-0">{s.time}</span>
                        <span className="text-sm text-slate-700 truncate">{s.name || "—"}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </Card>

          {/* Backup & NTP */}
          <Card icon={HardDrive} title="Backup & Configurações">
            <InfoRow
              label="Backup automático"
              value={
                settings.backup_auto_enabled ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Ativo ({settings.backup_interval_hours}h)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400">
                    <XCircle className="h-3.5 w-3.5" />
                    Desativado
                  </span>
                )
              }
            />
            <InfoRow
              label="Pasta de backup"
              value={settings.backup_folder || <span className="text-slate-400 font-normal">Não configurada</span>}
              mono={!!settings.backup_folder}
            />
            <InfoRow
              label="Iniciar minimizado"
              value={settings.start_minimized ? (
                <span className="flex items-center gap-1 text-slate-600"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Sim</span>
              ) : "Não"}
            />
            <InfoRow
              label="Iniciar com Windows"
              value={settings.start_with_os ? (
                <span className="flex items-center gap-1 text-slate-600"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Sim</span>
              ) : "Não"}
            />
            <InfoRow
              label="Volume padrão"
              value={`${Math.round(settings.default_volume * 100)}%`}
              mono
            />
            <div className="pt-2 mt-2 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">NTP</span>
              </div>
              <InfoRow
                label="Servidor"
                value={settings.ntp_server}
                mono
              />
              <InfoRow
                label="Sincronização automática"
                value={settings.ntp_auto_sync ? (
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Ativa</span>
                ) : (
                  <span className="text-slate-400">Desativada</span>
                )}
              />
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
