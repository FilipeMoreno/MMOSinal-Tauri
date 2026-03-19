import { useEffect, useRef, useMemo, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import {
  RefreshCw, Trash2, FileText, CheckCircle, XCircle, AlertCircle,
  SkipForward, ChevronLeft, ChevronRight, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logService } from "@/services/logService";
import { changeLogService } from "@/services/changeLogService";
import { usePlayerStore } from "@/stores/playerStore";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ExecutionLog, LogStatus, ChangeLog } from "@/types";
import { toast } from "sonner";

const STATUS_CONFIG: Record<LogStatus, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  success:        { label: "Sucesso",       icon: CheckCircle,  color: "text-green-600",  bg: "bg-green-50 border-green-200"  },
  error:          { label: "Erro",          icon: XCircle,      color: "text-red-600",    bg: "bg-red-50 border-red-200"      },
  interrupted:    { label: "Interrompido",  icon: AlertCircle,  color: "text-amber-600",  bg: "bg-amber-50 border-amber-200"  },
  skipped_holiday:{ label: "Feriado",       icon: SkipForward,  color: "text-slate-500",  bg: "bg-slate-50 border-slate-200"  },
};

const TRIGGER_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  manual: "Manual",
  panic: "Pânico",
};

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  created:  { label: "Criado",      color: "bg-green-50 text-green-700 border-green-200"  },
  updated:  { label: "Editado",     color: "bg-blue-50 text-blue-700 border-blue-200"     },
  deleted:  { label: "Removido",    color: "bg-red-50 text-red-700 border-red-200"        },
  moved:    { label: "Movido",      color: "bg-purple-50 text-purple-700 border-purple-200" },
  imported: { label: "Importado",   color: "bg-amber-50 text-amber-700 border-amber-200"  },
  saved:    { label: "Salvo",       color: "bg-slate-50 text-slate-700 border-slate-200"  },
  renamed:  { label: "Renomeado",   color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  triggered:{ label: "Disparado",   color: "bg-orange-50 text-orange-700 border-orange-200" },
  exported: { label: "Exportado",   color: "bg-teal-50 text-teal-700 border-teal-200"       },
};

const ENTITY_LABEL: Record<string, string> = {
  schedule:      "Agendamento",
  audio_file:    "Arquivo de áudio",
  audio_folder:  "Pasta de áudio",
  holiday:       "Feriado",
  settings:      "Configurações",
  panic_button:  "Botão de pânico",
};

const PAGE_SIZE = 20;

type StatusFilterKey = "all" | LogStatus;
type TriggerFilterKey = "all" | "scheduled" | "manual" | "panic";
type ActiveTab = "execucoes" | "alteracoes";

// ── Execution Logs Tab ────────────────────────────────────────────────────────

