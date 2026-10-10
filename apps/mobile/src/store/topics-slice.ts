import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_TOPICS, type Topic } from '@ground/core';

export const topicsAdapter = createEntityAdapter<Topic>();

interface SyncBookkeeping {
  dirtyIds: string[];
  pendingDeleteIds: string[];
}

const initialState = topicsAdapter.setAll(
  topicsAdapter.getInitialState<SyncBookkeeping>({ dirtyIds: DEFAULT_TOPICS.map((t) => t.id), pendingDeleteIds: [] }),
  DEFAULT_TOPICS,
);

const topicsSlice = createSlice({
  name: 'topics',
  initialState,
  reducers: {
    topicSaved(state, action: PayloadAction<Topic>) {
      topicsAdapter.upsertOne(state, { ...action.payload, updatedAt: new Date().toISOString() });
      if (!state.dirtyIds.includes(action.payload.id)) state.dirtyIds.push(action.payload.id);
    },
    topicDeleted(state, action: PayloadAction<string>) {
      topicsAdapter.removeOne(state, action.payload);
      state.dirtyIds = state.dirtyIds.filter((d) => d !== action.payload);
      state.pendingDeleteIds.push(action.payload);
    },
    remoteTopicsApplied(
      state,
      action: PayloadAction<{ upserted: Topic[]; deletedIds: string[]; pushedIds: string[]; pushedDeleteIds: string[] }>,
    ) {
      const { upserted, deletedIds, pushedIds, pushedDeleteIds } = action.payload;
      state.dirtyIds = state.dirtyIds.filter((d) => !pushedIds.includes(d));
      state.pendingDeleteIds = state.pendingDeleteIds.filter((d) => !pushedDeleteIds.includes(d));
      for (const remote of upserted) {
        if (state.dirtyIds.includes(remote.id) || state.pendingDeleteIds.includes(remote.id)) continue;
        topicsAdapter.upsertOne(state, remote);
      }
      topicsAdapter.removeMany(state, deletedIds);
    },
  },
});

export const { topicSaved, topicDeleted, remoteTopicsApplied } = topicsSlice.actions;
export default topicsSlice.reducer;
