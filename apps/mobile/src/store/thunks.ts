import { createAsyncThunk } from '@reduxjs/toolkit';
import { documentFromExtraction, emptyExtraction, parseOffline, type GroundDocument } from '@ground/core';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { api, ApiError } from '@/api/client';
import { draftReady, extractionStarted, captureReset } from './capture-slice';
import { documentDeleted, documentSaved, remoteDocumentsApplied } from './documents-slice';
import { syncCompleted } from './settings-slice';
import { topicSelectors, todayIso } from './selectors';
import { remoteTopicsApplied } from './topics-slice';
import type { AppDispatch, RootState } from './index';

const createAppThunk = createAsyncThunk.withTypes<{ state: RootState; dispatch: AppDispatch }>();

/**
 * Turns the captured photos/text into a draft for review.
 * Uses the server's AI extraction when available, otherwise the on-device rule-based parser.
 */
export const extractCapture = createAppThunk('capture/extract', async (_, { getState, dispatch }) => {
  dispatch(extractionStarted());
  const { capture, settings } = getState();
  const topics = topicSelectors.selectAll(getState());
  const offline = () => parseOffline(capture.text, { topics, dateOrder: settings.dateOrder });

  const images = capture.pages.filter((p) => p.base64).map((p) => ({ data: p.base64!, mediaType: p.mediaType }));
  const canUseAi = settings.useAi && settings.serverUrl.trim() !== '' && (images.length > 0 || capture.text.trim() !== '');

  if (canUseAi) {
    try {
      const draft = await api.extract(settings, {
        images,
        text: capture.text || undefined,
        topics: topics.map(({ id, name, keywords }) => ({ id, name, keywords })),
        today: todayIso(),
        locale: settings.locale,
      });
      dispatch(draftReady({ draft, source: 'ai' }));
      return;
    } catch (e) {
      const reason =
        e instanceof ApiError && e.status === 503
          ? 'the server has no AI key configured'
          : e instanceof ApiError
            ? e.message
            : 'unexpected error';
      const draft = capture.text.trim() ? offline() : emptyExtraction();
      dispatch(
        draftReady({
          draft,
          source: capture.text.trim() ? 'offline' : 'manual',
          notice: `AI reading unavailable (${reason}) — ${capture.text.trim() ? 'used the offline parser instead' : 'fill in the details by hand'}.`,
        }),
      );
      return;
    }
  }

  if (capture.text.trim()) {
    dispatch(draftReady({ draft: offline(), source: 'offline' }));
  } else {
    dispatch(
      draftReady({
        draft: emptyExtraction(),
        source: 'manual',
        notice: images.length
          ? 'No server configured for AI reading. Type the important details, or add the text on the capture screen to use the offline parser.'
          : null,
      }),
    );
  }
});

/**
 * Copies a photo out of the picker's cache (which the OS may clear) into app storage.
 * In a browser photos are not kept: they would quickly fill the ~5 MB storage quota.
 */
function keepPhoto(uri: string, docId: string): string | null {
  if (Platform.OS === 'web') return null;
  try {
    const dir = new Directory(Paths.document, 'papers');
    dir.create({ idempotent: true, intermediates: true });
    const dest = new File(dir, `${docId}.jpg`);
    new File(uri).copySync(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export const saveCapturedDraft = createAppThunk('capture/save', async (_, { getState, dispatch }): Promise<GroundDocument | null> => {
  const { capture } = getState();
  if (!capture.draft) return null;
  const doc = documentFromExtraction(capture.draft, { source: capture.draftSource });
  const firstPhoto = capture.pages[0]?.uri;
  const saved: GroundDocument = { ...doc, imageUri: firstPhoto ? keepPhoto(firstPhoto, doc.id) : null };
  dispatch(documentSaved(saved));
  dispatch(captureReset());
  void dispatch(syncNow());
  return saved;
});

let syncInFlight = false;

/** Pushes local changes and pulls remote ones. A no-op when no server is configured or a sync is running. */
export const syncNow = createAppThunk(
  'sync/now',
  async (_, { getState, dispatch }) => {
    syncInFlight = true;
    try {
      await runSync(getState, dispatch);
    } finally {
      syncInFlight = false;
    }
  },
  { condition: (_, { getState }) => !syncInFlight && getState().settings.serverUrl.trim() !== '' },
);

async function runSync(getState: () => RootState, dispatch: AppDispatch) {
    const state = getState();
    const { settings } = state;
    const pushedDocs = state.documents.dirtyIds.map((id) => state.documents.entities[id]).filter(Boolean);
    const pushedTopics = state.topics.dirtyIds.map((id) => state.topics.entities[id]).filter(Boolean);
    const pushedDocDeletes = [...state.documents.pendingDeleteIds];
    const pushedTopicDeletes = [...state.topics.pendingDeleteIds];

    const res = await api.sync(settings, {
      sinceSeq: settings.lastSyncSeq,
      documents: pushedDocs,
      deletedDocumentIds: pushedDocDeletes,
      topics: pushedTopics,
      deletedTopicIds: pushedTopicDeletes,
    });

    dispatch(
      remoteDocumentsApplied({
        upserted: res.documents.upserted,
        deletedIds: res.documents.deletedIds,
        pushed: pushedDocs.map((d) => ({ id: d.id, updatedAt: d.updatedAt })),
        pushedDeleteIds: pushedDocDeletes,
      }),
    );
    dispatch(
      remoteTopicsApplied({
        upserted: res.topics.upserted,
        deletedIds: res.topics.deletedIds,
        pushedIds: pushedTopics.map((t) => t.id),
        pushedDeleteIds: pushedTopicDeletes,
      }),
    );
    dispatch(syncCompleted({ seq: res.seq, at: new Date().toISOString() }));
}

export const deleteDocument = createAppThunk('documents/delete', async (id: string, { getState, dispatch }) => {
  const uri = getState().documents.entities[id]?.imageUri;
  dispatch(documentDeleted(id));
  if (uri && Platform.OS !== 'web' && uri.includes('/papers/')) {
    try {
      new File(uri).delete();
    } catch {
      // Already gone.
    }
  }
  void dispatch(syncNow());
});
