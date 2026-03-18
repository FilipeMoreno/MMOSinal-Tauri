import { useEffect, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { RefreshCw, Trash2, FileText, CheckCircle, XCircle, AlertCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logService } from "@/services/logService";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ExecutionLog, LogStatus } from "@/types";
import { toast } from "sonner";

const STATUS_CONFIG: Record<LogStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  success: { label: "Sucesso", icon: CheckCircle, color: "text-green-500" },
  error: { label: "Erro", icon: XCircle, color: "text-red-500" },
  interrupted: { label: "Interrompido", icon: AlertCircle, color: "text-yellow-500" },
  skipped_holiday: { label: "Feriado", icon: SkipForward, color: "text-slate-400" },
};

const TRIGGER_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  manual: "Manual",
  panic: "Pânico",
};

export function Logs() {
  const { confirm, dialog } = useConfirm();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await logService.list(200);
      setLogs(data);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  return (
    <div className="p-6 max-w-5xl">
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Log de Execução</h1>
          <p className="text-sm text-slate-500 mt-1">{logs.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nenhum registro ainda</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">Data/Hora</th>
                <th className="text-left p-3 font-semibold text-slate-600">Agendamento</th>
                <th className="text-left p-3 font-semibold text-slate-600">Música</th>
                <th className="text-left p-3 font-semibold text-slate-600">Tipo</th>
                <th className="text-left p-3 font-semibold text-slate-600">Status</th>
                <th className="text-right p-3 font-semibold text-slate-600">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => {
                const cfg = STATUS_CONFIG[log.status];
                const Icon = cfg.icon;
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {format(parseISO(log.triggered_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td className="p-3 font-medium max-w-[160px] truncate">
                      {log.schedule_name ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[160px] truncate">
                      {log.audio_name ?? <span className="text-slate-400">—</span>}
                      {log.position_start_ms != null && log.position_start_ms > 0 && (
                        <span className="ml-1 text-xs text-blue-500">
                          (retomou {Math.round(log.position_start_ms / 1000)}s)
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {TRIGGER_LABEL[log.trigger_type] ?? log.trigger_type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className={`flex items-center gap-1 ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{cfg.label}</span>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 truncate max-w-[120px]">
                          {log.error_message}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right text-slate-500">
                      {log.played_duration_ms != null
                        ? `${(log.played_duration_ms / 1000).toFixed(1)}s`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
