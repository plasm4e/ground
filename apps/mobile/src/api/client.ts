import type { Extraction, GroundDocument, Topic } from '@ground/core';

export interface ServerConfig {
  serverUrl: string;
  apiToken: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface ChangeSet<T> {
  upserted: T[];
  deletedIds: string[];
}

export interface SyncResponse {
  seq: number;
  documents: ChangeSet<GroundDocument>;
  topics: ChangeSet<Topic>;
}

export interface ExtractRequest {
  images: { data: string; mediaType: string }[];
  text?: string;
  topics: Pick<Topic, 'id' | 'name' | 'keywords'>[];
  today: string;
  locale: string;
}

async function call<T>(config: ServerConfig, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const base = config.serverUrl.trim().replace(/\/+$/, '');
  if (!base) throw new ApiError('No server configured.', 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
        ...init.headers,
      },
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.error ?? `Server responded ${res.status}.`, res.status);
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('The server took too long to answer.', 0);
    throw new ApiError('Could not reach the server.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: (c: ServerConfig) => call<{ ok: boolean; ai: boolean; authRequired: boolean }>(c, '/api/health', { timeoutMs: 5_000 }),

  sync: (
    c: ServerConfig,
    body: {
      sinceSeq: number;
      documents: GroundDocument[];
      deletedDocumentIds: string[];
      topics: Topic[];
      deletedTopicIds: string[];
    },
  ) => call<SyncResponse>(c, '/api/sync', { method: 'POST', body: JSON.stringify(body), timeoutMs: 60_000 }),

  // Vision extraction can take a while on multi-page documents.
  extract: (c: ServerConfig, body: ExtractRequest) =>
    call<Extraction>(c, '/api/extract', { method: 'POST', body: JSON.stringify(body), timeoutMs: 180_000 }),
};
