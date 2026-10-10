import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DateOrder } from '@ground/core';
import { DEFAULT_CLAUDE_MODEL } from '@ground/core/claude';

export interface SettingsState {
  /** Base URL of the Ground server, e.g. "http://192.168.1.20:4000". Empty = offline only. */
  serverUrl: string;
  apiToken: string;
  /** Send photos to the server for AI extraction when a server is configured. */
  useAi: boolean;
  /**
   * The user's own Anthropic API key, kept only on this device. Lets the app read photos with
   * Claude directly, without running a Ground server.
   */
  anthropicApiKey: string;
  claudeModel: string;
  dateOrder: DateOrder;
  /** Language for AI-written titles and summaries. */
  locale: string;
  lastSyncSeq: number;
  lastSyncAt: string | null;
}

/**
 * When the web app is served by the Ground server itself (see render.yaml), the server is
 * at the same address as the page, so it can be filled in automatically.
 */
const sameOriginServer =
  process.env.EXPO_PUBLIC_SAME_ORIGIN === '1' && typeof window !== 'undefined' ? window.location.origin : '';

const initialState: SettingsState = {
  serverUrl: sameOriginServer,
  apiToken: '',
  useAi: true,
  anthropicApiKey: '',
  claudeModel: DEFAULT_CLAUDE_MODEL,
  dateOrder: 'MDY',
  locale: 'en',
  lastSyncSeq: 0,
  lastSyncAt: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    settingsChanged(state, action: PayloadAction<Partial<Omit<SettingsState, 'lastSyncSeq' | 'lastSyncAt'>>>) {
      const serverChanged = action.payload.serverUrl !== undefined && action.payload.serverUrl !== state.serverUrl;
      Object.assign(state, action.payload);
      // A different server has a different history: start over from scratch.
      if (serverChanged) {
        state.lastSyncSeq = 0;
        state.lastSyncAt = null;
      }
    },
    syncCompleted(state, action: PayloadAction<{ seq: number; at: string }>) {
      state.lastSyncSeq = action.payload.seq;
      state.lastSyncAt = action.payload.at;
    },
  },
});

export const { settingsChanged, syncCompleted } = settingsSlice.actions;
export default settingsSlice.reducer;
