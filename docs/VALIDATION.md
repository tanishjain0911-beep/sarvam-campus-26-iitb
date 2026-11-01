# Suno validation record

## News Mirror sprint validation

- Five internal coding agents implemented/reviewed RSS, UI, cloning, HTTP routes and integration defects. OpenCode supplied demo notes; Antigravity supplied an independent review (suggestions were checked against actual code/API contracts rather than accepted blindly).
- Final automated suite: **38 tests pass**, zero failures; source, routes, clone consent/WAV validation, malformed responses and timeouts are mocked.
- Real BBC technology RSS returned five sourced headlines with publication dates and links. Cache and visible-view polling are 60seconds; publisher freshness is not guaranteed.
- One real headline was sent through existing Sarvam formal translation + standard TTS. Browser displayed Hindi and decoded a **9.301333-second WAV**, readyState4, no media error. No cloned voice was presented as tested.
- News language changes now clear prior text/audio and reset voice consent. Voice controls lock during requests; consent/file identity are rechecked before upload. Missing publication time no longer displays1970.
- Optional12-second microphone-to-local-WAV recorder is implemented and syntax checked. No microphone permission was accepted by the agent and no participant recording was captured. Live microphone behavior and clone similarity need the participant's own recording/consent.
- Beta clone endpoint uses verified Sarvam multipart audio_b64 contract and has seven mocked tests. No live own-voice call was made. Uploading/selecting/recording alone does not send a reference to Sarvam; the explicit clone button does.
- No GitHub push or deployment occurred during this sprint. Local preview is on port3002 because another existing process occupied3000.

## Local automated checks

- Node.js 24.15.0 on Windows; project requires Node 22+.
- `npm test`: 19 tests passed, zero failures.
- Syntax checks: `node --check public/app.js`, `node --check scripts/start-local.mjs`, `node --check server.mjs`, `node --check lib/sarvam.mjs` passed.
- Tests cover same-language translation skip; translation/TTS payloads; input and payload caps; language validation; missing credentials; sanitized provider authorization failure; partial translated-text preservation; malformed provider data; invalid base64/WAV headers; static file/secret blocking; cross-origin rejection; strict JSON content type; fetch and JSON-body timeouts.
- Provider tests are mocked; they do not establish language quality or spend credits.

## Sarvam builder checks

Local Sarvam MCP 0.2.13 initialized and returned 38 tools. Called sarvam_code_pricing, sarvam_code_snippet for JavaScript translation and TTS, and sarvam_code_validate_request before implementation. The initial translation and TTS request shapes passed. Formal translation mode was separately validated successfully.

## Approved live check

The participant approved one small public sentence: "The library opens at nine tomorrow." The English-to-Hindi pipeline returned prepared text and a WAV. The browser decoded a duration of 1.792 seconds, readyState 4, with no media error. Playback rate changed to 1.25 successfully; playback was not automatic.

The initial modern-colloquial translation was code-mixed: "Library कल nine बजे open होगी।" The implementation was changed to formal mode to favor target-language output. Formal mode passed the builder schema and mocked payload tests. A further live check was requested separately and remains subject to approval; do not claim its language quality has been verified until that check is recorded.

Browser file-download verification was blocked because download permission was declined. The blob URL and WAV filename were visible, but an end-to-end saved download is not claimed. No alternate method was used to bypass that block.

## Browser checks

- Real server health reported configured; root page returned HTTP 200.
- Empty/whitespace input disables generation; 1,001 emoji count as 1,001 code points and disable generation.
- Larger-text/high-contrast controls toggle and persist across reload; entered text is not persisted.
- Tab from the editor reaches Original language.
- Desktop layout inspected at 1280x900; narrow layout tested at 360x800, including larger text and high contrast; document width did not exceed viewport width.
- Local mock-only server produced a TTS failure after translation. UI kept readable text visible, showed an error and retry button, and hid audio. Clear returned the empty state.
- No additional real provider calls were used for UI error testing.

## Remaining limits

Only one English-to-Hindi sentence was tested live in initial mode. Other offered languages, formal-mode output quality, end-to-end browser download, screen-reader behavior, a formal accessibility audit, and another physical device are not verified. Generation requires internet. The service has not been publicly hosted. Production needs rate limiting, abuse prevention and broader testing.

GitHub push and deployment require participant approval. No secrets, audio or local logs belong in the repository.
