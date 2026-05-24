import { create } from 'zustand';
import { clearToken, isConfigured, loadToken, signIn } from '../sync/google/auth';
import { fullSync, getLastSync, getSheetId, type SyncResult } from '../sync/sheetSync';
import { useAdminStore } from './adminStore';

interface SyncState {
  configured: boolean;
  connected: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastResult: SyncResult | null;
  lastError: string | null;
  sheetId: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  configured: isConfigured(),
  connected: !!loadToken(),
  syncing: false,
  lastSyncAt: getLastSync(),
  lastResult: null,
  lastError: null,
  sheetId: getSheetId(),

  connect: async () => {
    try {
      await signIn();
      set({ connected: true, lastError: null });
      await get().syncNow();
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : String(e) });
    }
  },

  disconnect: () => {
    clearToken();
    set({ connected: false, lastError: null });
  },

  syncNow: async () => {
    const admin = useAdminStore.getState();
    if (!admin.kitchen) { set({ lastError: 'No kitchen set up yet' }); return; }
    set({ syncing: true, lastError: null });
    try {
      const res = await fullSync(admin.kitchen.name);
      // Reload admin data after pull.
      useAdminStore.setState({ hydrated: false });
      await useAdminStore.getState().hydrate();
      set({ syncing: false, lastResult: res, lastSyncAt: getLastSync(), sheetId: getSheetId() });
    } catch (e) {
      set({ syncing: false, lastError: e instanceof Error ? e.message : String(e) });
    }
  }
}));
