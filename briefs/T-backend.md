# Suno API server and integration tests
## Goal
Implement the dependency-free Node server and meaningful mocked tests.
## Context
Read PLAN.md and AGENTS.md. Follow the exact Sarvam endpoints and JSON bodies in PLAN.md; these were verified by MCP builder tools. No live API calls are permitted for this task.
## Files you may touch
- server.mjs
- lib/sarvam.mjs
- tests/server.test.mjs
- package.json
- .env.example
## Requirements
Implement PLAN.md contract. Export createServer({apiKey,fetchImpl,publicDir,requestTimeoutMs}) so tests can use ephemeral localhost ports and fake upstream fetch; main module starts only when directly invoked. Use built-in modules only. /api/read validates trimmed text 1..1000 Unicode code points, 11 language codes, 16KB JSON body, safe origin/content-type, source/target membership. Skip translate when source equals target. Translate then TTS otherwise, one call per phase, no retries. Input and translated length caps. 30-second upstream timeouts. Keep translated text on TTS failure via partial error response. Do not log request bodies, key, or provider response payloads. Sanitize HTTP errors and validate nonempty provider fields/base64 WAV before reporting success. Reject empty/invalid audio. Static allowlist only /, /index.html, /app.js, /styles.css. No path traversal, no arbitrary server file exposure. CSP must allow blob audio but no inline JS; assets are local. Security headers and no-store for API responses. Configure via SARVAM_API_KEY, PORT, HOST (127.0.0.1 default). Package scripts start=node server.mjs, test=node --test. .env.example contains names with blank key, not a dummy secret. Meaningful tests: same-language skips translation; translation+TTS payload correctness; input validation and length cap; missing key; provider unauthorized sanitized; partial translated-text error; malformed upstream; static path traversal/secret blocked; wrong origin; payload cap. Tests must not use real network providers.
## Interfaces
GET /api/health {ok:true,configured:boolean}. POST /api/read {text,sourceLanguage,targetLanguage}. Success {text,translated,audioBase64,mimeType:'audio/wav'}. Partial 502 {error,text,translated}. Other errors {error}. Browser selects playback rate itself; do not send pace to provider. Use speaker shubh, model bulbul:v3, sample rate 24000, preprocessing true. Translation mayura:v1 modern-colloquial international numerals. Read PLAN.md for all fields.
## Done when
node --test tests/server.test.mjs -> all tests pass, exit 0. node --check server.mjs and lib/sarvam.mjs -> exit 0. No live calls. Report exact checks and any caveats.
## Out of scope
No frontend edits, no dependencies, no real API calls, no credential reads, no commits/push/deploy. Do not edit planning/brief files. Manager handles integration fixes and commits.
