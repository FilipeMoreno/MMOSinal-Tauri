import { useState, useCallback, Fragment } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Rocket, Sparkles, Download } from "lucide-react";

/** Renders a subset of markdown: ###/##/# headers, - bullets, **bold**, `code` */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key} className="list-disc list-inside space-y-0.5 mb-1">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="text-sm text-slate-600">{renderInline(item)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  lines.forEach((line, i) => {
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      flushBullets(`bl-${i}`);
      const level = heading[1].length;
      const cls = level === 1
        ? "text-base font-bold text-slate-800 mt-3 mb-1"
        : level === 2
        ? "text-sm font-bold text-slate-700 mt-2 mb-0.5"
        : "text-xs font-semibold text-slate-600 uppercase tracking-wide mt-2 mb-0.5";
      elements.push(<p key={i} className={cls}>{heading[2]}</p>);
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      bulletBuffer.push(bullet[1]);
      return;
    }

    flushBullets(`bl-${i}`);

    if (line.trim() === "" || line.trim() === "---") {
      if (elements.length > 0) elements.push(<div key={i} className="h-1" />);
      return;
    }

    elements.push(<p key={i} className="text-sm text-slate-600">{renderInline(line)}</p>);
  });

  flushBullets("bl-end");

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono text-slate-700">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

interface UpdateInfo {
  version: string;
  body: string | null | undefined;
  install: () => Promise<void>;
}

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  const checkForUpdates = useCallback(async (silent = true) => {
    setChecking(true);
    try {
      const update = await check();
      setChecked(true);
      if (update?.available) {
        setUpdateInfo({
          version: update.version,
          body: update.body,
          install: async () => {
            await update.downloadAndInstall();
            await relaunch();
          },
        });
        setDialogOpen(true);
      } else if (!silent) {
        toast.success("O aplicativo está atualizado.");
      }
    } catch (e) {
      const msg = String(e).toLowerCase();
      const isUnavailable =
        msg.includes("could not fetch") ||
        msg.includes("no release") ||
        msg.includes("404") ||
        msg.includes("network") ||
        msg.includes("failed to fetch");
      if (!silent) {
        if (isUnavailable) {
          toast.info("Não foi possível verificar atualizações. Verifique sua conexão ou tente mais tarde.");
        } else {
          toast.error(`Erro ao verificar atualizações: ${e}`);
        }
      }
    } finally {
      setChecking(false);
    }
  }, []);

  const handleInstall = async () => {
    if (!updateInfo) return;
    setInstalling(true);
    try {
      await updateInfo.install();
    } catch (e) {
      toast.error(`Erro ao instalar atualização: ${e}`);
      setInstalling(false);
    }
  };

  /** Verifica e instala silenciosamente, sem abrir dialog. Usado quando auto_update está ativo. */
  const checkAndAutoInstall = useCallback(async () => {
    try {
      const update = await check();
      setChecked(true);
      if (!update?.available) return;
      const toastId = toast.loading(`Atualização v${update.version} encontrada — instalando...`);
      setInstalling(true);
      await update.downloadAndInstall();
      toast.success(`v${update.version} instalada! Reiniciando...`, { id: toastId });
      await relaunch();
    } catch {
      // silencioso — falhas de rede na inicialização não devem incomodar o usuário
    }
  }, []);

  const dialog = updateInfo && dialogOpen ? (
    <Dialog open onOpenChange={(o) => !o && !installing && setDialogOpen(false)}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md border border-white/25 shadow-inner">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white mb-0.5 border-none">Nova Atualização!</DialogTitle>
              <p className="text-blue-100 text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Versão {updateInfo.version} disponível
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white flex flex-col gap-4">
          {updateInfo.body && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">O que há de novo:</span>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 max-h-56 overflow-y-auto custom-scrollbar shadow-inner text-sm">
                <MarkdownText text={updateInfo.body} />
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-2 sm:justify-between flex-row-reverse w-full gap-2">
            <Button 
              onClick={handleInstall} 
              disabled={installing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all gap-2 flex-grow sm:flex-grow-0"
            >
              {installing ? (
                <>
                  <Download className="h-4 w-4 animate-bounce" /> Instalando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Instalar e reiniciar
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-medium"
              onClick={() => setDialogOpen(false)} 
              disabled={installing}
            >
              Lembrar depois
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  return {
    checkForUpdates,
    dialog,
    checking,
    checked,
    hasUpdate: !!updateInfo,
    updateVersion: updateInfo?.version ?? null,
    installUpdate: handleInstall,
    installing,
    // Abre o dialog novamente sem re-checar
    dismissUpdate: () => setDialogOpen(false),
    showUpdateDialog: () => setDialogOpen(true),
    checkAndAutoInstall,
  };
}
