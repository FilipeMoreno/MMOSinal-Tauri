import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScheduleFormModal } from "@/components/schedule/ScheduleFormModal";
import { useScheduleStore } from "@/stores/scheduleStore";
import { scheduleService } from "@/services/scheduleService";
import { DAY_NAMES, formatSecondsToDisplay } from "@/lib/utils";
import type { Schedule, ScheduleFormData } from "@/types";
import { toast } from "sonner";

export function Schedules() {
  const { schedules, fetch, add, update, remove } = useScheduleStore();
  const { confirm, dialog } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleSave = async (data: ScheduleFormData) => {
    try {
      if (editing) {
        const updated = await scheduleService.update(editing.id, data);
        update(updated);
        toast.success("Agendamento atualizado");
      } else {
        const created = await scheduleService.create(data);
        add(created);
        toast.success("Agendamento criado");
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

  const sorted = [...schedules].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="p-6 max-w-5xl">
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Agendamentos</h1>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Agendamento
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nenhum agendamento cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Agendamento" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm transition-opacity ${
                s.is_active ? "opacity-100" : "opacity-50"
              }`}
            >
              <div className="text-2xl font-mono font-bold text-slate-700 w-16">{s.time}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.name || <span className="text-slate-400 italic">Sem nome</span>}</span>
                  {!s.is_active && <Badge variant="secondary">Inativo</Badge>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.days_of_week.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">{DAY_NAMES[d]}</Badge>
                  ))}
                  <Badge variant="secondary" className="text-xs">
                    {formatSecondsToDisplay(s.play_duration_s)}
                  </Badge>
                  {s.fade_in_s > 0 && (
                    <Badge variant="outline" className="text-xs text-blue-600">
                      fade-in {s.fade_in_s}s
                    </Badge>
                  )}
                  {s.fade_out_s > 0 && (
                    <Badge variant="outline" className="text-xs text-purple-600">
                      fade-out {s.fade_out_s}s
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={s.is_active}
                  onCheckedChange={(v) => handleToggle(s, v)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setEditing(s); setModalOpen(true); }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(s)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
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
