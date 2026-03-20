import { useEffect, useState } from "react";
import {
  Save, FolderOpen, HardDrive, Zap, Plus, Trash2,
  RefreshCw, Monitor, Wifi, Volume2, Upload, Download, Snowflake, Pencil,
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { settingsService, backupService } from "@/services/backupService";
import { VOLUME_CHANGED_EVENT } from "@/components/shared/VolumeControl";
import { timesyncService } from "@/services/timesyncService";
import { configService } from "@/services/configService";
import { changeLogService } from "@/services/changeLogService";
import type { TimeSyncResult } from "@/types";
import { panicService } from "@/services/panicService";
import { seasonalService } from "@/services/seasonalService";
import { useAudioStore } from "@/stores/audioStore";
import { useSyncStore } from "@/stores/syncStore";
import { useConfirm } from "@/hooks/useConfirm";
import type { AppSettings, PanicButton, InterruptMode, SeasonalOverride, SeasonalOverrideFormData } from "@/types";
import { toast } from "sonner";

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-5 py-5 space-y-5">{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FolderInput({ value, placeholder, onChange, onPick, onClear }: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onPick: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly className="flex-1" />
      <Button variant="outline" size="icon" onClick={onPick} title="Selecionar pasta">
        <FolderOpen className="h-4 w-4" />
      </Button>
      {onClear && value && (
        <Button variant="outline" size="sm" onClick={onClear} className="text-slate-500">
          Limpar
        </Button>
      )}
    </div>
  );
}

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
    default_volume: 1.0,
    setup_complete: true,
    kiosk_mode: false,
    kiosk_start: false,
    mini_player_enabled: true,
  });
  const [savedKiosk, setSavedKiosk] = useState(false);
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

  // Seasonal overrides state
  const [seasonalOverrides, setSeasonalOverrides] = useState<SeasonalOverride[]>([]);
  const [seasonalModal, setSeasonalModal] = useState(false);
  const [seasonalEditing, setSeasonalEditing] = useState<SeasonalOverride | null>(null);
  const emptySeasonalForm = (): SeasonalOverrideFormData => ({
    name: "", replacement_folder_id: 0,
    start_month: 1, start_day: 1, end_month: 1, end_day: 31, is_active: true,
  });
  const [seasonalForm, setSeasonalForm] = useState<SeasonalOverrideFormData>(emptySeasonalForm());
  const [savingSeasonal, setSavingSeasonal] = useState(false);

  const { folders, files, fetchFolders, fetchFiles, selectedFolderId, selectFolder } = useAudioStore();
  const setSynced = useSyncStore((s) => s.setSynced);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [savedSettings, buttons, autostartEnabled, seasonal] = await Promise.all([
          settingsService.get(),
          panicService.list(),
          isAutostartEnabled().catch(() => null),
          seasonalService.list(),
        ]);
        if (!mounted) return;
        setSettings({ ...savedSettings, start_with_os: autostartEnabled ?? savedSettings.start_with_os });
        setSavedKiosk(savedSettings.kiosk_mode);
        setPanicButtons(buttons);
        setSeasonalOverrides(seasonal);
      } catch (e) {
        console.error(e);
      } finally {
        fetchFolders();
      }
    };
    load();
    return () => { mounted = false; };
  }, [fetchFolders]);

  // Keep default_volume in sync when VolumeControl changes it live
  useEffect(() => {
    const handler = (e: Event) => {
      const val = (e as CustomEvent<number>).detail;
      setSettings((s) => ({ ...s, default_volume: val }));
    };
    window.addEventListener(VOLUME_CHANGED_EVENT, handler);
    return () => window.removeEventListener(VOLUME_CHANGED_EVENT, handler);
  }, []);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const pickFolder = async (field: keyof AppSettings) => {
    const dir = await open({ directory: true });
    if (dir && typeof dir === "string") set(field, dir as AppSettings[typeof field]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.save(settings);
      try {
        settings.start_with_os ? await enableAutostart() : await disableAutostart();
      } catch {
        toast.error("Configurações salvas, mas não foi possível atualizar o autostart");
        return;
      }
      await invoke("set_kiosk_mode", { enabled: settings.kiosk_mode });
      setSavedKiosk(settings.kiosk_mode);
      window.dispatchEvent(new CustomEvent("app:settings-saved", { detail: settings }));
      toast.success("Configurações salvas");
      changeLogService.log("saved", "settings");
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
      toast.success(result.applied
        ? `Horário ajustado (offset: ${result.offset_s}s) → ${result.ntp_time}`
        : `Horário já correto (offset: ${result.offset_s}s)`);
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
      changeLogService.log("created", "panic_button", panicName);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setSavingPanic(false);
    }
  };

  const handleExport = async () => {
    const path = await save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: `mmo-sinal-config-${new Date().toISOString().slice(0, 10)}.json`,
    });
    if (!path) return;
    try {
      await configService.exportConfig(path);
      toast.success("Configuração exportada com sucesso");
      changeLogService.log("exported", "settings", null, path);
    } catch (e) {
      toast.error(`Erro ao exportar: ${e}`);
    }
  };

  const handleImport = async () => {
    if (!await confirm({
      title: "Importar configuração",
      message: "Isso substituirá TODOS os agendamentos, feriados e botões de acionamento existentes. Continuar?",
      confirmLabel: "Importar",
    })) return;
    const path = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!path || typeof path !== "string") return;
    try {
      const result = await configService.importConfig(path);
      toast.success(
        `Importado: ${result.schedules_imported} agendamentos, ${result.holidays_imported} feriados, ${result.panic_buttons_imported} botões`
      );
      changeLogService.log("imported", "settings", null, `${result.schedules_imported} agendamentos, ${result.holidays_imported} feriados, ${result.panic_buttons_imported} botões`);
    } catch (e) {
      toast.error(`Erro ao importar: ${e}`);
    }
  };

  const handleDeletePanic = async (id: number) => {
    const btn = panicButtons.find((b) => b.id === id);
    if (!await confirm({ message: "Remover este botão de acionamento?", confirmLabel: "Remover" })) return;
    try {
      await panicService.remove(id);
      setPanicButtons((prev) => prev.filter((b) => b.id !== id));
      changeLogService.log("deleted", "panic_button", btn?.name);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const openSeasonalCreate = () => {
    setSeasonalEditing(null);
    setSeasonalForm(emptySeasonalForm());
    setSeasonalModal(true);
  };

  const openSeasonalEdit = (ov: SeasonalOverride) => {
    setSeasonalEditing(ov);
    setSeasonalForm({
      name: ov.name,
      replacement_folder_id: ov.replacement_folder_id,
      start_month: ov.start_month,
      start_day: ov.start_day,
      end_month: ov.end_month,
      end_day: ov.end_day,
      is_active: ov.is_active,
    });
    setSeasonalModal(true);
  };

  const handleSaveSeasonal = async () => {
    if (!seasonalForm.name || !seasonalForm.replacement_folder_id) return;
    setSavingSeasonal(true);
    try {
      if (seasonalEditing) {
        const updated = await seasonalService.update(seasonalEditing.id, seasonalForm);
        setSeasonalOverrides((prev) => prev.map((o) => o.id === updated.id ? updated : o));
      } else {
        const created = await seasonalService.create(seasonalForm);
        setSeasonalOverrides((prev) => [...prev, created]);
      }
      setSeasonalModal(false);
      toast.success(seasonalEditing ? "Período atualizado" : "Período criado");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    } finally {
      setSavingSeasonal(false);
    }
  };

  const handleDeleteSeasonal = async (id: number) => {
    if (!await confirm({ message: "Remover este período sazonal?", confirmLabel: "Remover" })) return;
    try {
      await seasonalService.remove(id);
      setSeasonalOverrides((prev) => prev.filter((o) => o.id !== id));
      toast.success("Período removido");
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const handleToggleSeasonal = async (id: number, isActive: boolean) => {
    try {
      const updated = await seasonalService.toggle(id, isActive);
      setSeasonalOverrides((prev) => prev.map((o) => o.id === updated.id ? updated : o));
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  const isSeasonalActiveToday = (ov: SeasonalOverride): boolean => {
    if (!ov.is_active) return false;
    const now = new Date();
    const month = now.getMonth() + 1;
    const day   = now.getDate();
    const cur   = month * 100 + day;
    const start = ov.start_month * 100 + ov.start_day;
    const end   = ov.end_month   * 100 + ov.end_day;
    return start <= end ? (cur >= start && cur <= end) : (cur >= start || cur <= end);
  };

  const MONTHS = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];

  const setSF = <K extends keyof SeasonalOverrideFormData>(k: K, v: SeasonalOverrideFormData[K]) =>
    setSeasonalForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 w-full space-y-5">
      {dialog}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie as preferências do sistema</p>
      </div>

      <div className="grid grid-cols-2 gap-5 items-start">

        {/* Coluna esquerda */}
        <div className="space-y-5">

          <Section icon={HardDrive} title="Armazenamento e Backup">
            <div className="space-y-1.5">
              <Label>Pasta de áudios</Label>
              <FolderInput
                value={settings.audio_storage_folder}
                placeholder="Padrão: pasta de dados do aplicativo"
                onChange={(v) => set("audio_storage_folder", v)}
                onPick={() => pickFolder("audio_storage_folder")}
                onClear={() => set("audio_storage_folder", "")}
              />
              <p className="text-xs text-slate-500">Reinicie o app para aplicar a nova pasta de áudio.</p>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-1.5">
              <Label>Pasta de destino do backup</Label>
              <FolderInput
                value={settings.backup_folder}
                placeholder="Selecione uma pasta..."
                onChange={(v) => set("backup_folder", v)}
                onPick={() => pickFolder("backup_folder")}
              />
            </div>

            <ToggleRow
              label="Backup automático"
              description="Salva cópias do banco de dados periodicamente"
              checked={settings.backup_auto_enabled}
              onCheckedChange={(v) => set("backup_auto_enabled", v)}
            />

            {settings.backup_auto_enabled && (
              <div className="space-y-1.5">
                <Label>Intervalo entre backups</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={1} max={168}
                    value={settings.backup_interval_hours}
                    onChange={(e) => set("backup_interval_hours", Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">horas</span>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleBackup} disabled={backing}>
              <HardDrive className="h-3.5 w-3.5 mr-1.5" />
              {backing ? "Fazendo backup..." : "Fazer backup agora"}
            </Button>
          </Section>

          <Section icon={Zap} title="Botões de Acionamento Manual">
            {panicButtons.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Zap className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum botão configurado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {panicButtons.map((btn) => (
                  <div key={btn.id} className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-white transition-colors">
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: btn.color_hex }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800">{btn.name}</p>
                      <p className="text-xs text-slate-500">
                        {btn.interrupt_mode === "interrupt" ? "Interrompe imediatamente" : "Pausa a fila"}
                      </p>
                    </div>
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => handleDeletePanic(btn.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm" variant="outline"
              onClick={() => { fetchFolders(); setPanicModal(true); }}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo botão de acionamento
            </Button>
          </Section>

          <Section icon={Snowflake} title="Músicas Sazonais">
            {seasonalOverrides.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Snowflake className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum período sazonal configurado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {seasonalOverrides.map((ov) => {
                  const folder = folders.find((f) => f.id === ov.replacement_folder_id);
                  const activeToday = isSeasonalActiveToday(ov);
                  return (
                    <div key={ov.id} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-white transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-slate-800">{ov.name}</p>
                          {activeToday && (
                            <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                              Ativo hoje
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {String(ov.start_day).padStart(2,"0")}/{String(ov.start_month).padStart(2,"0")}
                          {" → "}
                          {String(ov.end_day).padStart(2,"0")}/{String(ov.end_month).padStart(2,"0")}
                          {folder ? ` · ${folder.name}` : ""}
                        </p>
                      </div>
                      <Switch
                        checked={ov.is_active}
                        onCheckedChange={(v) => handleToggleSeasonal(ov.id, v)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0"
                        onClick={() => openSeasonalEdit(ov)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                        onClick={() => handleDeleteSeasonal(ov.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={openSeasonalCreate} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-1.5" />
              Novo período sazonal
            </Button>
          </Section>

        </div>

        {/* Coluna direita */}
        <div className="space-y-5">

          <Section icon={Monitor} title="Sistema">
            <ToggleRow
              label="Iniciar minimizado na bandeja"
              description="O app inicia sem abrir a janela principal"
              checked={settings.start_minimized}
              onCheckedChange={(v) => set("start_minimized", v)}
            />
            <div className="h-px bg-slate-100" />
            <ToggleRow
              label="Mini player ao minimizar"
              description="Exibe um card flutuante com o próximo sinal ou player ao minimizar a janela"
              checked={settings.mini_player_enabled}
              onCheckedChange={(v) => set("mini_player_enabled", v)}
            />
            <div className="h-px bg-slate-100" />
            <ToggleRow
              label="Iniciar com o Windows"
              description="O app é executado automaticamente ao ligar o computador"
              checked={settings.start_with_os}
              onCheckedChange={(v) => set("start_with_os", v)}
            />
            <div className="h-px bg-slate-100" />
            <ToggleRow
              label="Modo quiosque"
              description="Bloqueia a janela em tela cheia — só sai desativando aqui"
              checked={settings.kiosk_mode}
              onCheckedChange={(v) => set("kiosk_mode", v)}
            />
            {settings.kiosk_mode && (
              <ToggleRow
                label="Iniciar em modo quiosque"
                description="Aplica o modo quiosque automaticamente ao abrir o app"
                checked={settings.kiosk_start}
                onCheckedChange={(v) => set("kiosk_start", v)}
              />
            )}
            {settings.kiosk_mode !== savedKiosk && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                <p className="text-xs text-amber-700 font-medium">
                  Salve e recarregue o app para aplicar o modo quiosque.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0"
                  onClick={async () => { await handleSave(); await relaunch(); }}
                >
                  Salvar e reiniciar
                </Button>
              </div>
            )}
            <div className="h-px bg-slate-100" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Volume padrão dos sinais</p>
                  <p className="text-xs text-slate-500 mt-0.5">Aplica-se a todos os agendamentos</p>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-mono text-slate-600 w-10 text-right">
                    {Math.round(settings.default_volume * 100)}%
                  </span>
                </div>
              </div>
              <input
                type="range" min={0} max={100}
                value={Math.round(settings.default_volume * 100)}
                onChange={(e) => set("default_volume", Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-blue-600"
              />
            </div>
          </Section>

          <Section icon={Download} title="Importar / Exportar">
            <p className="text-sm text-slate-500">
              Exporte ou importe agendamentos, feriados e botões de acionamento em formato JSON.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleExport}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Exportar configuração
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleImport}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Importar configuração
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              A importação substitui todos os agendamentos e feriados existentes.
            </p>
          </Section>

          <Section icon={Wifi} title="Sincronização de Horário (NTP)">
            <div className="space-y-1.5">
              <Label>Servidor NTP</Label>
              <Input
                value={settings.ntp_server}
                onChange={(e) => set("ntp_server", e.target.value)}
                placeholder="a.ntp.br"
              />
              <p className="text-xs text-slate-500">
                Padrão: <code className="font-mono">a.ntp.br</code>. Outros: pool.ntp.org, time.windows.com
              </p>
            </div>

            <ToggleRow
              label="Sincronizar ao iniciar"
              description="Ajusta o relógio automaticamente toda vez que o app abre"
              checked={settings.ntp_auto_sync}
              onCheckedChange={(v) => set("ntp_auto_sync", v)}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </Button>
              {syncResult && (
                <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-2.5 py-1">
                  ✓ {syncResult.applied
                    ? `Ajustado ${syncResult.offset_s}s → ${syncResult.ntp_time}`
                    : `Correto (offset ${syncResult.offset_s}s)`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Requer execução como Administrador para ajustar o relógio do sistema.
            </p>
          </Section>

        </div>
      </div>

      {/* Save — full width */}
      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>

      {/* Panic Modal */}
      <Dialog open={panicModal} onOpenChange={setPanicModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Botão de Acionamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={panicName} onChange={(e) => setPanicName(e.target.value)} placeholder="Ex: Evacuação" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Pasta de Áudio</Label>
              <Select
                value={selectedFolderId?.toString() ?? ""}
                onValueChange={(v) => { selectFolder(Number(v)); fetchFiles(Number(v)); }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma pasta..." /></SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedFolderId && (
              <div className="space-y-1.5">
                <Label>Arquivo de Áudio</Label>
                <Select
                  value={panicFileId?.toString() ?? ""}
                  onValueChange={(v) => setPanicFileId(Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um arquivo..." /></SelectTrigger>
                  <SelectContent>
                    {(files[selectedFolderId] ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Modo de interrupção</Label>
              <Select value={panicMode} onValueChange={(v) => setPanicMode(v as InterruptMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interrupt">Interrompe imediatamente</SelectItem>
                  <SelectItem value="queue_pause">Pausa a fila e retoma depois</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cor do botão</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color" value={panicColor}
                  onChange={(e) => setPanicColor(e.target.value)}
                  className="h-10 w-16 p-1 cursor-pointer"
                />
                <div className="h-10 w-10 rounded-lg border shadow-sm" style={{ backgroundColor: panicColor }} />
                <span className="text-sm text-slate-500 font-mono">{panicColor}</span>
              </div>
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

      {/* Seasonal Modal */}
      <Dialog open={seasonalModal} onOpenChange={setSeasonalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{seasonalEditing ? "Editar período sazonal" : "Novo período sazonal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={seasonalForm.name}
                onChange={(e) => setSF("name", e.target.value)}
                placeholder="Ex: Natal"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pasta substituta</Label>
              <Select
                value={seasonalForm.replacement_folder_id ? seasonalForm.replacement_folder_id.toString() : ""}
                onValueChange={(v) => setSF("replacement_folder_id", Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma pasta..." /></SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de início</Label>
                <div className="flex gap-2">
                  <Select
                    value={seasonalForm.start_day.toString()}
                    onValueChange={(v) => setSF("start_day", Number(v))}
                  >
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={d.toString()}>{String(d).padStart(2,"0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={seasonalForm.start_month.toString()}
                    onValueChange={(v) => setSF("start_month", Number(v))}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Data de fim</Label>
                <div className="flex gap-2">
                  <Select
                    value={seasonalForm.end_day.toString()}
                    onValueChange={(v) => setSF("end_day", Number(v))}
                  >
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={d.toString()}>{String(d).padStart(2,"0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={seasonalForm.end_month.toString()}
                    onValueChange={(v) => setSF("end_month", Number(v))}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <ToggleRow
              label="Ativo"
              description="Período será considerado pelo scheduler quando ativo"
              checked={seasonalForm.is_active}
              onCheckedChange={(v) => setSF("is_active", v)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeasonalModal(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveSeasonal}
              disabled={savingSeasonal || !seasonalForm.name || !seasonalForm.replacement_folder_id}
            >
              {savingSeasonal ? "Salvando..." : seasonalEditing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
