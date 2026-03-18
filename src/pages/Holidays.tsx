import { useEffect, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { Plus, Trash2, CalendarOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { holidayService } from "@/services/holidayService";
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
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => holidayService.list().then(setHolidays).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !date) return;
    setSaving(true);
    try {
      const h = await holidayService.create(name.trim(), date, recurring);
      setHolidays((prev) => [...prev, h].sort((a, b) => a.date.localeCompare(b.date)));
      setOpen(false);
      setName(""); setDate(""); setRecurring(false);
      toast.success("Feriado cadastrado");
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
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Feriados e Exceções</h1>
          <p className="text-sm text-slate-500 mt-1">
            Os sinais não tocarão nas datas cadastradas aqui.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {holidays.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CalendarOff className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nenhum feriado cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm">
              <div className="w-24 text-center">
                <div className="text-lg font-bold">
                  {format(parseISO(h.date), "dd/MM")}
                </div>
                {!h.is_recurring && (
                  <div className="text-xs text-slate-400">
                    {format(parseISO(h.date), "yyyy")}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="font-semibold">{h.name}</span>
                <div className="mt-1">
                  {h.is_recurring ? (
                    <Badge variant="secondary" className="text-xs">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Recorrente (todo ano)
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
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(h)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Feriado / Exceção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Natal, Conselho de Classe..." />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={recurring} onCheckedChange={setRecurring} />
              <Label>Recorre todo ano (ex: feriado nacional)</Label>
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
