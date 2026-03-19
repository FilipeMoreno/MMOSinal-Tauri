import { useEffect, useMemo, useState } from "react";
import {
  Plus, Edit2, Trash2, Clock, Search, X, CheckSquare, SlidersHorizontal,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScheduleFormModal } from "@/components/schedule/ScheduleFormModal";
import { useScheduleStore } from "@/stores/scheduleStore";
import { useAudioStore } from "@/stores/audioStore";
import { scheduleService } from "@/services/scheduleService";
import { audioService } from "@/services/audioService";
import { changeLogService } from "@/services/changeLogService";
import { DAY_NAMES, formatSecondsToDisplay } from "@/lib/utils";
import type { Schedule, ScheduleFormData } from "@/types";
import { toast } from "sonner";

const PAGE_SIZE = 15;

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DAY_SHORT: Record<number, string> = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom" };

type StatusFilter = "all" | "active" | "inactive";

// ── Bulk edit modal ───────────────────────────────────────────────────────────

interface BulkEditFields {
  play_duration_s: number;
  fade_in_s: number;
  fade_out_s: number;
  folder_id: number | null;
  is_active: boolean;
}

interface BulkEditEnabled {
  play_duration_s: boolean;
  fade_in_s: boolean;
  fade_out_s: boolean;
  folder_id: boolean;
  is_active: boolean;
}

interface BulkEditModalProps {
  open: boolean;
  count: number;
  folders: { id: number; name: string }[];
  onClose: () => void;
  onSave: (fields: Partial<BulkEditFields>) => Promise<void>;
}

