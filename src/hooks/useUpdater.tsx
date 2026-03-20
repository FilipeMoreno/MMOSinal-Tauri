import { useState, useCallback, Fragment } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  const dialog = updateInfo && dialogOpen ? (
    <Dialog open onOpenChange={(o) => !o && !installing && setDialogOpen(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualização disponível — v{updateInfo.version}</DialogTitle>
        </DialogHeader>
        {updateInfo.body && (
          <DialogDescription asChild>
            <div className="max-h-64 overflow-y-auto pr-1 mt-1">
              <MarkdownText text={updateInfo.body} />
            </div>
          </DialogDescription>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={installing}>
            Agora não
          </Button>
          <Button onClick={handleInstall} disabled={installing}>
            {installing ? "Instalando..." : "Instalar e reiniciar"}
          </Button>
        </DialogFooter>
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
  };
}
