import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GroundDocument } from '@ground/core';

export const documentsAdapter = createEntityAdapter<GroundDocument>({
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

interface SyncBookkeeping {
  /** Ids changed locally since the last successful sync. */
  dirtyIds: string[];
  /** Ids deleted locally that the server doesn't know about yet. */
  pendingDeleteIds: string[];
}

const initialState = documentsAdapter.getInitialState<SyncBookkeeping>({ dirtyIds: [], pendingDeleteIds: [] });

const markDirty = (state: SyncBookkeeping, id: string) => {
  if (!state.dirtyIds.includes(id)) state.dirtyIds.push(id);
};

export interface RemoteDocumentChanges {
  upserted: GroundDocument[];
  deletedIds: string[];
  /** The versions this client pushed in the same sync, used to clear dirty flags. */
  pushed: { id: string; updatedAt: string }[];
  pushedDeleteIds: string[];
}

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    documentSaved(state, action: PayloadAction<GroundDocument>) {
      documentsAdapter.upsertOne(state, { ...action.payload, updatedAt: new Date().toISOString() });
      markDirty(state, action.payload.id);
    },
    documentPatched(state, action: PayloadAction<{ id: string; changes: Partial<Omit<GroundDocument, 'id'>> }>) {
      const { id, changes } = action.payload;
      if (!state.entities[id]) return;
      documentsAdapter.updateOne(state, { id, changes: { ...changes, updatedAt: new Date().toISOString() } });
      markDirty(state, id);
    },
    documentDeleted(state, action: PayloadAction<string>) {
      const id = action.payload;
      documentsAdapter.removeOne(state, id);
      state.dirtyIds = state.dirtyIds.filter((d) => d !== id);
      if (!state.pendingDeleteIds.includes(id)) state.pendingDeleteIds.push(id);
    },
    remoteDocumentsApplied(state, action: PayloadAction<RemoteDocumentChanges>) {
      const { upserted, deletedIds, pushed, pushedDeleteIds } = action.payload;
      // A pushed document stays dirty if it was edited again while the sync was in flight.
      for (const p of pushed) {
        const local = state.entities[p.id];
        if (!local || local.updatedAt <= p.updatedAt) state.dirtyIds = state.dirtyIds.filter((d) => d !== p.id);
      }
      state.pendingDeleteIds = state.pendingDeleteIds.filter((d) => !pushedDeleteIds.includes(d));

      for (const remote of upserted) {
        if (state.pendingDeleteIds.includes(remote.id)) continue;
        const local = state.entities[remote.id];
        if (local && (state.dirtyIds.includes(remote.id) || local.updatedAt > remote.updatedAt)) continue;
        // Photos live only on the device that took them.
        documentsAdapter.upsertOne(state, { ...remote, imageUri: local?.imageUri ?? null });
      }
      documentsAdapter.removeMany(
        state,
        deletedIds.filter((id) => !state.dirtyIds.includes(id)),
      );
    },
  },
});

export const { documentSaved, documentPatched, documentDeleted, remoteDocumentsApplied } = documentsSlice.actions;
export default documentsSlice.reducer;
