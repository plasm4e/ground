import { createAsyncThunk } from '@reduxjs/toolkit';
import { documentFromExtraction, emptyExtraction, parseOffline, type GroundDocument } from '@ground/core';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { api, ApiError } from '@/api/client';
import { ocrAvailable, recognizeText } from '@/lib/ocr';
import { captureReset, draftReady, extractionStarted, ocrProgressed } from './capture-slice';
import { documentDeleted, documentSaved, remoteDocumentsApplied } from './documents-slice';
import { syncCompleted } from './settings-slice';
import { topicSelectors, todayIso } from './selectors';
import { remoteTopicsApplied } from './topics-slice';
import type { AppDispatch, RootState } from './index';

const createAppThunk = createAsyncThunk.withTypes<{ state: RootState; dispatch: AppDispatch }>();

/**
 * Turns the captured photos/text into a draft for review, using the best reader available:
 * 1. AI extraction on the Ground server (when configured),
 * 2. otherwise free on-device text recognition of the photos (web), followed by
 * 3. the rule-based parser, which also handles typed text.
 */
export const extractCapture = createAppThunk('capture/extract', async (_, { getState, dispatch }) => {
  dispatch(extractionStarted());
  const { capture, settings } = getState();
  const topics = topicSelectors.selectAll(getState());
  const typed = capture.text.trim();

  const images = capture.pages.filter((p) => p.base64).map((p) => ({ data: p.base64!, mediaType: p.mediaType }));
  const canUseAi = settings.useAi && settings.serverUrl.trim() !== '' && (images.length > 0 || typed !== '');

  let aiProblem: string | null = null;
  if (canUseAi) {
    try {
      const draft = await api.extract(settings, {
        images,
        text: typed || undefined,
        topics: topics.map(({ id, name, keywords }) => ({ id, name, keywords })),
        today: todayIso(),
        locale: settings.locale,
      });
      dispatch(draftReady({ draft, source: 'ai' }));
      return;
    } catch (e) {
      aiProblem =
        e instanceof ApiError && e.status === 503
          ? 'the server has no AI key configured'
          : e instanceof ApiError
            ? e.message
            : 'unexpected error';
    }
  }

  let recognized = '';
  let ocrProblem: string | null = null;
  if (capture.pages.length && ocrAvailable) {
    try {
      recognized = await recognizeText(
        capture.pages.map((p) => p.uri),
        settings.locale,
        (fraction) => dispatch(ocrProgressed(fraction)),
      );
    } catch (e) {
      ocrProblem = e instanceof Error ? e.message : 'unknown error';
    }
  }

  const text = [typed, recognized].filter(Boolean).join('\n\n');
  const notes = [
    aiProblem && `AI reading unavailable (${aiProblem}).`,
    recognized && 'Text was read from the photo on this phone: check names, numbers and dates carefully.',
    ocrProblem && `Could not read the photo (${ocrProblem}).`,
    !text && capture.pages.length > 0 && 'No text found: fill in the important details by hand.',
  ].filter(Boolean);

  dispatch(
    draftReady({
      draft: text ? parseOffline(text, { topics, dateOrder: settings.dateOrder }) : emptyExtraction(),
      source: text ? 'offline' : 'manual',
      notice: notes.length ? notes.join(' ') : null,
    }),
  );
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
