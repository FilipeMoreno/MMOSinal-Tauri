import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Clock, Search, X } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScheduleFormModal } from "@/components/schedule/ScheduleFormModal";
import { useScheduleStore } from "@/stores/scheduleStore";
import { scheduleService } from "@/services/scheduleService";
import { changeLogService } from "@/services/changeLogService";
import { DAY_NAMES, formatSecondsToDisplay } from "@/lib/utils";
import type { Schedule, ScheduleFormData } from "@/types";
import { toast } from "sonner";

const PAGE_SIZE = 15;

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DAY_SHORT: Record<number, string> = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom" };

type StatusFilter = "all" | "active" | "inactive";

export function Schedules() {
  const { schedules, fetch, add, update, remove } = useScheduleStore();
  const { confirm, dialog } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async (data: ScheduleFormData) => {
    try {
      if (editing) {
        const updated = await scheduleService.update(editing.id, data);
        update(updated);
        toast.success("Agendamento atualizado");
        changeLogService.log("updated", "schedule", data.name || data.time);
      } else {
        const created = await scheduleService.create(data);
        add(created);
        toast.success("Agendamento criado");
        changeLogService.log("created", "schedule", data.name || data.time);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(`Erro: ${e}`);
      throw e;
    }
  };

  const handleDelete = async (s: Schedule) => {
    if (!await confirm({ message: `Remover "${s.name || s.time}"?`, confirmLabel: "Remover" })) return;
    try {
      await scheduleService.remove(s.id);
      remove(s.id);
      toast.success("Removido");
      changeLogService.log("deleted", "schedule", s.name || s.time);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleToggle = async (s: Schedule, active: boolean) => {
    try {
      await scheduleService.toggleActive(s.id, active);
      update({ ...s, is_active: active });
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...schedules]
      .sort((a, b) => a.time.localeCompare(b.time))
      .filter((s) => {
        if (q && !s.time.includes(q) && !(s.name ?? "").toLowerCase().includes(q)) return false;
        if (statusFilter === "active" && !s.is_active) return false;
        if (statusFilter === "inactive" && s.is_active) return false;
        if (dayFilter !== null && !(s.days_of_week as number[]).includes(dayFilter)) return false;
        return true;
      });
  }, [schedules, search, statusFilter, dayFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, statusFilter, dayFilter]);

  const hasFilter = search !== "" || statusFilter !== "all" || dayFilter !== null;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDayFilter(null);
  };

  return (
    <div className="p-6 w-full">
      {dialog}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agendamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} de {schedules.length} agendamento(s)
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Agendamento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-white border rounded-lg shadow-sm">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou horário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-1 border rounded-md p-1 bg-slate-50">
          {(["all", "active", "inactive"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDayFilter(dayFilter === d ? null : d)}
              className={`w-9 h-9 rounded-md text-xs font-semibold transition-colors ${
                dayFilter === d
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 h-9 px-2">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* List */}
      {schedules.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Clock className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum agendamento cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Agendamento" para começar</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum resultado para os filtros aplicados</p>
          <Button variant="link" onClick={clearFilters} className="mt-1 text-slate-500">Limpar filtros</Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm transition-all ${
                  s.is_active ? "border-slate-200" : "opacity-50 border-dashed"
                }`}
              >
                {/* Time */}
                <div className="text-2xl font-mono font-bold text-slate-700 w-16 tabular-nums flex-shrink-0">
                  {s.time}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {s.name ? (
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    ) : (
                      <span className="text-slate-400 italic text-sm">Sem nome</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.days_of_week.map((d) => (
                      <Badge key={d} variant="outline" className="text-xs px-1.5 py-0">
                        {DAY_NAMES[d]}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {formatSecondsToDisplay(s.play_duration_s)}
                    </Badge>
                    {s.fade_in_s > 0 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-blue-600 border-blue-200">
                        ↑ {s.fade_in_s}s
                      </Badge>
                    )}
                    {s.fade_out_s > 0 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-purple-600 border-purple-200">
                        ↓ {s.fade_out_s}s
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={s.is_active} onCheckedChange={(v) => handleToggle(s, v)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(s); setModalOpen(true); }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-slate-500">
                Página {page + 1} de {totalPages} — {filtered.length} resultado(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  Anterior
                </Button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <Button
                    key={i}
                    variant={i === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(i)}
                    className="w-9"
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ScheduleFormModal
        open={modalOpen}
        schedule={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
