import { create } from "zustand";

interface UiStore {
  /** Incremented each time the user triggers the manual signal shortcut */
  manualSignalTrigger: number;
  triggerManualSignal: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  manualSignalTrigger: 0,
  triggerManualSignal: () =>
    set({ manualSignalTrigger: get().manualSignalTrigger + 1 }),
}));
