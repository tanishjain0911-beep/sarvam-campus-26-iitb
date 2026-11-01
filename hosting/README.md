# Hosting source

[Open the public website](https://suno-news-mirror-iitb.sacredjam128.chatgpt.site/) · [Deployment guide](../docs/DEPLOYMENT.md) · [Main project README](../README.md)

This directory contains the complete source snapshot used for the current Suno deployment, including its locked framework dependencies and build integration. Hosting-source revision: `2859ccde7bd953c8e23124ac4111be3822d02de6` in the Site source repository. This GitHub copy has a clearer README; executable files match the deployed source.

## Build locally

Requires Node.js 22.13+ (Node 24 was used for the original build).

```bash
cd hosting
npm run install:ci
npm run build
```

To preview a production build, `npm start` uses local Wrangler. Configure `SARVAM_API_KEY` through Wrangler's local environment mechanism (`.dev.vars`) if testing speech locally. Keep that file untracked. The local preview URL is printed by the command.

## Source map

- `worker/index.ts`: Worker entrypoint; dispatches Suno requests through the Web Request/Response adapter while retaining the Sites build integration.
- `suno/handler.mjs`: hosted API routes, validation, security headers and static responses.
- `suno/assets.mjs`: embedded interface assets used by the deployed Worker.
- `suno/news.mjs`, `suno/sarvam.mjs`, `suno/voice-clone.mjs`: hosted news and Sarvam modules.
- `public/`: browser source assets, also used during the framework build.
- `tests/`: 24 hosted-adapter/shared-module tests.
- `vite.config.ts`, `scripts/`, `worker/`, `.openai/hosting.json`: build and deployment integration.
- `app/`, `components/`, remaining framework files: supplied scaffold retained in the deployed build; Suno's interface is served by the Worker adapter.

The Worker embeds browser assets. After changing files in `public/`, regenerate `suno/assets.mjs` before building; the deployment guide includes the command. The shared module copies in `lib/` and `suno/` must also be kept consistent.

The `project_id` in `.openai/hosting.json` identifies the existing Site; it is not a credential. For an independent deployment create a new Site identity. Do not overwrite the original Site's identity to publish an unrelated copy.

The Sarvam production key lives in the hosting secret store. It is not included here. Generated build output, installed dependencies, voice recordings and credentials are excluded.
