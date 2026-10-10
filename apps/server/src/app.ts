import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { GroundDocumentSchema, TopicSchema } from '@ground/core';
import type { Store } from './db';
import { ExtractionError, type Extractor } from './extract';

export interface AppOptions {
  store: Store;
  /** null when no AI provider is configured. */
  extractor: Extractor | null;
  /** When set, required as a Bearer token on every /api route except /api/health. */
  apiToken?: string;
  /** Folder with the exported web app (`npm run build:web`). Served at `/` when present. */
  webDir?: string;
}

const SyncRequestSchema = z.object({
  sinceSeq: z.number().int().min(0).default(0),
  documents: z.array(GroundDocumentSchema).default([]),
  deletedDocumentIds: z.array(z.string()).default([]),
  topics: z.array(TopicSchema).default([]),
  deletedTopicIds: z.array(z.string()).default([]),
});

const ExtractRequestSchema = z.object({
  images: z
    .array(
      z.object({
        data: z.string().min(1),
        mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
      }),
    )
    .max(10)
    .default([]),
  text: z.string().optional(),
  topics: z.array(TopicSchema.pick({ id: true, name: true, keywords: true })).default([]),
  today: z.string().default(() => new Date().toISOString().slice(0, 10)),
  locale: z.string().optional(),
});

/** Wraps async handlers so thrown errors reach the error middleware. */
const route =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

export function createApp({ store, extractor, apiToken, webDir }: AppOptions) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '40mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ai: extractor !== null, authRequired: Boolean(apiToken) });
  });

  if (apiToken) {
    app.use('/api', (req, res, next) => {
      if (req.headers.authorization === `Bearer ${apiToken}`) return next();
      res.status(401).json({ error: 'Missing or invalid API token.' });
    });
  }

  // --- Documents -----------------------------------------------------------

  app.get('/api/documents', (req, res) => {
    const sinceSeq = Number(req.query.sinceSeq ?? 0) || 0;
    res.json({ ...store.documentChanges(sinceSeq), seq: store.currentSeq() });
  });

  app.get('/api/documents/:id', (req, res) => {
    const doc = store.getDocument(req.params.id);
    if (!doc) return void res.status(404).json({ error: 'Not found.' });
    res.json(doc);
  });

  app.put('/api/documents/:id', (req, res) => {
    const doc = GroundDocumentSchema.parse({ ...req.body, id: req.params.id });
    const applied = store.putDocument(doc);
    res.status(applied ? 200 : 409).json(store.getDocument(doc.id));
  });

  app.delete('/api/documents/:id', (req, res) => {
    res.status(store.deleteDocument(req.params.id) ? 204 : 404).end();
  });

  // --- Topics --------------------------------------------------------------

  app.get('/api/topics', (req, res) => {
    const sinceSeq = Number(req.query.sinceSeq ?? 0) || 0;
    res.json({ ...store.topicChanges(sinceSeq), seq: store.currentSeq() });
  });

  app.put('/api/topics/:id', (req, res) => {
    const topic = TopicSchema.parse({ ...req.body, id: req.params.id });
    store.putTopic(topic);
    res.json(topic);
  });

  app.delete('/api/topics/:id', (req, res) => {
    res.status(store.deleteTopic(req.params.id) ? 204 : 404).end();
  });

  // --- Sync ----------------------------------------------------------------

  /**
   * One round trip: the client pushes everything that changed locally since its last
   * sync, and receives everything that changed on the server after `sinceSeq`
   * (including its own pushes, which it can treat as acknowledgements).
   */
  app.post('/api/sync', (req, res) => {
    const body = SyncRequestSchema.parse(req.body);
    for (const doc of body.documents) store.putDocument(doc);
    for (const id of body.deletedDocumentIds) store.deleteDocument(id);
    for (const topic of body.topics) store.putTopic(topic);
    for (const id of body.deletedTopicIds) store.deleteTopic(id);
    res.json({
      seq: store.currentSeq(),
      documents: store.documentChanges(body.sinceSeq),
      topics: store.topicChanges(body.sinceSeq),
    });
  });

  // --- AI extraction -------------------------------------------------------

  app.post(
    '/api/extract',
    route(async (req, res) => {
      if (!extractor) {
        return void res.status(503).json({ error: 'AI extraction is not configured on this server.' });
      }
      const input = ExtractRequestSchema.parse(req.body);
      const extraction = await extractor.extract(input);
      res.json(extraction);
    }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // --- Web app -------------------------------------------------------------

  if (webDir) {
    // The page and its scripts hold no secrets; data stays behind the /api token.
    app.use(express.static(webDir));
    // Client-side routes (/places, /document/123…) all load the same page.
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(webDir, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      return void res.status(400).json({ error: 'Invalid request.', issues: err.issues });
    }
    if (err instanceof ExtractionError) {
      return void res.status(err.status).json({ error: err.message });
    }
    if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
      return void res.status(413).json({ error: 'Request too large. Send fewer or smaller images.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
