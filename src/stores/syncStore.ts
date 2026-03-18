import { create } from "zustand";

interface SyncStore {
  synced: boolean;
  offsetS: number | null;
  setSynced: (synced: boolean, offsetS?: number | null) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  synced: false,
  offsetS: null,
  setSynced: (synced, offsetS = null) => set({ synced, offsetS }),
}));
