# Hosted deployment

URL: https://suno-news-mirror-iitb.sacredjam128.chatgpt.site

- Hosting: Sites / Cloudflare Workers, using the supplied Vinext build integration.
- Access: owner-private; requires sign-in. A public GitHub repository does not make the hosted app public.
- Runtime secret: SARVAM_API_KEY is stored in the hosting environment, outside source and build artifacts.
- The Node application remains runnable locally using the root README instructions.
- A separate hosting checkout adapts the API to Web Request/Response handlers and retains the existing browser interface and Sarvam/news modules. Its source and build are saved in the Site source repository.
- Verification: production build passed, 19 targeted hosted-handler/shared-module tests passed, and the hosting service confirmed deployment succeeded.
- A complete live hosted speech/voice-recreation flow has not been verified. The existing reported own-voice playback/flow issue remains open.

Hosting source checkout on the author's machine: work/suno-hosted (relative to the Codex task workspace). Future hosted edits should use the Site's source workflow rather than changing only the local Node server.
