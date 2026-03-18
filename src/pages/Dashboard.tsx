import { ClockCard } from "@/components/dashboard/ClockCard";
import { NextSignalCard } from "@/components/dashboard/NextSignalCard";
import { PlayerStatusCard } from "@/components/dashboard/PlayerStatusCard";
import { ManualSignalPanel } from "@/components/dashboard/ManualSignalPanel";

export function Dashboard() {
  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ClockCard />
        <NextSignalCard />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerStatusCard />
        <ManualSignalPanel />
      </div>
    </div>
  );
}
