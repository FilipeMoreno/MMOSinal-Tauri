import { useEffect, useState } from "react";
import { Save, FolderOpen, HardDrive, Zap, Plus, Trash2, Clock, RefreshCw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { settingsService, backupService } from "@/services/backupService";
import { timesyncService } from "@/services/timesyncService";
import type { TimeSyncResult } from "@/types";
import { panicService } from "@/services/panicService";
import { useAudioStore } from "@/stores/audioStore";
import { useSyncStore } from "@/stores/syncStore";
import { useConfirm } from "@/hooks/useConfirm";
import type { AppSettings, PanicButton, InterruptMode } from "@/types";
import { toast } from "sonner";

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    backup_folder: "",
    backup_auto_enabled: false,
    backup_interval_hours: 24,
    audio_storage_folder: "",
    start_minimized: false,
    start_with_os: false,
    ntp_server: "a.ntp.br",
    ntp_auto_sync: true,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<TimeSyncResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [backing, setBacking] = useState(false);

  const [panicButtons, setPanicButtons] = useState<PanicButton[]>([]);
  const [panicModal, setPanicModal] = useState(false);
  const [panicName, setPanicName] = useState("");
  const [panicFileId, setPanicFileId] = useState<number | null>(null);
  const [panicMode, setPanicMode] = useState<InterruptMode>("interrupt");
  const [panicColor, setPanicColor] = useState("#ef4444");
  const [savingPanic, setSavingPanic] = useState(false);

  const { folders, files, fetchFolders, fetchFiles, selectedFolderId, selectFolder } = useAudioStore();
  const setSynced = useSyncStore((s) => s.setSynced);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [savedSettings, buttons, autostartEnabled] = await Promise.all([
          settingsService.get(),
          panicService.list(),
          isAutostartEnabled().catch(() => null),
        ]);

        if (!mounted) return;

        setSettings({
          ...savedSettings,
          start_with_os: autostartEnabled ?? savedSettings.start_with_os,
        });
        setPanicButtons(buttons);
      } catch (e) {
        console.error(e);
      } finally {
        fetchFolders();
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [fetchFolders]);

  const pickFolder = async (field: keyof AppSettings) => {
    const dir = await open({ directory: true });
    if (dir && typeof dir === "string") {
      setSettings((prev) => ({ ...prev, [field]: dir }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.save(settings);

      try {
        if (settings.start_with_os) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }
      } catch (autostartError) {
        console.error(autostartError);
        toast.error("Configurações salvas, mas não foi possível atualizar o autostart");
        return;
      }

      toast.success("Configurações salvas");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await backupService.triggerManual();
      if (result.success) toast.success(`Backup criado: ${result.backup_path}`);
      else toast.error(`Falha no backup: ${result.error}`);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setBacking(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await timesyncService.syncTime(settings.ntp_server);
      setSyncResult(result);
      setSynced(true, result.offset_s);
      if (result.applied) {
        toast.success(`Horário ajustado (offset: ${result.offset_s}s) → ${result.ntp_time}`);
      } else {
        toast.success(`Horário já correto (offset: ${result.offset_s}s)`);
      }
    } catch (e) {
      toast.error(`Erro na sincronização: ${e}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSavePanic = async () => {
    if (!panicName || !panicFileId) return;
    setSavingPanic(true);
    try {
      const btn = await panicService.create(panicName, panicFileId, panicMode, panicColor);
      setPanicButtons((prev) => [...prev, btn]);
      setPanicModal(false);
      setPanicName(""); setPanicFileId(null);
      toast.success("Botão criado");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setSavingPanic(false);
    }
  };

  const handleDeletePanic = async (id: number) => {
    if (!await confirm({ message: "Remover este botão de acionamento?", confirmLabel: "Remover" })) return;
    try {
      await panicService.remove(id);
      setPanicButtons((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {dialog}
      <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>

      {/* Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Pasta de destino do backup</Label>
            <div className="flex gap-2">
              <Input
                value={settings.backup_folder}
                onChange={(e) => setSettings((s) => ({ ...s, backup_folder: e.target.value }))}
                placeholder="Selecione uma pasta..."
                readOnly
              />
              <Button variant="outline" onClick={() => pickFolder("backup_folder")}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Pasta de armazenamento dos áudios</Label>
            <div className="flex gap-2">
              <Input
                value={settings.audio_storage_folder}
                onChange={(e) => setSettings((s) => ({ ...s, audio_storage_folder: e.target.value }))}
                placeholder="Padrão: pasta de dados do aplicativo"
                readOnly
              />
              <Button variant="outline" onClick={() => pickFolder("audio_storage_folder")}>
                <FolderOpen className="h-4 w-4" />
              </Button>
              {settings.audio_storage_folder && (
                <Button
                  variant="outline"
                  onClick={() => setSettings((s) => ({ ...s, audio_storage_folder: "" }))}
                >
                  Limpar
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Reinicie o aplicativo para aplicar a nova pasta de áudio.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={settings.backup_auto_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, backup_auto_enabled: v }))}
            />
            <Label>Backup automático</Label>
          </div>

          {settings.backup_auto_enabled && (
            <div className="space-y-1">
              <Label>Intervalo (horas)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.backup_interval_hours}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, backup_interval_hours: Number(e.target.value) }))
                }
                className="w-32"
              />
            </div>
          )}

          <Button variant="outline" onClick={handleBackup} disabled={backing}>
            {backing ? "Fazendo backup..." : "Fazer backup agora"}
          </Button>
        </CardContent>
      </Card>

      {/* Sistema */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Iniciar minimizado na bandeja</Label>
            <Switch
              checked={settings.start_minimized}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, start_minimized: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Iniciar com o Windows</Label>
            <Switch
              checked={settings.start_with_os}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, start_with_os: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sincronização de Horário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sincronização de Horário (NTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Servidor NTP</Label>
            <Input
              value={settings.ntp_server}
              onChange={(e) => setSettings((s) => ({ ...s, ntp_server: e.target.value }))}
              placeholder="a.ntp.br"
            />
            <p className="text-xs text-slate-500">
              Padrão: a.ntp.br (servidor brasileiro). Outros: pool.ntp.org, time.windows.com
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Sincronizar automaticamente ao iniciar</Label>
            <Switch
              checked={settings.ntp_auto_sync}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, ntp_auto_sync: v }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
            {syncResult && (
              <span className="text-sm text-slate-600">
                {syncResult.applied
                  ? `✓ Ajustado ${syncResult.offset_s}s → ${syncResult.ntp_time}`
                  : `✓ Correto (offset ${syncResult.offset_s}s)`}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Requer execução como Administrador para ajustar o relógio do sistema.
          </p>
        </CardContent>
      </Card>

      {/* Botões de pânico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Botões de Acionamento Manual
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { fetchFolders(); setPanicModal(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {panicButtons.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum botão configurado.</p>
          ) : (
            <div className="space-y-2">
              {panicButtons.map((btn) => (
                <div key={btn.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div
                    className="w-8 h-8 rounded-md flex-shrink-0"
                    style={{ backgroundColor: btn.color_hex }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{btn.name}</p>
                    <p className="text-xs text-slate-400">
                      {btn.interrupt_mode === "interrupt" ? "Interrompe imediatamente" : "Pausa a fila"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeletePanic(btn.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>

      {/* Panic Button Modal */}
      <Dialog open={panicModal} onOpenChange={setPanicModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Botão de Acionamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={panicName} onChange={(e) => setPanicName(e.target.value)} placeholder="Ex: Evacuação" />
            </div>
            <div className="space-y-1">
              <Label>Pasta de Áudio</Label>
              <Select
                value={selectedFolderId?.toString() ?? ""}
                onValueChange={(v) => { selectFolder(Number(v)); fetchFiles(Number(v)); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta..." />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedFolderId && (
              <div className="space-y-1">
                <Label>Arquivo de Áudio</Label>
                <Select
                  value={panicFileId?.toString() ?? ""}
                  onValueChange={(v) => setPanicFileId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um arquivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(files[selectedFolderId] ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Modo de interrupção</Label>
              <Select value={panicMode} onValueChange={(v) => setPanicMode(v as InterruptMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interrupt">Interrompe imediatamente</SelectItem>
                  <SelectItem value="queue_pause">Pausa a fila e retoma depois</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cor do botão</Label>
              <Input type="color" value={panicColor} onChange={(e) => setPanicColor(e.target.value)} className="h-10 w-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPanicModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePanic} disabled={savingPanic || !panicName || !panicFileId}>
              {savingPanic ? "Salvando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
