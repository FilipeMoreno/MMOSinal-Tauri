import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CHANGELOG, GROUP_COLORS } from "@/lib/changelog";

interface WhatsNewDialogProps {
  version: string;
  onClose: () => void;
}

export function WhatsNewDialog({ version, onClose }: WhatsNewDialogProps) {
  const section = CHANGELOG.find((s) => s.version === version);
  const visibleGroups = (section?.groups ?? []).filter(
    (g) => !g.label.toLowerCase().startsWith("técnico")
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md border border-white/25 shadow-inner">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white mb-0.5">
                App atualizado!
              </DialogTitle>
              <p className="text-blue-100 text-sm font-medium">Versão {version} instalada com sucesso</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 bg-white flex flex-col gap-4">
          {visibleGroups.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">O que há de novo:</span>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 max-h-64 overflow-y-auto space-y-3">
                {visibleGroups.map((group) => {
                  const colorClass = GROUP_COLORS[group.label] ?? "text-slate-700 bg-slate-50 border-slate-200";
                  return (
                    <div key={group.label}>
                      <span className={cn("inline-block text-xs font-semibold px-2 py-0.5 rounded border mb-1.5", colorClass)}>
                        {group.label}
                      </span>
                      <ul className="space-y-1">
                        {group.items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-xs text-slate-600">
                            <span className="text-slate-300 flex-shrink-0 mt-0.5">–</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Veja o histórico completo na página Sobre.</p>
          )}

          <Button
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
