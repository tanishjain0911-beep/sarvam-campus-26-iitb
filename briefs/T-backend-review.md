# Correct backend timeout and audio checks
Read AGENTS.md and PLAN.md. Modify only lib/sarvam.mjs, server.mjs and tests/server.test.mjs. No live API calls, dependencies, Git operations or other files.

Review found: timers are cleared as soon as fetch resolves, so response.json() can hang forever. Wrap the entire fetch plus JSON body read in one bounded operation for both translation and TTS; ensure timeout aborts the request and clears timers in all cases. Fetch rejection must not leave a timer that stalls tests. Tests must cover a never-resolving fetch and a never-resolving JSON body for both phases using short injected timeoutMs.

Buffer.from(base64) accepts junk. Reject invalid base64 and require decoded WAV header (RIFF at0, WAVE at8, at least44bytes). Update test fixtures to actual minimal valid PCM WAV. Add malformed base64, empty/missing fields, wrong header tests.

Content-Type startsWith accepts application/jsonp. Require media type before semicolon exactly application/json; add test rejecting application/jsonp.

Run node --test tests/server.test.mjs and node --check lib/sarvam.mjs and node --check server.mjs. Report counts and caveats. Do not change the external API contract or provider models. Keep translated text on TTS failure.
