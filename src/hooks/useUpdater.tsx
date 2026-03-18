import { useState, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    body: string | null | undefined;
    install: () => Promise<void>;
  } | null>(null);
  const [installing, setInstalling] = useState(false);

  const checkForUpdates = useCallback(async (silent = true) => {
    try {
      const update = await check();
      if (update?.available) {
        setUpdateInfo({
          version: update.version,
          body: update.body,
          install: async () => {
            await update.downloadAndInstall();
            await relaunch();
          },
        });
      } else if (!silent) {
        toast.success("O aplicativo está atualizado.");
      }
    } catch (e) {
      if (!silent) toast.error(`Erro ao verificar atualizações: ${e}`);
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

  const dialog = updateInfo ? (
    <Dialog open onOpenChange={(o) => !o && !installing && setUpdateInfo(null)}>
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
          <Button
            variant="outline"
            onClick={() => setUpdateInfo(null)}
            disabled={installing}
          >
            Agora não
          </Button>
          <Button onClick={handleInstall} disabled={installing}>
            {installing ? "Instalando..." : "Instalar e reiniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { checkForUpdates, dialog };
}
