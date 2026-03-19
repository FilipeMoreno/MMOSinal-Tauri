import { useState } from "react";
import { Bell, ArrowRight, FolderOpen, Download, Volume2, Monitor, CheckCircle2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  enable as enableAutostart,
  disable as disableAutostart,
} from "@tauri-apps/plugin-autostart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { settingsService } from "@/services/backupService";
import { configService } from "@/services/configService";
import { toast } from "sonner";

type Step = "welcome" | "restore_ask" | "restore_do" | "setup" | "done";

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [volume, setVolume] = useState(80);
  const [startWithOs, setStartWithOs] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [ntpServer, setNtpServer] = useState("a.ntp.br");
  const [completing, setCompleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImportBackup = async () => {
    const path = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!path || typeof path !== "string") return;
    setImporting(true);
    try {
      const result = await configService.importConfig(path);
      toast.success(
        `Restaurado: ${result.schedules_imported} agendamentos, ${result.holidays_imported} feriados, ${result.panic_buttons_imported} botões`
      );
      setStep("done");
    } catch (e) {
      toast.error(`Erro ao importar: ${e}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFinish = async () => {
    setCompleting(true);
    try {
      const current = await settingsService.get();
      await settingsService.save({
        ...current,
        default_volume: volume / 100,
        start_with_os: startWithOs,
        start_minimized: startMinimized,
        ntp_server: ntpServer,
        setup_complete: true,
      });
      try {
        startWithOs ? await enableAutostart() : await disableAutostart();
      } catch { /* non-critical */ }
      setStep("done");
    } catch (e) {
      toast.error(`Erro ao salvar: ${e}`);
    } finally {
      setCompleting(false);
    }
  };

  const handleDone = async () => {
    // If we went through restore_do and skipped setup, still mark complete
    try {
      const current = await settingsService.get();
      if (!current.setup_complete) {
        await settingsService.save({ ...current, setup_complete: true });
      }
    } catch { /* ignore */ }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-1">
          {(["welcome", "restore_ask", step === "restore_do" ? "restore_do" : "setup", "done"] as Step[]).map((s, i) => {
            const steps: Step[] = ["welcome", "restore_ask", step === "restore_do" ? "restore_do" : "setup", "done"];
            const current = steps.indexOf(step);
            return (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-6 bg-blue-600" : i < current ? "w-1.5 bg-blue-300" : "w-1.5 bg-slate-200"
                }`}
              />
            );
          })}
        </div>

        {/* Step: Welcome */}
        {step === "welcome" && (
          <div className="px-8 py-8 text-center space-y-6">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Bell className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Bem-vindo ao MMO Sinal</h1>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                Gerenciador de sirenes e sinais sonoros para ambientes escolares e corporativos.
                Vamos configurar o app em alguns passos.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={() => setStep("restore_ask")}>
              Começar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step: Ask about restore */}
        {step === "restore_ask" && (
          <div className="px-8 py-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tem um backup para restaurar?</h2>
              <p className="text-slate-500 mt-1.5 text-sm">
                Se você exportou uma configuração anteriormente, pode restaurá-la agora.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                size="lg" className="w-full"
                variant="outline"
                onClick={() => setStep("restore_do")}
              >
                <Download className="h-4 w-4 mr-2" />
                Sim, quero restaurar um backup
              </Button>
              <Button
                size="lg" className="w-full"
                onClick={() => setStep("setup")}
              >
                Não, configurar do zero
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Restore backup */}
        {step === "restore_do" && (
          <div className="px-8 py-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Restaurar configuração</h2>
              <p className="text-slate-500 mt-1.5 text-sm">
                Selecione o arquivo JSON exportado anteriormente. Os agendamentos, feriados e botões serão restaurados.
              </p>
            </div>
            <Button
              size="lg" className="w-full"
              onClick={handleImportBackup}
              disabled={importing}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {importing ? "Importando..." : "Selecionar arquivo de backup"}
            </Button>
            <button
              className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setStep("restore_ask")}
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* Step: Basic setup */}
        {step === "setup" && (
          <div className="px-8 py-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configuração inicial</h2>
              <p className="text-slate-500 mt-1.5 text-sm">Você pode ajustar tudo isso depois nas Configurações.</p>
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                  Volume padrão dos sinais
                </Label>
                <span className="text-sm font-mono text-slate-600">{volume}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-blue-600"
              />
            </div>

            <div className="h-px bg-slate-100" />

            {/* Start with OS */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-slate-500" />
                  Iniciar com o Windows
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Iniciar automaticamente ao ligar o PC</p>
              </div>
              <Switch checked={startWithOs} onCheckedChange={setStartWithOs} />
            </div>

            {/* Start minimized */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Iniciar minimizado</p>
                <p className="text-xs text-slate-500 mt-0.5">Inicia na bandeja sem abrir a janela</p>
              </div>
              <Switch checked={startMinimized} onCheckedChange={setStartMinimized} />
            </div>

            <div className="h-px bg-slate-100" />

            {/* NTP */}
            <div className="space-y-1.5">
              <Label>Servidor NTP</Label>
              <Input
                value={ntpServer}
                onChange={(e) => setNtpServer(e.target.value)}
                placeholder="a.ntp.br"
              />
              <p className="text-xs text-slate-400">Para sincronização precisa do horário dos sinais</p>
            </div>

            <Button size="lg" className="w-full" onClick={handleFinish} disabled={completing}>
              {completing ? "Salvando..." : "Concluir configuração"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="px-8 py-8 text-center space-y-6">
            <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Tudo pronto!</h2>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                O MMO Sinal está configurado e pronto para uso. Crie seus agendamentos no menu lateral.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={handleDone}>
              Ir para o Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
