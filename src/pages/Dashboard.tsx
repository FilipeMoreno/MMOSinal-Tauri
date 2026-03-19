import { ClockCard } from "@/components/dashboard/ClockCard";
import { NextSignalCard } from "@/components/dashboard/NextSignalCard";
import { PlayerStatusCard } from "@/components/dashboard/PlayerStatusCard";
import { ManualSignalPanel } from "@/components/dashboard/ManualSignalPanel";

export function Dashboard() {
  return (
    <div className="p-6 space-y-5 w-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Visão geral do sistema</p>
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
