import { describe, expect, it } from 'vitest';
import { documentFromExtraction, emptyExtraction, type GroundDocument } from '@ground/core';

import reducer, { documentDeleted, documentPatched, documentSaved, remoteDocumentsApplied } from '../src/store/documents-slice';

const make = (title: string, updatedAt = '2026-10-01T00:00:00.000Z'): GroundDocument => ({
  ...documentFromExtraction({ ...emptyExtraction(), title }, { source: 'manual', imageUri: 'file:///photo.jpg' }),
  updatedAt,
});

const init = reducer(undefined, { type: 'init' });
const noPush = { pushed: [], pushedDeleteIds: [] };

describe('documents slice', () => {
  it('marks saved and patched documents dirty', () => {
    const doc = make('A');
    let s = reducer(init, documentSaved(doc));
    expect(s.dirtyIds).toEqual([doc.id]);
    s = reducer(s, documentPatched({ id: doc.id, changes: { notes: 'hi' } }));
    expect(s.entities[doc.id]?.notes).toBe('hi');
    expect(s.dirtyIds).toEqual([doc.id]);
  });

  it('clears dirty flags for acknowledged pushes but keeps the local photo', () => {
    const doc = make('A');
    let s = reducer(init, documentSaved(doc));
    const local = s.entities[doc.id]!;
    s = reducer(
      s,
      remoteDocumentsApplied({ upserted: [{ ...local, imageUri: null }], deletedIds: [], pushed: [{ id: doc.id, updatedAt: local.updatedAt }], pushedDeleteIds: [] }),
    );
    expect(s.dirtyIds).toEqual([]);
    expect(s.entities[doc.id]?.imageUri).toBe('file:///photo.jpg');
  });

  it('keeps a document dirty when it was edited again during the sync', () => {
    const doc = make('A');
    let s = reducer(init, documentSaved(doc));
    const pushedAt = '2000-01-01T00:00:00.000Z'; // older than the local edit
    s = reducer(s, remoteDocumentsApplied({ upserted: [], deletedIds: [], pushed: [{ id: doc.id, updatedAt: pushedAt }], pushedDeleteIds: [] }));
    expect(s.dirtyIds).toEqual([doc.id]);
  });

  it('does not overwrite local unsynced edits with remote versions', () => {
    const doc = make('Local title');
    let s = reducer(init, documentSaved(doc));
    s = reducer(s, remoteDocumentsApplied({ upserted: [{ ...doc, title: 'Remote title', updatedAt: '2099-01-01T00:00:00.000Z' }], deletedIds: [], ...noPush }));
    expect(s.entities[doc.id]?.title).toBe('Local title');
  });

  it('applies remote documents and deletions from other devices', () => {
    const remote = make('From phone B');
    let s = reducer(init, remoteDocumentsApplied({ upserted: [remote], deletedIds: [], ...noPush }));
    expect(s.ids).toEqual([remote.id]);
    expect(s.entities[remote.id]?.imageUri).toBeNull();
    s = reducer(s, remoteDocumentsApplied({ upserted: [], deletedIds: [remote.id], ...noPush }));
    expect(s.ids).toEqual([]);
  });

  it('tracks local deletes until the server acknowledges them, and does not resurrect them', () => {
    const doc = make('A');
    let s = reducer(init, documentSaved(doc));
    s = reducer(s, documentDeleted(doc.id));
    expect(s.pendingDeleteIds).toEqual([doc.id]);
    expect(s.dirtyIds).toEqual([]);
    s = reducer(s, remoteDocumentsApplied({ upserted: [doc], deletedIds: [], ...noPush }));
    expect(s.ids).toEqual([]);
    s = reducer(s, remoteDocumentsApplied({ upserted: [], deletedIds: [doc.id], pushed: [], pushedDeleteIds: [doc.id] }));
    expect(s.pendingDeleteIds).toEqual([]);
  });
});