function ExecutionLogsTab() {
  const { confirm, dialog } = useConfirm();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilterKey>("all");
  const [page, setPage] = useState(0);

  const playerStatus = usePlayerStore((s) => s.status);
  const prevStatusRef = useRef(playerStatus);

  const load = async () => {
    setLoading(true);
    try {
      const data = await logService.list(500);
      setLogs(data);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (prevStatusRef.current !== "idle" && playerStatus === "idle") load();
    prevStatusRef.current = playerStatus;
  }, [playerStatus]);

  const handleClear = async () => {
    if (!await confirm({ title: "Limpar Logs", message: "Remover todos os registros de execução?", confirmLabel: "Limpar" })) return;
    try {
      await logService.clearAll();
      setLogs([]);
      toast.success("Logs limpos");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const filtered = useMemo(() => logs.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (triggerFilter !== "all" && l.trigger_type !== triggerFilter) return false;
    return true;
  }), [logs, statusFilter, triggerFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [statusFilter, triggerFilter]);

  const stats = useMemo(() => ({
    success: logs.filter((l) => l.status === "success").length,
    error: logs.filter((l) => l.status === "error").length,
    interrupted: logs.filter((l) => l.status === "interrupted").length,
  }), [logs]);

  return (
    <>
      {dialog}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{filtered.length} de {logs.length} registro(s)</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Limpar
          </Button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div><p className="text-xl font-bold text-slate-800">{stats.success}</p><p className="text-xs text-slate-500">Sucesso</p></div>
          </div>
          <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div><p className="text-xl font-bold text-slate-800">{stats.interrupted}</p><p className="text-xs text-slate-500">Interrompidos</p></div>
          </div>
          <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div><p className="text-xl font-bold text-slate-800">{stats.error}</p><p className="text-xs text-slate-500">Erros</p></div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white border rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            {(["all", "success", "error", "interrupted", "skipped_holiday"] as StatusFilterKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "all" ? "Todos" : STATUS_CONFIG[s as LogStatus]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Tipo:</span>
            {(["all", "scheduled", "manual", "panic"] as TriggerFilterKey[]).map((t) => (
              <button
                key={t}
                onClick={() => setTriggerFilter(t)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  triggerFilter === t ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t === "all" ? "Todos" : TRIGGER_LABEL[t] ?? t}
              </button>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum registro ainda</p>
          <p className="text-sm mt-1">Os logs aparecem aqui após os sinais tocarem</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">Nenhum log com os filtros selecionados</p>
          <Button variant="link" onClick={() => { setStatusFilter("all"); setTriggerFilter("all"); }} className="text-slate-500">
            Limpar filtros
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Agendamento</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Arquivo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((log) => {
                  const cfg = STATUS_CONFIG[log.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">
                        {format(parseISO(log.triggered_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate">
                        {log.schedule_name ?? <span className="text-slate-400 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                        <span className="truncate block">{log.audio_name ?? <span className="text-slate-400">—</span>}</span>
                        {log.position_start_ms != null && log.position_start_ms > 0 && (
                          <span className="text-xs text-blue-500">retomou {Math.round(log.position_start_ms / 1000)}s</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {TRIGGER_LABEL[log.trigger_type] ?? log.trigger_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-red-400 mt-0.5 max-w-[140px] truncate">{log.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs tabular-nums">
                        {log.played_duration_ms != null ? `${(log.played_duration_ms / 1000).toFixed(1)}s` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-slate-500">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600 px-2">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Change Logs Tab ───────────────────────────────────────────────────────────

function ChangeLogsTab() {
  const { confirm, dialog } = useConfirm();
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const data = await changeLogService.list(500);
      setLogs(data);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    if (!await confirm({ title: "Limpar Alterações", message: "Remover todo o histórico de alterações?", confirmLabel: "Limpar" })) return;
    try {
      await changeLogService.clearAll();
      setLogs([]);
      toast.success("Histórico limpo");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const entityTypes = useMemo(() => {
    const set = new Set(logs.map((l) => l.entity_type));
    return Array.from(set).sort();
  }, [logs]);

  const actionTypes = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (entityFilter !== "all" && l.entity_type !== entityFilter) return false;
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    return true;
  }), [logs, entityFilter, actionFilter]);

  useEffect(() => { setPage(0); }, [entityFilter, actionFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {dialog}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{filtered.length} de {logs.length} alteração(ões)</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Limpar
          </Button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white border rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Entidade:</span>
            <button
              onClick={() => setEntityFilter("all")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${entityFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Todos
            </button>
            {entityTypes.map((et) => (
              <button
                key={et}
                onClick={() => setEntityFilter(et)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${entityFilter === et ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {ENTITY_LABEL[et] ?? et}
              </button>
            ))}
          </div>

          {actionTypes.length > 1 && (
            <>
              <div className="w-px h-5 bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Ação:</span>
                <button
                  onClick={() => setActionFilter("all")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${actionFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Todos
                </button>
                {actionTypes.map((a) => (
                  <button
                    key={a}
                    onClick={() => setActionFilter(a)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${actionFilter === a ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {ACTION_LABEL[a]?.label ?? a}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <History className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhuma alteração registrada</p>
          <p className="text-sm mt-1">As alterações aparecerão aqui conforme você usar o sistema</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">Nenhuma alteração com os filtros selecionados</p>
          <Button variant="link" onClick={() => { setEntityFilter("all"); setActionFilter("all"); }} className="text-slate-500">
            Limpar filtros
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Ação</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Entidade</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((log) => {
                  const actionCfg = ACTION_LABEL[log.action];
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">
                        {format(parseISO(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${actionCfg?.color ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                          {actionCfg?.label ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">
                        {log.entity_name ?? <span className="text-slate-400 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[220px] truncate">
                        {log.details ?? <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-slate-500">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600 px-2">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Logs() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("execucoes");

  return (
    <div className="p-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">Histórico de execuções e alterações</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("execucoes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "execucoes"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="h-4 w-4" />
          Execuções
        </button>
        <button
          onClick={() => setActiveTab("alteracoes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === "alteracoes"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History className="h-4 w-4" />
          Alterações
        </button>
      </div>

      {activeTab === "execucoes" ? <ExecutionLogsTab /> : <ChangeLogsTab />}
    </div>
  );
}
