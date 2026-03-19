import { useEffect, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { Plus, Trash2, CalendarOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { holidayService } from "@/services/holidayService";
import { changeLogService } from "@/services/changeLogService";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Holiday } from "@/types";
import { toast } from "sonner";

export function Holidays() {
  const { confirm, dialog } = useConfirm();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => holidayService.list().then(setHolidays).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !date) return;
    setSaving(true);
    try {
      const h = await holidayService.create(name.trim(), date, isRecurring);
      setHolidays((prev) => [...prev, h].sort((a, b) => a.date.localeCompare(b.date)));
      setOpen(false);
      setName(""); setDate(""); setIsRecurring(false);
      toast.success("Feriado cadastrado");
      changeLogService.log("created", "holiday", name.trim(), date);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!await confirm({ message: `Remover "${h.name}"?`, confirmLabel: "Remover" })) return;
    try {
      await holidayService.remove(h.id);
      setHolidays((prev) => prev.filter((x) => x.id !== h.id));
      toast.success("Removido");
      changeLogService.log("deleted", "holiday", h.name, h.date);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const recurringList = holidays.filter((h) => h.is_recurring);
  const oneTime = holidays.filter((h) => !h.is_recurring);

  return (
    <div className="p-6 w-full">
      {dialog}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Feriados e Exceções</h1>
          <p className="text-sm text-slate-500 mt-0.5">Os sinais não tocarão nas datas cadastradas aqui.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar
        </Button>
      </div>

      {holidays.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CalendarOff className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum feriado cadastrado</p>
          <p className="text-sm mt-1">Adicione datas em que os sinais não devem tocar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {recurringList.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Recorrentes (todo ano)</h2>
                <span className="text-xs text-slate-400">({recurringList.length})</span>
              </div>
              <div className="space-y-2">
                {recurringList.map((h) => <HolidayRow key={h.id} holiday={h} onDelete={handleDelete} />)}
              </div>
            </section>
          )}

          {oneTime.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <CalendarOff className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Datas específicas</h2>
                <span className="text-xs text-slate-400">({oneTime.length})</span>
              </div>
              <div className="space-y-2">
                {oneTime.map((h) => <HolidayRow key={h.id} holiday={h} onDelete={handleDelete} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Feriado / Exceção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Natal, Conselho de Classe..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50">
              <div>
                <p className="text-sm font-medium">Recorrente todo ano</p>
                <p className="text-xs text-slate-500">Ideal para feriados nacionais fixos</p>
              </div>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !name || !date}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HolidayRow({ holiday: h, onDelete }: { holiday: Holiday; onDelete: (h: Holiday) => void }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm">
      <div className="w-16 text-center flex-shrink-0">
        <div className="text-xl font-bold font-mono tabular-nums text-slate-700">
          {format(parseISO(h.date), "dd/MM")}
        </div>
        {!h.is_recurring && (
          <div className="text-xs text-slate-400">{format(parseISO(h.date), "yyyy")}</div>
        )}
      </div>

      <div className="flex-1">
        <p className="font-semibold text-slate-800">{h.name}</p>
        <div className="mt-1">
          {h.is_recurring ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <RefreshCw className="h-3 w-3" />
              Todo ano
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {format(parseISO(h.date), "EEEE", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
        onClick={() => onDelete(h)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
