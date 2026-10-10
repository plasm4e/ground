import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app';
import { Store } from './db';
import { ClaudeExtractor } from './extract';

const port = Number(process.env.PORT ?? 4000);
const store = new Store(process.env.GROUND_DB_PATH ?? './ground.db');

const hasAnthropicCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const extractor = hasAnthropicCredentials
  ? new ClaudeExtractor(new Anthropic(), process.env.GROUND_MODEL ?? 'claude-opus-5-5')
  : null;

const app = createApp({ store, extractor, apiToken: process.env.GROUND_API_TOKEN || undefined });

app.listen(port, '0.0.0.0', () => {
  console.log(`Ground API listening on http://0.0.0.0:${port}`);
  console.log(`AI extraction: ${extractor ? 'enabled' : 'disabled (set ANTHROPIC_API_KEY to enable)'}`);
  if (!process.env.GROUND_API_TOKEN) console.warn('GROUND_API_TOKEN is not set: the API is open to anyone who can reach it.');
});
