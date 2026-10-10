import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DEFAULT_TOPICS, documentFromExtraction, emptyExtraction, type GroundDocument } from '@ground/core';
import { createApp } from '../src/app';
import { Store } from '../src/db';
import type { ExtractInput, Extractor } from '../src/extract';

function makeDoc(title: string, updatedAt = '2026-10-10T10:00:00.000Z'): GroundDocument {
  const doc = documentFromExtraction({ ...emptyExtraction(), title }, { source: 'manual', imageUri: 'file:///local.jpg' });
  return { ...doc, updatedAt };
}

describe('Ground API', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store(':memory:');
  });
  afterEach(() => store.close());

  it('reports health and whether AI is available', async () => {
    const res = await request(createApp({ store, extractor: null })).get('/api/health');
    expect(res.body).toEqual({ ok: true, ai: false, authRequired: false });
  });

  it('requires the token when configured', async () => {
    const app = createApp({ store, extractor: null, apiToken: 'secret' });
    expect((await request(app).get('/api/documents')).status).toBe(401);
    expect((await request(app).get('/api/documents').set('Authorization', 'Bearer secret')).status).toBe(200);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('stores documents, drops local image URIs, and applies last-write-wins', async () => {
    const app = createApp({ store, extractor: null });
    const doc = makeDoc('Example Cafe');
    const put = await request(app).put(`/api/documents/${doc.id}`).send(doc);
    expect(put.status).toBe(200);
    expect(put.body.imageUri).toBeNull();

    const stale = await request(app).put(`/api/documents/${doc.id}`).send({ ...doc, title: 'old', updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(stale.status).toBe(409);
    expect(stale.body.title).toBe('Example Cafe');

    const bad = await request(app).put(`/api/documents/x`).send({ title: 'missing fields' });
    expect(bad.status).toBe(400);
  });

  it('syncs incrementally with tombstones', async () => {
    const app = createApp({ store, extractor: null });
    const a = makeDoc('A');
    const b = makeDoc('B');

    const first = await request(app).post('/api/sync').send({ sinceSeq: 0, documents: [a, b], topics: DEFAULT_TOPICS });
    expect(first.status).toBe(200);
    expect(first.body.documents.upserted.map((d: GroundDocument) => d.title).sort()).toEqual(['A', 'B']);
    expect(first.body.topics.upserted).toHaveLength(DEFAULT_TOPICS.length);
    const cursor = first.body.seq;

    await request(app).delete(`/api/documents/${a.id}`).expect(204);
    const second = await request(app).post('/api/sync').send({ sinceSeq: cursor });
    expect(second.body.documents.upserted).toEqual([]);
    expect(second.body.documents.deletedIds).toEqual([a.id]);

    const nothingNew = await request(app).post('/api/sync').send({ sinceSeq: second.body.seq });
    expect(nothingNew.body.documents).toEqual({ upserted: [], deletedIds: [] });
  });

  it('returns 503 for extraction when no AI is configured', async () => {
    const res = await request(createApp({ store, extractor: null })).post('/api/extract').send({ text: 'hi' });
    expect(res.status).toBe(503);
  });

  it('passes extraction requests to the extractor', async () => {
    let received: ExtractInput | undefined;
    const extractor: Extractor = {
      async extract(input) {
        received = input;
        return { ...emptyExtraction(), title: 'Example Health Center', topicIds: ['health'] };
      },
    };
    const res = await request(createApp({ store, extractor }))
      .post('/api/extract')
      .send({ images: [{ data: 'aGVsbG8=', mediaType: 'image/jpeg' }], topics: DEFAULT_TOPICS, today: '2026-10-10' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Example Health Center');
    expect(received?.images).toHaveLength(1);
    expect(received?.topics[0]).toEqual({ id: 'food', name: 'Food', keywords: DEFAULT_TOPICS[0].keywords });
  });
});
