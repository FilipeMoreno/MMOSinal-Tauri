import { useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
          {updateInfo.body && (
            <DialogDescription className="whitespace-pre-wrap text-sm mt-2">
              {updateInfo.body}
            </DialogDescription>
          )}
        </DialogHeader>
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
