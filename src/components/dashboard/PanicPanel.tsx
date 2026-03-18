import { useEffect, useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { panicService } from "@/services/panicService";
import type { PanicButton } from "@/types";
import { toast } from "sonner";

export function PanicPanel() {
  const [buttons, setButtons] = useState<PanicButton[]>([]);

  useEffect(() => {
    panicService.list().then(setButtons).catch(console.error);
  }, []);

  const handleTrigger = async (btn: PanicButton) => {
    try {
      await panicService.trigger(btn.id);
      toast.success(`"${btn.name}" acionado!`);
    } catch (e) {
      toast.error(`Erro: ${e}`);
    }
  };

  if (buttons.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Acionadores Manuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            Nenhum botão configurado. Adicione em Configurações.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Acionadores Manuais
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleTrigger(btn)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-white transition-all active:scale-95 hover:opacity-90 shadow-md"
              style={{ backgroundColor: btn.color_hex }}
            >
              <Zap className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-sm">{btn.name}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
