# Ground mobile app

Expo (React Native) app. See the [root README](../../README.md) for the overall architecture.

```bash
npm run start        # Expo dev server (from this folder), or `npm run mobile` from the repo root
npm run typecheck
npm run lint
npm test             # reducer unit tests
```

- Routes: `src/app` (Expo Router). Tabs live in `src/app/(tabs)`; `_layout.web.tsx` is the web fallback for native tabs.
- State: `src/store` (Redux Toolkit). Async flows (extract, save, sync, delete) are in `src/store/thunks.ts`.
- Server API client: `src/api/client.ts`.
