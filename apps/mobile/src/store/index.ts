import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';

import capture from './capture-slice';
import documents from './documents-slice';
import settings from './settings-slice';
import topics from './topics-slice';

const rootReducer = combineReducers({ documents, topics, settings, capture });

const persistedReducer = persistReducer<RootState>(
  {
    key: 'ground',
    version: 1,
    storage: AsyncStorage,
    // The capture in progress holds base64 photos; keep it out of storage.
    whitelist: ['documents', 'topics', 'settings'],
    // Merge saved slices into the defaults, so settings added in later versions get their default values.
    stateReconciler: autoMergeLevel2,
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      // Captured photos are large strings; skip the dev-only deep checks on that slice.
      immutableCheck: { ignoredPaths: ['capture'] },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
