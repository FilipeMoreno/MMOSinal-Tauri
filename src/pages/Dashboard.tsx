import { ClockCard } from "@/components/dashboard/ClockCard";
import { NextSignalCard } from "@/components/dashboard/NextSignalCard";
import { PlayerStatusCard } from "@/components/dashboard/PlayerStatusCard";
import { ManualSignalPanel } from "@/components/dashboard/ManualSignalPanel";
import { LayoutDashboard } from "lucide-react";

export function Dashboard() {
  return (
    <div className="p-6 space-y-6 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600/10 p-2.5 rounded-xl border border-indigo-500/10 shadow-sm">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-none">Dashboard</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Visão geral e controle do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ClockCard />
        <NextSignalCard />
      </div>

      <div className="grid grid-cols-2 gap-4 items-start">
        <PlayerStatusCard />
        <ManualSignalPanel />
      </div>
    </div>
  );
}
