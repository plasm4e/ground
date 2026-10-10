import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { newId, type Extraction, type ExtractionSource } from '@ground/core';

export interface CapturedPage {
  uri: string;
  /** Kept in memory only, for sending to the server. */
  base64: string | null;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** The in-progress capture: photos taken, optional typed text, and the extracted draft under review. Not persisted. */
export interface CaptureState {
  pages: CapturedPage[];
  text: string;
  status: 'idle' | 'extracting' | 'ready';
  /** 0..1 while on-device text recognition runs, otherwise null. */
  ocrProgress: number | null;
  /** Shown on the review screen, e.g. why the AI path was skipped. */
  notice: string | null;
  draft: Extraction | null;
  draftSource: ExtractionSource;
}

const initialState: CaptureState = {
  pages: [],
  text: '',
  status: 'idle',
  ocrProgress: null,
  notice: null,
  draft: null,
  draftSource: 'manual',
};

const captureSlice = createSlice({
  name: 'capture',
  initialState,
  reducers: {
    pageAdded(state, action: PayloadAction<CapturedPage>) {
      state.pages.push(action.payload);
    },
    pageRemoved(state, action: PayloadAction<number>) {
      state.pages.splice(action.payload, 1);
    },
    textChanged(state, action: PayloadAction<string>) {
      state.text = action.payload;
    },
    extractionStarted(state) {
      state.status = 'extracting';
      state.ocrProgress = null;
      state.notice = null;
    },
    ocrProgressed(state, action: PayloadAction<number>) {
      state.ocrProgress = action.payload;
    },
    draftReady(state, action: PayloadAction<{ draft: Extraction; source: ExtractionSource; notice?: string | null }>) {
      state.status = 'ready';
      state.ocrProgress = null;
      const d = action.payload.draft;
      // Temporary ids keep editor list keys stable; they are replaced when the document is saved.
      const keyed = <T extends object>(items: T[]) => items.map((i) => Object.assign({}, i, { id: newId() }));
      state.draft = { ...d, places: keyed(d.places), contacts: keyed(d.contacts), appointments: keyed(d.appointments) };
      state.draftSource = action.payload.source;
      state.notice = action.payload.notice ?? null;
    },
    draftEdited(state, action: PayloadAction<Extraction>) {
      state.draft = action.payload;
    },
    captureReset() {
      return initialState;
    },
  },
});

export const { pageAdded, pageRemoved, textChanged, extractionStarted, ocrProgressed, draftReady, draftEdited, captureReset } =
  captureSlice.actions;
export default captureSlice.reducer;