function BulkEditModal({ open, count, folders, onClose, onSave }: BulkEditModalProps) {
  const [enabled, setEnabled] = useState<BulkEditEnabled>({
    play_duration_s: false, fade_in_s: false, fade_out_s: false,
    folder_id: false, is_active: false,
  });
  const [values, setValues] = useState<BulkEditFields>({
    play_duration_s: 60, fade_in_s: 0, fade_out_s: 0, folder_id: null, is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setEnabled({ play_duration_s: false, fade_in_s: false, fade_out_s: false, folder_id: false, is_active: false });
      setValues({ play_duration_s: 60, fade_in_s: 0, fade_out_s: 0, folder_id: null, is_active: true });
    }
  }, [open]);

  const toggle = (key: keyof BulkEditEnabled) =>
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  const set = <K extends keyof BulkEditFields>(key: K, val: BulkEditFields[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const anyEnabled = Object.values(enabled).some(Boolean);

  const handleSave = async () => {
    const patch: Partial<BulkEditFields> = {};
    if (enabled.play_duration_s) patch.play_duration_s = values.play_duration_s;
    if (enabled.fade_in_s)       patch.fade_in_s       = values.fade_in_s;
    if (enabled.fade_out_s)      patch.fade_out_s       = values.fade_out_s;
    if (enabled.folder_id)       patch.folder_id        = values.folder_id;
    if (enabled.is_active)       patch.is_active        = values.is_active;
    setSaving(true);
    try { await onSave(patch); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-blue-500" />
            Editar {count} agendamento(s)
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-400 -mt-1 mb-3">
          Marque os campos que deseja alterar em todos os selecionados.
        </p>

        <div className="space-y-3">
          {/* Duração */}
          <FieldRow
            label="Duração (s)"
            enabled={enabled.play_duration_s}
            onToggle={() => toggle("play_duration_s")}
          >
            <Input
              type="number" min={1}
              value={values.play_duration_s}
              onChange={(e) => set("play_duration_s", Number(e.target.value))}
              className="h-8 text-sm"
              disabled={!enabled.play_duration_s}
            />
          </FieldRow>

          {/* Fade In */}
          <FieldRow
            label="Fade In (s)"
            enabled={enabled.fade_in_s}
            onToggle={() => toggle("fade_in_s")}
          >
            <Input
              type="number" min={0}
              value={values.fade_in_s}
              onChange={(e) => set("fade_in_s", Number(e.target.value))}
              className="h-8 text-sm"
              disabled={!enabled.fade_in_s}
            />
          </FieldRow>

          {/* Fade Out */}
          <FieldRow
            label="Fade Out (s)"
            enabled={enabled.fade_out_s}
            onToggle={() => toggle("fade_out_s")}
          >
            <Input
              type="number" min={0}
              value={values.fade_out_s}
              onChange={(e) => set("fade_out_s", Number(e.target.value))}
              className="h-8 text-sm"
              disabled={!enabled.fade_out_s}
            />
          </FieldRow>

          {/* Pasta */}
          <FieldRow
            label="Pasta de áudio"
            enabled={enabled.folder_id}
            onToggle={() => toggle("folder_id")}
          >
            <select
              value={values.folder_id ?? ""}
              onChange={(e) => set("folder_id", e.target.value === "" ? null : Number(e.target.value))}
              disabled={!enabled.folder_id}
              className="w-full h-8 text-sm rounded-md border border-slate-200 px-2 bg-white disabled:opacity-50"
            >
              <option value="">— nenhuma —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </FieldRow>

          {/* Status */}
          <FieldRow
            label="Status"
            enabled={enabled.is_active}
            onToggle={() => toggle("is_active")}
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={values.is_active}
                onCheckedChange={(v) => set("is_active", v)}
                disabled={!enabled.is_active}
              />
              <span className="text-sm text-slate-600">{values.is_active ? "Ativo" : "Inativo"}</span>
            </div>
          </FieldRow>
        </div>

        <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!anyEnabled || saving}>
            {saving ? "Salvando..." : "Aplicar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label, enabled, onToggle, children,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="h-4 w-4 rounded border-slate-300 cursor-pointer flex-shrink-0"
      />
      <span className="text-sm text-slate-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Schedules() {
  const { schedules, fetch, add, update, remove } = useScheduleStore();
  const { folders, fetchFolders } = useAudioStore();
  const { confirm, dialog } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { fetchFolders(); }, [fetchFolders]);

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
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
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

  // ── Bulk operations ───────────────────────────────────────────────────────

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!await confirm({ message: `Remover ${ids.length} agendamento(s) selecionado(s)?`, confirmLabel: "Remover" })) return;
    try {
      for (const id of ids) {
        await scheduleService.remove(id);
        remove(id);
      }
      setSelectedIds(new Set());
      toast.success(`${ids.length} agendamento(s) removido(s)`);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleBulkEdit = async (patch: Partial<BulkEditFields>) => {
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        const s = schedules.find((x) => x.id === id);
        if (!s) continue;
        const data: ScheduleFormData = {
          name: s.name,
          time: s.time,
          days_of_week: s.days_of_week,
          folder_id: patch.folder_id !== undefined ? patch.folder_id : s.folder_id,
          audio_file_id: patch.folder_id !== undefined ? null : s.audio_file_id,
          play_duration_s: patch.play_duration_s ?? s.play_duration_s,
          fade_in_s: patch.fade_in_s ?? s.fade_in_s,
          fade_out_s: patch.fade_out_s ?? s.fade_out_s,
          is_active: patch.is_active ?? s.is_active,
        };
        const updated = await scheduleService.update(id, data);
        update(updated);
      }
      setSelectedIds(new Set());
      toast.success(`${ids.length} agendamento(s) atualizado(s)`);
      changeLogService.log("updated", "schedule", null, `Edição em lote: ${ids.length} agendamento(s)`);
    } catch (e) {
      toast.error(`Erro: ${e}`);
      throw e;
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((s) => s.id)));
    }
  };

  // ── Filters ───────────────────────────────────────────────────────────────

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

  useEffect(() => { setPage(0); setSelectedIds(new Set()); }, [search, statusFilter, dayFilter]);

  const hasFilter = search !== "" || statusFilter !== "all" || dayFilter !== null;
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setDayFilter(null); };

  const allPageSelected = paged.length > 0 && paged.every((s) => selectedIds.has(s.id));

  return (
    <div className="p-6 w-full">
      {dialog}
      <BulkEditModal
        open={bulkEditOpen}
        count={selectedIds.size}
        folders={folders}
        onClose={() => setBulkEditOpen(false)}
        onSave={handleBulkEdit}
      />

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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          <CheckSquare className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-700">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 bg-white"
              onClick={() => setBulkEditOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Editar campos
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 bg-white"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-slate-500"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar seleção
            </Button>
          </div>
        </div>
      )}

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
          {/* Column header with select-all */}
          <div className="flex items-center gap-4 px-4 py-2 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <div className="flex items-center gap-3 flex-shrink-0">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-slate-300 cursor-pointer"
                title="Selecionar todos desta página"
              />
              <span className="w-16">Horário</span>
            </div>
            <span className="flex-1">Nome / Dias</span>
            <span className="flex-shrink-0 text-right">Ações</span>
          </div>

          <div className="space-y-2">
            {paged.map((s) => {
              const isSelected = selectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm transition-all ${
                    isSelected
                      ? "border-blue-300 bg-blue-50/40"
                      : s.is_active
                      ? "border-slate-200"
                      : "opacity-50 border-dashed"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 cursor-pointer flex-shrink-0"
                  />

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
              );
            })}
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

