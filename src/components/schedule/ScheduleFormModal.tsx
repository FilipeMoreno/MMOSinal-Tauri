import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WeekdayToggle } from "./WeekdayToggle";
import { useAudioStore } from "@/stores/audioStore";
import type { Schedule, ScheduleFormData, DayOfWeek } from "@/types";

const schema = z.object({
  name: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  days_of_week: z.array(z.number()).min(1, "Selecione ao menos um dia"),
  folder_id: z.number().nullable(),
  audio_file_id: z.number().nullable(),
  play_duration_s: z.number().min(1).max(3600),
  fade_in_s: z.number().min(0).max(30),
  fade_out_s: z.number().min(0).max(30),
  is_active: z.boolean(),
});

interface Props {
  open: boolean;
  schedule?: Schedule | null;
  onClose: () => void;
  onSave: (data: ScheduleFormData) => Promise<void>;
}

export function ScheduleFormModal({ open, schedule, onClose, onSave }: Props) {
  const { folders, files, fetchFolders, fetchFiles } = useAudioStore();

  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } =
    useForm<ScheduleFormData>({
      resolver: zodResolver(schema) as any,
      defaultValues: {
        name: "",
        time: "07:30",
        days_of_week: [1, 2, 3, 4, 5],
        folder_id: null,
        audio_file_id: null,
        play_duration_s: 30,
        fade_in_s: 2,
        fade_out_s: 2,
        is_active: true,
      },
    });

  const selectedFolderId = watch("folder_id");

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (selectedFolderId) fetchFiles(selectedFolderId);
  }, [selectedFolderId, fetchFiles]);

  useEffect(() => {
    if (schedule) {
      reset({
        name: schedule.name,
        time: schedule.time,
        days_of_week: schedule.days_of_week,
        folder_id: schedule.folder_id,
        audio_file_id: schedule.audio_file_id,
        play_duration_s: schedule.play_duration_s,
        fade_in_s: schedule.fade_in_s,
        fade_out_s: schedule.fade_out_s,
        is_active: schedule.is_active,
      });
    } else {
      reset();
    }
  }, [schedule, reset]);

  const filesForFolder = selectedFolderId ? (files[selectedFolderId] ?? []) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{schedule ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nome <span className="text-slate-400 text-xs">(opcional)</span></Label>
            <Input {...register("name")} placeholder="Ex: Entrada das aulas" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Horário</Label>
              <Input {...register("time")} type="time" />
              {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Duração (segundos)</Label>
              <Input
                {...register("play_duration_s", { valueAsNumber: true })}
                type="number" min={1} max={3600}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Dias da semana</Label>
            <Controller
              control={control}
              name="days_of_week"
              render={({ field }) => (
                <WeekdayToggle
                  value={field.value as DayOfWeek[]}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.days_of_week && (
              <p className="text-xs text-destructive">{errors.days_of_week.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Pasta de Áudio</Label>
            <Controller
              control={control}
              name="folder_id"
              render={({ field }) => (
                <Select
                  value={field.value?.toString() ?? ""}
                  onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma pasta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {filesForFolder.length > 0 && (
            <div className="space-y-1">
              <Label>Arquivo específico (opcional)</Label>
              <Controller
                control={control}
                name="audio_file_id"
                render={({ field }) => (
                  <Select
                    value={field.value?.toString() ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Toda a pasta (sequencial)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Toda a pasta (sequencial)</SelectItem>
                      {filesForFolder.map((f) => (
                        <SelectItem key={f.id} value={f.id.toString()}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Fade In (s)</Label>
              <Input {...register("fade_in_s", { valueAsNumber: true })} type="number" min={0} max={30} />
            </div>
            <div className="space-y-1">
              <Label>Fade Out (s)</Label>
              <Input {...register("fade_out_s", { valueAsNumber: true })} type="number" min={0} max={30} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label>Agendamento ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
